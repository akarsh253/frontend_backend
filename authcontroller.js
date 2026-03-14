const crypto = require('crypto');
const User = require('../models/User');
const { generateAuthTokens, verifyRefreshToken, hashToken, generateSecureToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/email');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

// ─────────────────────────────────────────────
// Register Mentor
// ─────────────────────────────────────────────

exports.registerMentor = async (req, res, next) => {
  try {
    const {
      firstName, lastName, email, password,
      country, phoneNumber, avatarUrl,
      mentorProfile,
    } = req.body;

    // Duplicate check
    const existing = await User.findOne({ email });
    if (existing) {
      return errorResponse(res, 'An account with this email already exists.', 409);
    }

    // Create user
    const verificationToken = generateSecureToken();
    const hashedToken = hashToken(verificationToken);

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'mentor',
      country,
      phoneNumber,
      avatarUrl: avatarUrl || null,
      mentorProfile: mentorProfile || {},
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hrs
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(user, verificationToken).catch((err) =>
      console.error('Email send error:', err)
    );

    return successResponse(
      res,
      {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
      'Mentor account created. Please check your email to verify your account.',
      201
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Register Founder
// ─────────────────────────────────────────────

exports.registerFounder = async (req, res, next) => {
  try {
    const {
      firstName, lastName, email, password,
      country, phoneNumber, avatarUrl,
      founderProfile,
    } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return errorResponse(res, 'An account with this email already exists.', 409);
    }

    const verificationToken = generateSecureToken();
    const hashedToken = hashToken(verificationToken);

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'founder',
      country,
      phoneNumber,
      avatarUrl: avatarUrl || null,
      founderProfile: founderProfile || {},
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    sendVerificationEmail(user, verificationToken).catch((err) =>
      console.error('Email send error:', err)
    );

    return successResponse(
      res,
      {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
      'Founder account created. Please check your email to verify your account.',
      201
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Sign In (both roles use same endpoint)
// ─────────────────────────────────────────────

exports.signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Fetch user including password
    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Check account state
    if (!user.isActive) {
      return errorResponse(res, 'This account has been deactivated.', 403);
    }
    if (user.isSuspended) {
      return errorResponse(res, 'This account has been suspended. Please contact support.', 403);
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(user);
    const hashedRefresh = hashToken(refreshToken);

    // Store hashed refresh token (keep max 5 sessions)
    user.refreshTokens = [
      ...(user.refreshTokens || []).slice(-4),
      { token: hashedRefresh, createdAt: new Date() },
    ];
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    // Set refresh token as httpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    return successResponse(
      res,
      {
        accessToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          avatarUrl: user.avatarUrl,
          lastLoginAt: user.lastLoginAt,
        },
      },
      'Signed in successfully.'
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Refresh Access Token
// ─────────────────────────────────────────────

exports.refreshToken = async (req, res, next) => {
  try {
    const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingToken) {
      return errorResponse(res, 'Refresh token not provided.', 401);
    }

    // Verify signature
    let decoded;
    try {
      decoded = verifyRefreshToken(incomingToken);
    } catch {
      return errorResponse(res, 'Invalid or expired refresh token.', 401);
    }

    // Find user and validate stored token
    const user = await User.findById(decoded.sub).select('+refreshTokens');
    if (!user) {
      return errorResponse(res, 'User not found.', 401);
    }

    const hashedIncoming = hashToken(incomingToken);
    const storedEntry = user.refreshTokens?.find((t) => t.token === hashedIncoming);
    if (!storedEntry) {
      // Token reuse detected — rotate all tokens
      user.refreshTokens = [];
      await user.save();
      return errorResponse(res, 'Token reuse detected. All sessions invalidated.', 401);
    }

    // Rotate: remove old, add new
    const { accessToken, refreshToken: newRefreshToken } = generateAuthTokens(user);
    const hashedNew = hashToken(newRefreshToken);

    user.refreshTokens = [
      ...user.refreshTokens.filter((t) => t.token !== hashedIncoming),
      { token: hashedNew, createdAt: new Date() },
    ];
    await user.save();

    setRefreshTokenCookie(res, newRefreshToken);

    return successResponse(res, { accessToken }, 'Token refreshed successfully.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────────

exports.signOut = async (req, res, next) => {
  try {
    const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (incomingToken) {
      const hashedToken = hashToken(incomingToken);
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: { token: hashedToken } },
      });
    }

    clearRefreshTokenCookie(res);
    return successResponse(res, {}, 'Signed out successfully.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Sign Out All Sessions
// ─────────────────────────────────────────────

exports.signOutAll = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshTokens: [] });
    clearRefreshTokenCookie(res);
    return successResponse(res, {}, 'Signed out from all devices.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Verify Email
// ─────────────────────────────────────────────

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return errorResponse(res, 'Verification token is required.', 400);

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return errorResponse(res, 'Invalid or expired verification token.', 400);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email
    sendWelcomeEmail(user).catch(console.error);

    return successResponse(res, {}, 'Email verified successfully. You can now sign in.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Resend Verification Email
// ─────────────────────────────────────────────

exports.resendVerificationEmail = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+emailVerificationToken +emailVerificationExpires'
    );

    if (user.isEmailVerified) {
      return errorResponse(res, 'Email is already verified.', 400);
    }

    const verificationToken = generateSecureToken();
    user.emailVerificationToken = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    sendVerificationEmail(user, verificationToken).catch(console.error);

    return successResponse(res, {}, 'Verification email sent. Please check your inbox.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Forgot Password
// ─────────────────────────────────────────────

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return 200 to prevent email enumeration
    if (!user) {
      return successResponse(
        res,
        {},
        'If an account with that email exists, a password reset link has been sent.'
      );
    }

    const resetToken = generateSecureToken();
    const hashedToken = hashToken(resetToken);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    sendPasswordResetEmail(user, resetToken).catch(console.error);

    return successResponse(
      res,
      {},
      'If an account with that email exists, a password reset link has been sent.'
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens');

    if (!user) {
      return errorResponse(res, 'Invalid or expired password reset token.', 400);
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    clearRefreshTokenCookie(res);

    return successResponse(res, {}, 'Password reset successfully. Please sign in.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Change Password (authenticated)
// ─────────────────────────────────────────────

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password +refreshTokens');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect.', 400);
    }

    user.password = newPassword;
    user.refreshTokens = []; // Log out all other sessions
    await user.save();

    clearRefreshTokenCookie(res);

    return successResponse(res, {}, 'Password changed successfully. Please sign in again.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Get Current User (me)
// ─────────────────────────────────────────────

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return successResponse(res, { user }, 'User profile retrieved.');
  } catch (error) {
    next(error);
  }
};