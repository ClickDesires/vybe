-- VYBE: initial schema
-- Run this in the Supabase SQL editor (or with `supabase db push`).

-- ───────────────────────── Profiles ─────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  display_name    text not null default '',
  bio             text not null default '' check (char_length(bio) <= 160),
  avatar_url      text,
  followers_count int  not null default 0,
  following_count int  not null default 0,
  likes_count     int  not null default 0, -- total likes received across all videos
  created_at      timestamptz not null default now()
);

-- Create a profile row automatically when someone signs up.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9._]', '', 'g'));
begin
  if char_length(base) < 3 or exists (select 1 from public.profiles where username = base) then
    base := left(coalesce(nullif(base, ''), 'user'), 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, left(base, 24), coalesce(new.raw_user_meta_data ->> 'display_name', base));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Videos ─────────────────────────
create table public.videos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  video_url      text not null,
  thumbnail_url  text,
  caption        text not null default '' check (char_length(caption) <= 2200),
  sound_name     text not null default 'Original sound',
  visibility     text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  allow_comments boolean not null default true,
  duration       real,
  likes_count    int not null default 0,
  comments_count int not null default 0,
  saves_count    int not null default 0,
  views_count    int not null default 0,
  created_at     timestamptz not null default now()
);
create index videos_user_idx on public.videos (user_id, created_at desc);
create index videos_created_idx on public.videos (created_at desc);

-- ───────────────────────── Social graph ─────────────────────────
create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  video_id   uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index likes_video_idx on public.likes (video_id);

create table public.saves (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  video_id   uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references public.videos (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_video_idx on public.comments (video_id, created_at desc);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid not null references public.profiles (id) on delete cascade,
  type         text not null check (type in ('like', 'comment', 'follow')),
  video_id     uuid references public.videos (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ───────────────────────── Counters + notifications ─────────────────────────
create function public.on_like_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update videos set likes_count = likes_count + 1 where id = new.video_id returning user_id into owner;
    update profiles set likes_count = likes_count + 1 where id = owner;
    if owner <> new.user_id then
      insert into notifications (recipient_id, actor_id, type, video_id) values (owner, new.user_id, 'like', new.video_id);
    end if;
  else
    update videos set likes_count = greatest(likes_count - 1, 0) where id = old.video_id returning user_id into owner;
    update profiles set likes_count = greatest(likes_count - 1, 0) where id = owner;
    delete from notifications where type = 'like' and actor_id = old.user_id and video_id = old.video_id;
  end if;
  return null;
end $$;
create trigger likes_counter after insert or delete on public.likes
  for each row execute function public.on_like_change();

create function public.on_save_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update videos set saves_count = saves_count + 1 where id = new.video_id;
  else
    update videos set saves_count = greatest(saves_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end $$;
create trigger saves_counter after insert or delete on public.saves
  for each row execute function public.on_save_change();

create function public.on_comment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update videos set comments_count = comments_count + 1 where id = new.video_id returning user_id into owner;
    if owner <> new.user_id then
      insert into notifications (recipient_id, actor_id, type, video_id, comment_id)
      values (owner, new.user_id, 'comment', new.video_id, new.id);
    end if;
  else
    update videos set comments_count = greatest(comments_count - 1, 0) where id = old.video_id;
  end if;
  return null;
end $$;
create trigger comments_counter after insert or delete on public.comments
  for each row execute function public.on_comment_change();

create function public.on_follow_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    update profiles set followers_count = followers_count + 1 where id = new.following_id;
    insert into notifications (recipient_id, actor_id, type) values (new.following_id, new.follower_id, 'follow');
  else
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    delete from notifications where type = 'follow' and actor_id = old.follower_id and recipient_id = old.following_id;
  end if;
  return null;
end $$;
create trigger follows_counter after insert or delete on public.follows
  for each row execute function public.on_follow_change();

-- Views are counted through an RPC so clients never write the counter directly.
create function public.register_view(p_video_id uuid)
returns void language sql security definer set search_path = public as $$
  update videos set views_count = views_count + 1 where id = p_video_id;
$$;

-- ───────────────────────── Row level security ─────────────────────────
alter table public.profiles      enable row level security;
alter table public.videos        enable row level security;
alter table public.follows       enable row level security;
alter table public.likes         enable row level security;
alter table public.saves         enable row level security;
alter table public.comments      enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are public"     on public.profiles for select using (true);
create policy "update own profile"      on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "see visible videos" on public.videos for select using (
  visibility = 'public'
  or user_id = auth.uid()
  or (visibility = 'followers' and exists (
        select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = videos.user_id))
);
create policy "post own videos"   on public.videos for insert with check (auth.uid() = user_id);
create policy "edit own videos"   on public.videos for update using (auth.uid() = user_id);
create policy "delete own videos" on public.videos for delete using (auth.uid() = user_id);

create policy "follows are public" on public.follows for select using (true);
create policy "follow as self"     on public.follows for insert with check (auth.uid() = follower_id);
create policy "unfollow as self"   on public.follows for delete using (auth.uid() = follower_id);

create policy "likes are public" on public.likes for select using (true);
create policy "like as self"     on public.likes for insert with check (auth.uid() = user_id);
create policy "unlike as self"   on public.likes for delete using (auth.uid() = user_id);

create policy "saves are private" on public.saves for select using (auth.uid() = user_id);
create policy "save as self"      on public.saves for insert with check (auth.uid() = user_id);
create policy "unsave as self"    on public.saves for delete using (auth.uid() = user_id);

create policy "comments are public" on public.comments for select using (true);
create policy "comment as self" on public.comments for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.videos v where v.id = video_id and v.allow_comments)
);
create policy "delete own comment or on own video" on public.comments for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.videos v where v.id = video_id and v.user_id = auth.uid())
);

create policy "read own notifications"   on public.notifications for select using (auth.uid() = recipient_id);
create policy "update own notifications" on public.notifications for update using (auth.uid() = recipient_id);

-- ───────────────────────── Feed view ─────────────────────────
-- security_invoker makes the view respect the caller's RLS (visibility rules above).
-- score: engagement weighted by quality signals, decayed by age (Hacker-News-style gravity).
create view public.video_feed with (security_invoker = true) as
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
join public.profiles p on p.id = v.user_id;

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('videos', 'videos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Files live under "<user id>/<file>", so users can only write inside their own folder.
create policy "upload own media" on storage.objects for insert to authenticated
  with check (bucket_id in ('videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own media" on storage.objects for update to authenticated
  using (bucket_id in ('videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own media" on storage.objects for delete to authenticated
  using (bucket_id in ('videos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── Realtime ─────────────────────────
-- Lets the app update the Alerts badge live when a notification arrives.
alter publication supabase_realtime add table public.notifications;
