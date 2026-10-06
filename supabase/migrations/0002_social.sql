-- VYBE phase 2: direct messages, comment replies + likes, blocking and reporting.
-- Run after 0001_init.sql (paste into the Supabase SQL editor and run).

-- ───────────────────────── Blocking ─────────────────────────
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "see own blocks" on public.blocks for select using (auth.uid() = blocker_id);
create policy "unblock"        on public.blocks for delete using (auth.uid() = blocker_id);
-- Inserts go through block_user() so follows are cleaned up at the same time.

-- True when either user has blocked the other. Security definer so it can see the other side's blocks.
create function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_user = auth.uid() then raise exception 'invalid block'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from follows
   where (follower_id = auth.uid() and following_id = p_user)
      or (follower_id = p_user and following_id = auth.uid());
end $$;

-- People you block (or who block you) can't follow you.
drop policy "follow as self" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (auth.uid() = follower_id and not public.is_blocked_between(follower_id, following_id));

-- ───────────────────────── Reports ─────────────────────────
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  video_id    uuid references public.videos (id) on delete set null,
  comment_id  uuid references public.comments (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  reason      text not null check (reason in ('spam', 'harassment', 'nudity', 'violence', 'misinformation', 'other')),
  details     text check (char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at  timestamptz not null default now(),
  check (num_nonnulls(video_id, comment_id, user_id) >= 1)
);
alter table public.reports enable row level security;
-- Users can file reports; only moderators (service role / dashboard) read them.
create policy "file reports" on public.reports for insert with check (auth.uid() = reporter_id);

-- ───────────────────────── Feed respects blocks ─────────────────────────
create or replace view public.video_feed with (security_invoker = true) as
select
  v.*,
  p.username,
  p.display_name,
  p.avatar_url,
  exists (select 1 from public.likes l where l.video_id = v.id and l.user_id = auth.uid())          as liked_by_me,
  exists (select 1 from public.saves s where s.video_id = v.id and s.user_id = auth.uid())          as saved_by_me,
  exists (select 1 from public.follows f where f.following_id = v.user_id and f.follower_id = auth.uid()) as following_author,
  (v.likes_count + 2 * v.comments_count + 3 * v.saves_count + 0.1 * v.views_count + 1)
    / power(extract(epoch from (now() - v.created_at)) / 3600 + 2, 1.5)                           as score
from public.videos v
join public.profiles p on p.id = v.user_id
where auth.uid() is null or not public.is_blocked_between(auth.uid(), v.user_id);

-- ───────────────────────── Comment replies + likes ─────────────────────────
alter table public.comments
  add column parent_id     uuid references public.comments (id) on delete cascade,
  add column likes_count   int not null default 0,
  add column replies_count int not null default 0;
create index comments_parent_idx on public.comments (parent_id, created_at);

-- Hide comments between blocked users.
drop policy "comments are public" on public.comments;
create policy "comments are public" on public.comments for select
  using (auth.uid() is null or not public.is_blocked_between(auth.uid(), user_id));

-- Replies must belong to the same video, and only one level deep (like TikTok).
create function public.check_comment_parent()
returns trigger language plpgsql as $$
declare parent record;
begin
  if new.parent_id is null then return new; end if;
  select video_id, parent_id into parent from public.comments where id = new.parent_id;
  if parent is null or parent.video_id <> new.video_id then raise exception 'invalid parent comment'; end if;
  if parent.parent_id is not null then new.parent_id := parent.parent_id; end if; -- flatten reply-to-reply
  return new;
end $$;
create trigger comments_parent_check before insert on public.comments
  for each row execute function public.check_comment_parent();

create table public.comment_likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
alter table public.comment_likes enable row level security;
create policy "comment likes are public" on public.comment_likes for select using (true);
create policy "like comment as self"     on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "unlike comment as self"   on public.comment_likes for delete using (auth.uid() = user_id);

create function public.on_comment_like_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update comments set likes_count = likes_count + 1 where id = new.comment_id;
  else
    update comments set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
create trigger comment_likes_counter after insert or delete on public.comment_likes
  for each row execute function public.on_comment_like_change();

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'reply'));

