const axios = require('axios');

const BASE_URL = process.env.EGOV_BASE_URL;
const PARTNER_CODE = process.env.EGOV_PARTNER_CODE;
const PARTNER_SECRET = process.env.EGOV_PARTNER_SECRET;

/**
 * Step 1 — Exchange an authorization code for an eGov access token.
 *
 * @param {string} exchangeCode - The single-use code received from eGov after user auth.
 * @returns {Promise<string>} The access token.
 * @throws Will throw with a descriptive message on failure.
 */
async function getAccessToken(exchangeCode) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/token`,
      {
        exchange_code: exchangeCode,
        scope: 'SSO_AUTHENTICATION',
        partner_code: PARTNER_CODE,
        partner_secret: PARTNER_SECRET,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const { access_token } = response.data;

    if (!access_token) {
      throw new Error('eGov token response did not include an access_token');
    }

    return access_token;
  } catch (error) {
    // Translate eGov HTTP errors into meaningful messages
    if (error.response) {
      const { status } = error.response;
      if (status === 403) {
        throw Object.assign(
          new Error('eGov: invalid partner credentials or unauthorized partner'),
          { statusCode: 403 }
        );
      }
      if (status === 422) {
        throw Object.assign(
          new Error('eGov: exchange code is invalid, expired, or already used'),
          { statusCode: 422 }
        );
      }
      throw Object.assign(
        new Error(`eGov token request failed with status ${status}`),
        { statusCode: status }
      );
    }
    throw error;
  }
}

/**
 * Step 2 — Resolve the authenticated user's profile using the access token.
 *
 * @param {string} accessToken - The token obtained from getAccessToken().
 * @returns {Promise<Object>} The citizen's profile data from eGov.
 * @throws Will throw with a descriptive message on failure.
 */
async function getSSOProfile(accessToken) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/partner/sso_authentication`,
      null, // no request body
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const { data } = response.data;

    if (!data) {
      throw new Error('eGov SSO response did not include profile data');
    }

    // Log the full profile so you can inspect/copy it from the terminal
    console.log('\n─── eGov SSO Profile ───────────────────────────────');
    console.log(JSON.stringify(data, null, 2));
    console.log('────────────────────────────────────────────────────\n');

    return data;
  } catch (error) {
    if (error.response) {
      const { status } = error.response;
      if (status === 401) {
        throw Object.assign(
          new Error('eGov: access token is missing, invalid, or expired'),
          { statusCode: 401 }
        );
      }
      throw Object.assign(
        new Error(`eGov SSO request failed with status ${status}`),
        { statusCode: status }
      );
    }
    throw error;
  }
}

module.exports = { getAccessToken, getSSOProfile };
