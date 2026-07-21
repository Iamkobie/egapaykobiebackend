const { Router } = require('express');
const { getProfilingData, matchPrograms, chatProgramDiscovery } = require('../controllers/programs.controller');

const router = Router();

/**
 * POST /api/programs/profile
 * Returns verified profile fields + additional questions needed for a category.
 */
router.post('/profile', getProfilingData);

/**
 * POST /api/programs/match
 * Returns government programs matched to the user's profile, answers, and category.
 * Includes eligibility scoring with criteria met/missing.
 */
router.post('/match', matchPrograms);

/**
 * POST /api/programs/chat
 * Natural language program discovery — user describes their situation,
 * backend finds matching programs and returns guidance.
 */
router.post('/chat', chatProgramDiscovery);

module.exports = router;
