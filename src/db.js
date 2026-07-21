const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase hosted Postgres
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err.message);
});

/**
 * Run a parameterised SQL query.
 * @param {string} text  - SQL string with $1, $2 placeholders
 * @param {Array}  params - Values matching the placeholders
 */
async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Verify the connection is alive. Called on startup.
 */
async function testConnection() {
  const result = await query('SELECT NOW() AS now', []);
  console.log('Supabase Postgres connected at', result.rows[0].now);
}

module.exports = { query, testConnection };
