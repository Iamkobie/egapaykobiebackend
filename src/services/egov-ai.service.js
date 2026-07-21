/**
 * eGov AI Integration Service
 * 
 * Connects to the eGov AI Core API for intelligent responses.
 * 
 * Flow:
 * 1. Get access token using our hackathon access_code
 * 2. Use the token to call the AI Assistant endpoint
 * 
 * Base URL: https://egov-ai-core-ws.oueg.info
 * Token endpoint: POST /api/v1/egov/integration/token
 * AI endpoint: POST /api/v1/egov/integration/ai_assistant/generate
 */
const axios = require('axios');

const EGOV_AI_BASE = 'https://egov-ai-core-ws.oueg.info';
const ACCESS_CODE = process.env.EGOV_AI_ACCESS_CODE || 'f2c81ce889a5850fd59487ce988ec1324183682c62d300bdbd33d5064862942b';

// Cache the token (expires in 172800 seconds = 48 hours)
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid access token, refreshing if expired.
 */
async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const response = await axios.post(`${EGOV_AI_BASE}/api/v1/egov/integration/token`, {
      access_code: ACCESS_CODE,
    });

    cachedToken = response.data.access_token;
    // Refresh 5 minutes before expiry
    tokenExpiresAt = now + (response.data.expires_in_seconds - 300) * 1000;

    console.log(`[eGov AI] Token obtained. Credits remaining: ${response.data.credits_remaining}`);
    return cachedToken;
  } catch (error) {
    console.error('[eGov AI] Failed to get token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with eGov AI service');
  }
}

/**
 * Call the eGov AI Assistant with a prompt.
 * 
 * @param {string} prompt - The user's message/question with context
 * @param {string} category - Country/region code (default "PH")
 * @returns {string} The AI's response text
 */
async function askAI(prompt, category = 'PH') {
  const token = await getToken();

  // Truncate prompt if too long (API might have limits)
  const truncatedPrompt = prompt.length > 2000 ? prompt.substring(0, 2000) : prompt;

  try {
    const response = await axios.post(
      `${EGOV_AI_BASE}/api/v1/egov/integration/ai_assistant/generate`,
      { prompt: truncatedPrompt, category },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    return response.data.data || '';
  } catch (error) {
    console.error('[eGov AI] Error details:', error.response?.status, error.response?.data || error.message);
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expired or forbidden, clear cache and retry once
      cachedToken = null;
      tokenExpiresAt = 0;
      const newToken = await getToken();
      try {
        const retry = await axios.post(
          `${EGOV_AI_BASE}/api/v1/egov/integration/ai_assistant/generate`,
          { prompt: truncatedPrompt, category },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`,
            },
            timeout: 30000,
          }
        );
        return retry.data.data || '';
      } catch (retryError) {
        console.error('[eGov AI] Retry also failed:', retryError.response?.status, retryError.response?.data || retryError.message);
        throw new Error('eGov AI service is temporarily unavailable');
      }
    }
    throw new Error('eGov AI service is temporarily unavailable');
  }
}

/**
 * Build a rich prompt for the AI assistant that includes user context.
 */
function buildPrompt(userMessage, userContext, services) {
  let prompt = '';

  // Add user profile context (keep brief)
  if (userContext && Object.keys(userContext).length > 0) {
    prompt += 'User profile: ';
    const parts = [];
    if (userContext.age) parts.push(`${userContext.age} years old`);
    if (userContext.gender) parts.push(userContext.gender);
    if (userContext.nationality) parts.push(userContext.nationality);
    if (userContext.province) parts.push(`from ${userContext.province}`);
    if (userContext.occupation) parts.push(`works as ${userContext.occupation}`);
    if (userContext.education) parts.push(`education: ${userContext.education}`);
    prompt += parts.join(', ') + '.\n\n';
  }

  // Add available services context (keep brief - just names)
  if (services && services.length > 0) {
    prompt += 'Relevant programs in database: ';
    prompt += services.slice(0, 6).map(s => s.title).join('; ');
    prompt += '.\n\n';
  }

  // The actual user question
  prompt += `Question: ${userMessage}\n\n`;
  prompt += 'Respond as an eGovPH assistant. Be conversational, helpful, and specific. Include next steps and where to apply. If you need more info to determine eligibility, ask follow-up questions.';

  return prompt;
}

module.exports = { askAI, buildPrompt, getToken };