-- Replaces the 0001 version: also maintains reply counts and notifies the person replied to.
create or replace function public.on_comment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; parent_author uuid;
begin
  if tg_op = 'INSERT' then
    update videos set comments_count = comments_count + 1 where id = new.video_id returning user_id into owner;
    if new.parent_id is not null then
      update comments set replies_count = replies_count + 1 where id = new.parent_id returning user_id into parent_author;
      if parent_author <> new.user_id then
        insert into notifications (recipient_id, actor_id, type, video_id, comment_id)
        values (parent_author, new.user_id, 'reply', new.video_id, new.id);
      end if;
    end if;
    if owner <> new.user_id and owner is distinct from parent_author then
      insert into notifications (recipient_id, actor_id, type, video_id, comment_id)
      values (owner, new.user_id, 'comment', new.video_id, new.id);
    end if;
  else
    update videos set comments_count = greatest(comments_count - 1, 0) where id = old.video_id;
    if old.parent_id is not null then
      update comments set replies_count = greatest(replies_count - 1, 0) where id = old.parent_id;
    end if;
  end if;
  return null;
end $$;

-- ───────────────────────── Direct messages ─────────────────────────
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  last_message_preview text not null default ''
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text check (char_length(body) <= 2000),
  video_id        uuid references public.videos (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (coalesce(char_length(body), 0) > 0 or video_id is not null)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- Security definer avoids RLS recursion when policies check membership.
create function public.is_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = p_conversation and user_id = auth.uid());
$$;

alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

create policy "members see conversation" on public.conversations for select using (public.is_member(id));
create policy "members see members"      on public.conversation_members for select using (public.is_member(conversation_id));
create policy "update own read marker"   on public.conversation_members for update using (user_id = auth.uid());
create policy "members read messages"    on public.messages for select using (public.is_member(conversation_id));
create policy "members send messages"    on public.messages for insert with check (
  sender_id = auth.uid()
  and public.is_member(conversation_id)
  and not exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.user_id <> auth.uid()
      and public.is_blocked_between(auth.uid(), m.user_id)
  )
);
create policy "delete own messages" on public.messages for delete using (sender_id = auth.uid());

-- Finds the 1:1 conversation with someone, creating it if needed.
create function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null or p_other = auth.uid() then raise exception 'invalid conversation'; end if;
  if is_blocked_between(auth.uid(), p_other) then raise exception 'You can''t message this account.'; end if;

  select a.conversation_id into cid
  from conversation_members a
  join conversation_members b on b.conversation_id = a.conversation_id and b.user_id = p_other
  where a.user_id = auth.uid()
  limit 1;

  if cid is null then
    insert into conversations default values returning id into cid;
    insert into conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, p_other);
  end if;
  return cid;
end $$;

create function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations
     set last_message_at = new.created_at,
         last_message_preview = case when new.video_id is not null and coalesce(new.body, '') = '' then 'Shared a video'
                                     else left(new.body, 120) end
   where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

create function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- One row per conversation I'm in, with the other person and my unread count.
create view public.my_conversations with (security_invoker = true) as
select
  c.id,
  c.last_message_at,
  c.last_message_preview,
  other.user_id      as other_id,
  p.username         as other_username,
  p.display_name     as other_display_name,
  p.avatar_url       as other_avatar_url,
  (select count(*) from public.messages m
    where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at)::int as unread_count
from public.conversations c
join public.conversation_members me    on me.conversation_id = c.id and me.user_id = auth.uid()
join public.conversation_members other on other.conversation_id = c.id and other.user_id <> auth.uid()
join public.profiles p on p.id = other.user_id
where exists (select 1 from public.messages m where m.conversation_id = c.id);

alter publication supabase_realtime add table public.messages;
