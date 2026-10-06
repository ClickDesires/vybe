// Seeds demo creators and videos so the feed isn't empty on day one.
// Usage: add SUPABASE_SECRET_KEY to .env.local, then `npm run seed`.
// Safe to re-run: existing demo users are reused.
import { createClient } from '@supabase/supabase-js';

try {
  process.loadEnvFile('.env.local');
} catch {
  console.error('Missing .env.local (copy .env.example first).');
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });

// Free sample clips. They are downloaded once and re-uploaded to your own storage bucket.
const SAMPLES = {
  flower: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  bunny: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4',
  city: 'https://download.samplelib.com/mp4/sample-5s.mp4',
  street: 'https://download.samplelib.com/mp4/sample-10s.mp4',
  ride: 'https://download.samplelib.com/mp4/sample-15s.mp4',
};
const clip = (name) => ({ sample: name });

const CREATORS = [
  {
    username: 'zuri.moves',
    display_name: 'Zuri Adebayo',
    bio: 'Movement director · night-shift dreamer ✦ NYC',
    avatar: 'https://i.pravatar.cc/300?img=47',
    videos: [
      { ...clip('city'), caption: 'Midnight weather, main character energy 🔥 #nightshift #dancefilm', sound_name: 'Afterdark · Kairo Bloom' },
      { ...clip('flower'), caption: 'We made the rain part of the choreography #dancefilm #vybeoriginal', sound_name: 'Original sound' },
    ],
  },
  {
    username: 'milo.wheels',
    display_name: 'Milo Chen',
    bio: 'No brakes after midnight 🛹',
    avatar: 'https://i.pravatar.cc/300?img=12',
    videos: [
      { ...clip('street'), caption: 'Found a new spot. Don’t tell anyone #skate #cityvibes', sound_name: 'Neon Static · Luma' },
      { ...clip('ride'), caption: 'Sunday joyride with the crew #cityvibes', sound_name: 'Original sound' },
    ],
  },
  {
    username: 'ari.sol',
    display_name: 'Ari Sol',
    bio: 'Food, film and very loud opinions 🍜',
    avatar: 'https://i.pravatar.cc/300?img=32',
    videos: [{ ...clip('bunny'), caption: 'When the recipe says “simple” #foodtok #comedy', sound_name: 'Original sound' }],
  },
];

async function findOrCreateUser(c) {
  const email = `${c.username.replace(/\./g, '-')}@demo.vybe.app`;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { username: c.username, display_name: c.display_name },
  });
  if (error) throw error;
  return data.user.id;
}

async function uploadSample(userId, name) {
  const res = await fetch(SAMPLES[name]);
  if (!res.ok) throw new Error(`Download failed for ${name}: ${res.status}`);
  const path = `${userId}/seed-${name}.mp4`;
  const { error } = await admin.storage.from('videos').upload(path, await res.arrayBuffer(), { contentType: 'video/mp4', upsert: true });
  if (error) throw error;
  return admin.storage.from('videos').getPublicUrl(path).data.publicUrl;
}

for (const c of CREATORS) {
  const id = await findOrCreateUser(c);
  await admin.from('profiles').update({ bio: c.bio, avatar_url: c.avatar, display_name: c.display_name }).eq('id', id);

  const { count } = await admin.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', id);
  if (!count) {
    const rows = [];
    for (const { sample, ...v } of c.videos) {
      rows.push({ ...v, video_url: await uploadSample(id, sample), user_id: id, views_count: Math.floor(Math.random() * 5000) });
    }
    const { error } = await admin.from('videos').insert(rows);
    if (error) throw error;
  }
  console.log(`✓ @${c.username}`);
}

console.log('Done. Pull to refresh in the app.');
