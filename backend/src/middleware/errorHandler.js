import env from '../config/env.js';

export const errorHandler = (err, _req, res, _next) => {
  // CORS rejection from the origin callback
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: { message: 'Not allowed by CORS' },
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message =
    statusCode === 500 && env.nodeEnv === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  // Do not log request bodies, tokens, phone numbers, or coordinates
  if (statusCode >= 500) {
    console.error(`[error] ${statusCode} ${err.name || 'Error'}: ${message}`);
  }

  const body = {
    success: false,
    error: {
      message,
      code: err.code || undefined,
    },
  };

  if (env.nodeEnv !== 'production' && err.stack) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
};
