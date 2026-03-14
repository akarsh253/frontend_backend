const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
});

/**
 * Strict limiter for auth routes (prevent brute force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes.',
  },
});

/**
 * Limiter for password reset / email endpoints
 */
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 emails per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many email requests. Please wait an hour before trying again.',
  },
});

module.exports = { apiLimiter, authLimiter, emailLimiter };