/**
 * Central error handler.
 * Maps known eGov error status codes back to sensible HTTP responses.
 * Never leaks internal stack traces to the client in production.
 */
function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV === 'development';

  // Use the statusCode attached by the eGov service, or default to 500
  const statusCode = err.statusCode || 500;

  const response = {
    status: statusCode,
    message: err.message || 'Internal server error',
  };

  // Only include stack trace in development
  if (isDev) {
    response.stack = err.stack;
  }

  console.error(`[${new Date().toISOString()}] ${statusCode} — ${err.message}`);

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;
