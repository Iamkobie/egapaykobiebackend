const supabase = require('../supabase');

/**
 * Builds the clean eGov profile object to store as JSONB in etulong.user_metadata.
 * Base64 signature blobs are intentionally excluded.
 */
function buildProfileValue(profile) {
  return {
    uniqid:                profile.uniqid,
    first_name:            profile.first_name,
    middle_name:           profile.middle_name,
    last_name:             profile.last_name,
    suffix:                profile.suffix ?? null,
    birth_date:            profile.birth_date,
    gender:                profile.gender,
    nationality:           profile.nationality,
    mobile:                profile.mobile,
    photo:                 profile.photo,
    address:               profile.address,
    street:                profile.street,
    barangay:              profile.barangay,
    municipality:          profile.municipality,
    region:                profile.region,
    province:              profile.province,
    country:               profile.country,
    country_alpha_2_code:  profile.country_alpha_2_code,
    country_alpha_3_code:  profile.country_alpha_3_code,
    postal:                profile.postal ?? null,
    address_line_2:        profile.address_line_2 ?? null,
    barangay_code:         profile.barangay_code,
    province_code:         profile.province_code,
    municipality_code:     profile.municipality_code,
    region_code:           profile.region_code,
    country_id:            profile.country_id,
    foreign_address:       profile.foreign_address ?? null,
    signature_url:         profile.signature_url ?? null,
    passport:              profile.passport
      ? {
          first_name:      profile.passport.first_name,
          middle_name:     profile.passport.middle_name,
          last_name:       profile.passport.last_name,
          suffix:          profile.passport.suffix ?? null,
          gender:          profile.passport.gender,
          birth_date:      profile.passport.birth_date,
          passport_number: profile.passport.passport_number,
          place_issued:    profile.passport.place_issued,
          issued_date:     profile.passport.issued_date,
          expiry_date:     profile.passport.expiry_date,
        }
      : null,
    national_id:           profile.national_id
      ? {
          code:     profile.national_id.code,
          pcn:      profile.national_id.pcn,
          face_url: profile.national_id.face_url,
        }
      : null,
    tin_id:                profile.tin_id ?? null,
    additional_information: profile.additional_information ?? {},
    last_login_at:         new Date().toISOString(),
  };
}

/**
 * Upsert a user:
 *  1. Find or create the auth.users record (by email)
 *  2. Upsert the eGov profile into etulong.user_metadata (by user_id)
 *
 * Returns { authUser, profileRow }
 */
async function upsertUser(profile) {
  // ── Step 1: Find or create auth user ──────────────────────────────────────
  // Use getUserById if we can look up by email — admin API supports this
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listError) throw new Error(`Failed to look up users: ${listError.message}`);

  let authUser = listData.users.find((u) => u.email === profile.email) ?? null;

  if (!authUser) {
    // New user — create in auth.users (email already verified by eGov)
    const { data, error } = await supabase.auth.admin.createUser({
      email:         profile.email,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create auth user: ${error.message}`);
    authUser = data.user;
  }

  // ── Step 2: Upsert into user_metadata ────────────────────────────────────
  const profileValue = buildProfileValue(profile);

  // Check if metadata already exists for this user
  const { data: existingMeta } = await supabase
    .from('user_metadata')
    .select('id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  let metaRow = { value: profileValue };
  try {
    if (existingMeta) {
      // Update existing metadata
      const { data, error: updateError } = await supabase
        .from('user_metadata')
        .update({
          value:      profileValue,
          source:     'egov_sso',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', authUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      metaRow = data;
    } else {
      // Insert new metadata
      const { data, error: insertError } = await supabase
        .from('user_metadata')
        .insert({
          user_id:    authUser.id,
          value:      profileValue,
          source:     'egov_sso',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      metaRow = data;
    }
  } catch (metaError) {
    // Log but don't fail the login — profile will come from cache
    console.warn(`[user_metadata] RLS blocked write (run: ALTER TABLE public.user_metadata DISABLE ROW LEVEL SECURITY;):`, metaError.message);
    metaRow = { value: profileValue };
  }

  return { authUser, profileRow: metaRow };
}

module.exports = { upsertUser };
