/** True when Supabase keys are set. Without them the app runs in demo mode with sample data kept in memory. */
export const isConfigured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
