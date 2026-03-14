const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

// ─────────────────────────────────────────────
// Validation runner middleware
// ─────────────────────────────────────────────

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return errorResponse(res, 'Validation failed', 422, formattedErrors);
  }
  next();
};

// ─────────────────────────────────────────────
// Reusable field validators
// ─────────────────────────────────────────────

const emailField = () =>
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail();

const passwordField = (fieldName = 'password') =>
  body(fieldName)
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character');

// ─────────────────────────────────────────────
// Register Mentor
// ─────────────────────────────────────────────

const registerMentorRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),

  body('lastName').trim().notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),

  emailField(),
  passwordField(),

  body('country').optional().trim()
    .isLength({ max: 60 }).withMessage('Country name too long'),

  body('phoneNumber').optional().trim()
    .matches(/^\+?[\d\s\-().]{7,20}$/).withMessage('Invalid phone number format'),

  // Mentor-specific
  body('mentorProfile.expertise')
    .isArray({ min: 1, max: 10 }).withMessage('Provide 1–10 areas of expertise')
    .custom((arr) => arr.every((e) => typeof e === 'string' && e.trim().length > 0))
    .withMessage('Each expertise must be a non-empty string'),

  body('mentorProfile.yearsOfExperience')
    .notEmpty().withMessage('Years of experience is required')
    .isInt({ min: 0, max: 60 }).withMessage('Years of experience must be 0–60'),

  body('mentorProfile.currentRole').optional().trim()
    .isLength({ max: 100 }).withMessage('Current role too long'),

  body('mentorProfile.company').optional().trim()
    .isLength({ max: 100 }).withMessage('Company name too long'),

  body('mentorProfile.industries').optional().isArray(),

  body('mentorProfile.bio').optional().trim()
    .isLength({ max: 1000 }).withMessage('Bio must be under 1000 characters'),

  body('mentorProfile.sessionRate').optional()
    .isFloat({ min: 0 }).withMessage('Session rate must be a non-negative number'),

  body('mentorProfile.linkedinUrl').optional().trim()
    .matches(/^https:\/\/(www\.)?linkedin\.com\/.*/).withMessage('Invalid LinkedIn URL'),

  body('mentorProfile.availability.hoursPerMonth').optional()
    .isInt({ min: 1, max: 40 }).withMessage('Hours per month must be 1–40'),

  body('mentorProfile.availability.timezone').optional().trim(),

  body('mentorProfile.availability.preferredDays').optional().isArray(),
];

// ─────────────────────────────────────────────
// Register Founder
// ─────────────────────────────────────────────

const registerFounderRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),

  body('lastName').trim().notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),

  emailField(),
  passwordField(),

  body('country').optional().trim()
    .isLength({ max: 60 }).withMessage('Country name too long'),

  body('phoneNumber').optional().trim()
    .matches(/^\+?[\d\s\-().]{7,20}$/).withMessage('Invalid phone number format'),

  // Founder-specific
  body('founderProfile.startupName')
    .trim().notEmpty().withMessage('Startup name is required')
    .isLength({ max: 100 }).withMessage('Startup name must be under 100 characters'),

  body('founderProfile.startupStage')
    .notEmpty().withMessage('Startup stage is required')
    .isIn(['idea', 'pre-seed', 'seed', 'series-a', 'series-b', 'growth', 'other'])
    .withMessage('Invalid startup stage'),

  body('founderProfile.industry')
    .trim().notEmpty().withMessage('Industry is required'),

  body('founderProfile.website').optional().trim()
    .matches(/^https?:\/\/.+/).withMessage('Please enter a valid URL'),

  body('founderProfile.problemStatement').optional().trim()
    .isLength({ max: 500 }).withMessage('Problem statement must be under 500 characters'),

  body('founderProfile.targetMarket').optional().trim()
    .isLength({ max: 300 }).withMessage('Target market must be under 300 characters'),

  body('founderProfile.teamSize').optional()
    .isInt({ min: 1 }).withMessage('Team size must be at least 1'),

  body('founderProfile.lookingFor').optional().isArray(),

  body('founderProfile.linkedinUrl').optional().trim()
    .matches(/^https:\/\/(www\.)?linkedin\.com\/.*/).withMessage('Invalid LinkedIn URL'),

  body('founderProfile.bio').optional().trim()
    .isLength({ max: 1000 }).withMessage('Bio must be under 1000 characters'),
];

// ─────────────────────────────────────────────
// Sign In
// ─────────────────────────────────────────────

const signInRules = [
  emailField(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─────────────────────────────────────────────
// Forgot / Reset Password
// ─────────────────────────────────────────────

const forgotPasswordRules = [emailField()];

const resetPasswordRules = [
  body('token').notEmpty().withMessage('Reset token is required'),
  passwordField('password'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('Passwords do not match');
      return true;
    }),
];

// ─────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordField('newPassword'),
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) throw new Error('Passwords do not match');
      return true;
    }),
];

module.exports = {
  validate,
  registerMentorRules,
  registerFounderRules,
  signInRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
};