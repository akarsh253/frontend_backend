const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate a signed JWT access token (short-lived)
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    issuer: 'mentor-startup-api',
    audience: 'mentor-startup-client',
  });
};

/**
 * Generate a signed JWT refresh token (long-lived)
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'mentor-startup-api',
    audience: 'mentor-startup-client',
  });
};

/**
 * Verify an access token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    issuer: 'mentor-startup-api',
    audience: 'mentor-startup-client',
  });
};

/**
 * Verify a refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: 'mentor-startup-api',
    audience: 'mentor-startup-client',
  });
};

/**
 * Generate a secure random token (for email verification, password reset)
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token for safe storage in DB
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Build the standard auth token pair and payload
 */
const generateAuthTokens = (user) => {
  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};

/**
 * Calculate token expiry date
 */
const getTokenExpiry = (durationMs) => {
  return new Date(Date.now() + durationMs);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
  generateAuthTokens,
  getTokenExpiry,
};