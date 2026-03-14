const { errorResponse } = require('../utils/response');

/**
 * 404 Not Found handler — for undefined routes
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Global error handler
 */
const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // ── Mongoose duplicate key error ──
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with this ${field} already exists.`;
  }

  // ── Mongoose validation error ──
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  }

  // ── Mongoose cast error (invalid ObjectId) ──
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  // ── JWT errors ──
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired.';
  }

  // Log unexpected server errors
  if (statusCode === 500) {
    console.error('🔥 Unhandled Error:', err);
  }

  return errorResponse(
    res,
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Something went wrong. Please try again later.'
      : message,
    statusCode
  );
};

module.exports = { notFound, globalErrorHandler };