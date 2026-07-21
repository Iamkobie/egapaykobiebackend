const { Router } = require('express');
const { egovSSOCallback, egovSSOLogin } = require('../controllers/auth.controller');

const router = Router();

/**
 * GET /api/auth/sso/callback
 * eGov redirects the user here with ?exchange_code=xxx after authentication.
 * Completes the token exchange and redirects to the frontend.
 * This is the URL you register with eGov as your partner callback URL.
 * Example: https://your-app.com/api/auth/sso/callback
 */
router.get('/sso/callback', egovSSOCallback);

/**
 * POST /api/auth/sso/egov
 * JSON API alternative — for SPAs that intercept the redirect themselves
 * and want to exchange the code via fetch/axios instead of a browser redirect.
 */
router.post('/sso/egov', egovSSOLogin);

module.exports = router;
