const { loginWithEgov } = require('../services/auth.service');

// Formats the etulong.user_metadata value into a clean response object
function formatUser(userId, profile) {
  return {
    id:                    userId,
    email:                 profile.email ?? null,
    uniqid:                profile.uniqid,
    firstName:             profile.first_name,
    middleName:            profile.middle_name,
    lastName:              profile.last_name,
    suffix:                profile.suffix,
    birthDate:             profile.birth_date,
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
    countryAlpha2Code:     profile.country_alpha_2_code,
    countryAlpha3Code:     profile.country_alpha_3_code,
    postal:                profile.postal,
    addressLine2:          profile.address_line_2,
    barangayCode:          profile.barangay_code,
    provinceCode:          profile.province_code,
    municipalityCode:      profile.municipality_code,
    regionCode:            profile.region_code,
    countryId:             profile.country_id,
    foreignAddress:        profile.foreign_address,
    signatureUrl:          profile.signature_url,
    additionalInformation: profile.additional_information,
    passport:              profile.passport,
    nationalId:            profile.national_id,
    tinId:                 profile.tin_id,
    lastLoginAt:           profile.last_login_at,
  };
}

/**
 * GET /api/auth/sso/callback
 * eGov redirects here with ?exchange_code=xxx after the user authenticates.
 * Completes the exchange and redirects the browser to the frontend with tokens.
 */
async function egovSSOCallback(req, res, next) {
  try {
    const { exchange_code } = req.query;

    if (!exchange_code || typeof exchange_code !== 'string') {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=missing_exchange_code`
      );
    }

    const { session, user } = await loginWithEgov(exchange_code);

    return res.redirect(
      `${process.env.FRONTEND_URL}/sso/callback` +
      `?access_token=${session.access_token}` +
      `&refresh_token=${session.refresh_token}`
    );
  } catch (error) {
    const code = error.statusCode || 500;
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=sso_failed&code=${code}`
    );
  }
}

/**
 * POST /api/auth/sso/egov
 * JSON API — for frontends that handle the redirect themselves.
 * Body: { exchange_code: string }
 */
async function egovSSOLogin(req, res, next) {
  try {
    const { exchange_code } = req.body;

    if (!exchange_code || typeof exchange_code !== 'string') {
      return res.status(400).json({
        status:  400,
        message: 'exchange_code is required and must be a string',
      });
    }

    const { session, profile, userId } = await loginWithEgov(exchange_code);

    return res.status(200).json({
      status:  200,
      message: 'Login successful',
      data: {
        session,
        user: formatUser(userId, profile),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/profile?user_id=xxx
 * Returns the user's eGov profile from user_metadata using service role key.
 * This bypasses RLS so the frontend can always get the profile.
 */
async function getUserProfile(req, res, next) {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ status: 400, message: 'user_id is required' });
    }

    const supabase = require('../supabase');
    const { data, error } = await supabase
      .from('user_metadata')
      .select('value')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ status: 500, message: error.message });
    }

    if (!data || !data.value) {
      return res.status(404).json({ status: 404, message: 'Profile not found' });
    }

    return res.status(200).json({ status: 200, data: data.value });
  } catch (error) {
    next(error);
  }
}

module.exports = { egovSSOCallback, egovSSOLogin, getUserProfile };
