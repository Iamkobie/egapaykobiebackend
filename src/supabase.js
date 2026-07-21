const { createClient } = require('@supabase/supabase-js');

/**
 * Admin client — uses the service role key.
 * Only used server-side. Never expose this key to the frontend.
 * The service role key automatically bypasses RLS.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabase;
