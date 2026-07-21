require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes     = require('./routes/auth.routes');
const programRoutes  = require('./routes/programs.routes');
const errorHandler   = require('./middleware/errorHandler');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Test UI (optional - only for development) ────────────────────────────────
// Serve the test SSO UI at /test instead of root to avoid confusion
app.use('/test', express.static('public'));

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'egovSSOapi',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /health',
      'POST /api/auth/sso/egov',
      'GET /api/auth/sso/callback',
      'POST /api/programs/profile',
      'POST /api/programs/match',
      'POST /api/programs/chat',
    ],
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/programs', programRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Test endpoint for frontend connectivity ──────────────────────────────────
app.get('/api/test', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend is reachable from frontend',
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export for Vercel serverless
module.exports = app;

