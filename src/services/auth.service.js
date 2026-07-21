const supabase = require('../supabase');
const { upsertUser } = require('../models/User');
const { getAccessToken, getSSOProfile } = require('./egov.service');

/**
 * Full SSO login flow:
 *  1. Exchange the eGov exchange_code for an access token
 *  2. Fetch the citizen profile from eGov SSO
 *  3. Upsert auth.users + public.user_metadata
 *  4. Generate a real Supabase session for the user
 *  5. Return the session + profile value
 */
async function loginWithEgov(exchangeCode) {
  const egovAccessToken  = await getAccessToken(exchangeCode);
  const profile          = await getSSOProfile(egovAccessToken);
  const { authUser, profileRow } = await upsertUser(profile);

  // Generate a magic link and extract the token_hash
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type:  'magiclink',
    email: authUser.email,
  });

  if (linkError) throw new Error(`Failed to generate link: ${linkError.message}`);

  // Extract the OTP token hash from the link properties
  const hashed_token = linkData.properties.hashed_token;

  if (!hashed_token) {
    throw new Error('No hashed_token returned from generateLink');
  }

  // Verify the OTP to get a real session with JWT access_token + refresh_token
  // type must be 'email' for magiclink verification
  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: hashed_token,
    type: 'email',
  });

  if (verifyError) throw new Error(`Failed to verify session: ${verifyError.message}`);

  if (!sessionData.session) {
    throw new Error('No session returned after OTP verification');
  }

  // Log the JWT tokens to console on every login
  console.log('\n─── Supabase Session Tokens ────────────────────────');
  console.log('access_token:', sessionData.session.access_token);
  console.log('refresh_token:', sessionData.session.refresh_token);
  console.log('expires_in:', sessionData.session.expires_in);
  console.log('────────────────────────────────────────────────────\n');

  return {
    session: {
      access_token:  sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      token_type:    'bearer',
      expires_in:    sessionData.session.expires_in,
    },
    profile: profileRow.value,
    userId:  authUser.id,
  };
}

module.exports = { loginWithEgov };
