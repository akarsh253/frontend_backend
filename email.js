const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────
// Transporter
// ─────────────────────────────────────────────

const createTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    // Use ethereal / mock during tests
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─────────────────────────────────────────────
// Template helpers
// ─────────────────────────────────────────────

const baseTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #e94560; margin: 0; font-size: 28px; letter-spacing: -0.5px; }
    .header p { color: #a0aec0; margin: 6px 0 0; font-size: 14px; }
    .body { padding: 40px; }
    .body h2 { color: #1a1a2e; margin-top: 0; }
    .body p { color: #4a5568; line-height: 1.7; }
    .btn { display: inline-block; background: #e94560; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px 40px; text-align: center; }
    .footer p { color: #a0aec0; font-size: 13px; margin: 0; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .badge { display: inline-block; background: #ebf8ff; color: #2b6cb0; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MentorHub</h1>
      <p>Connecting Mentors & Founders</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MentorHub. All rights reserved.</p>
      <p style="margin-top:8px;">If you didn't request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

// ─────────────────────────────────────────────
// Email senders
// ─────────────────────────────────────────────

/**
 * Send email verification link
 */
const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const roleLabel = user.role === 'mentor' ? '🧑‍💼 Mentor' : '🚀 Founder';

  const content = `
    <span class="badge">${roleLabel}</span>
    <h2>Welcome, ${user.firstName}! 👋</h2>
    <p>Thanks for joining MentorHub. To activate your account, please verify your email address by clicking the button below.</p>
    <p style="text-align:center;">
      <a href="${verifyUrl}" class="btn">Verify My Email</a>
    </p>
    <hr class="divider"/>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;font-size:13px;color:#718096;">${verifyUrl}</p>
    <p style="color:#a0aec0;font-size:13px;"><strong>This link expires in 24 hours.</strong></p>
  `;

  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@mentorhub.com',
    to: user.email,
    subject: '✅ Verify your MentorHub email address',
    html: baseTemplate('Email Verification – MentorHub', content),
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const content = `
    <h2>Password Reset Request</h2>
    <p>Hi ${user.firstName}, we received a request to reset your MentorHub password.</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="btn">Reset My Password</a>
    </p>
    <hr class="divider"/>
    <p>Or copy and paste this link:</p>
    <p style="word-break:break-all;font-size:13px;color:#718096;">${resetUrl}</p>
    <p style="color:#e53e3e;font-size:13px;"><strong>⚠️ This link expires in 1 hour.</strong></p>
    <p>If you didn't request a password reset, your account is safe — just ignore this email.</p>
  `;

  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@mentorhub.com',
    to: user.email,
    subject: '🔐 Reset your MentorHub password',
    html: baseTemplate('Password Reset – MentorHub', content),
  });
};

/**
 * Send welcome email after verification
 */
const sendWelcomeEmail = async (user) => {
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  const isMentor = user.role === 'mentor';

  const content = `
    <h2>You're all set, ${user.firstName}! 🎉</h2>
    <p>Your ${isMentor ? 'mentor' : 'founder'} account has been verified and is now active.</p>
    ${isMentor
      ? '<p>You can now start browsing founders looking for guidance, set your availability, and begin making an impact.</p>'
      : '<p>You can now browse available mentors, book sessions, and accelerate your startup journey.</p>'
    }
    <p style="text-align:center;">
      <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
    </p>
  `;

  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@mentorhub.com',
    to: user.email,
    subject: `🚀 Welcome to MentorHub, ${user.firstName}!`,
    html: baseTemplate('Welcome to MentorHub!', content),
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};