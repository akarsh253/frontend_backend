const express = require('express');
const router = express.Router();

const {
  registerMentor,
  registerFounder,
  signIn,
  refreshToken,
  signOut,
  signOutAll,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

const {
  validate,
  registerMentorRules,
  registerFounderRules,
  signInRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
} = require('../middleware/validators');

// ── Registration ──────────────────────────────────────────────

/**
 * @route  POST /api/auth/register/mentor
 * @desc   Register a new mentor account
 * @access Public
 */
router.post(
  '/register/mentor',
  registerMentorRules,
  validate,
  registerMentor
);

/**
 * @route  POST /api/auth/register/founder
 * @desc   Register a new startup founder account
 * @access Public
 */
router.post(
  '/register/founder',
  registerFounderRules,
  validate,
  registerFounder
);

// ── Authentication ────────────────────────────────────────────

/**
 * @route  POST /api/auth/signin
 * @desc   Sign in (works for both roles)
 * @access Public
 */
router.post('/signin', signInRules, validate, signIn);

/**
 * @route  POST /api/auth/refresh
 * @desc   Refresh access token using refresh token (cookie or body)
 * @access Public
 */
router.post('/refresh', refreshToken);

/**
 * @route  POST /api/auth/signout
 * @desc   Sign out current session
 * @access Private
 */
router.post('/signout', protect, signOut);

/**
 * @route  POST /api/auth/signout-all
 * @desc   Sign out from all devices
 * @access Private
 */
router.post('/signout-all', protect, signOutAll);

// ── Email Verification ────────────────────────────────────────

/**
 * @route  GET /api/auth/verify-email/:token
 * @desc   Verify email address with token from email link
 * @access Public
 */
router.get('/verify-email/:token', verifyEmail);

/**
 * @route  POST /api/auth/resend-verification
 * @desc   Resend verification email
 * @access Private
 */
router.post('/resend-verification', protect, resendVerificationEmail);

// ── Password Management ───────────────────────────────────────

/**
 * @route  POST /api/auth/forgot-password
 * @desc   Request a password reset email
 * @access Public
 */
router.post('/forgot-password', forgotPasswordRules, validate, forgotPassword);

/**
 * @route  POST /api/auth/reset-password
 * @desc   Reset password with token from email
 * @access Public
 */
router.post('/reset-password', resetPasswordRules, validate, resetPassword);

/**
 * @route  PATCH /api/auth/change-password
 * @desc   Change password (must know current password)
 * @access Private
 */
router.patch('/change-password', protect, changePasswordRules, validate, changePassword);

// ── Current User ──────────────────────────────────────────────

/**
 * @route  GET /api/auth/me
 * @desc   Get current authenticated user's profile
 * @access Private
 */
router.get('/me', protect, getMe);

module.exports = router;