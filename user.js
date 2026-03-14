const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────

const mentorProfileSchema = new mongoose.Schema({
  expertise: {
    type: [String],
    required: [true, 'At least one area of expertise is required'],
    validate: {
      validator: (arr) => arr.length > 0 && arr.length <= 10,
      message: 'Provide between 1 and 10 areas of expertise',
    },
  },
  industries: {
    type: [String],
    default: [],
  },
  yearsOfExperience: {
    type: Number,
    min: [0, 'Years of experience cannot be negative'],
    max: [60, 'Please enter a realistic value'],
    required: [true, 'Years of experience is required'],
  },
  currentRole: {
    type: String,
    trim: true,
    maxlength: [100, 'Current role must be under 100 characters'],
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name must be under 100 characters'],
  },
  linkedinUrl: {
    type: String,
    trim: true,
    match: [/^https:\/\/(www\.)?linkedin\.com\/.*/, 'Please enter a valid LinkedIn URL'],
  },
  availability: {
    hoursPerMonth: { type: Number, default: 4, min: 1, max: 40 },
    timezone: { type: String, default: 'UTC' },
    preferredDays: {
      type: [String],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: ['Monday', 'Wednesday', 'Friday'],
    },
  },
  sessionRate: {
    type: Number,
    default: 0, // 0 = pro-bono
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    maxlength: 3,
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [1000, 'Bio must be under 1000 characters'],
  },
  isAcceptingMentees: {
    type: Boolean,
    default: true,
  },
  totalSessions: { type: Number, default: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
}, { _id: false });


const founderProfileSchema = new mongoose.Schema({
  startupName: {
    type: String,
    trim: true,
    required: [true, 'Startup name is required'],
    maxlength: [100, 'Startup name must be under 100 characters'],
  },
  startupStage: {
    type: String,
    enum: ['idea', 'pre-seed', 'seed', 'series-a', 'series-b', 'growth', 'other'],
    required: [true, 'Startup stage is required'],
  },
  industry: {
    type: String,
    trim: true,
    required: [true, 'Industry is required'],
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
  },
  pitchDeck: {
    type: String, // URL to stored deck
    trim: true,
  },
  problemStatement: {
    type: String,
    trim: true,
    maxlength: [500, 'Problem statement must be under 500 characters'],
  },
  targetMarket: {
    type: String,
    trim: true,
    maxlength: [300, 'Target market must be under 300 characters'],
  },
  teamSize: {
    type: Number,
    min: [1, 'Team must have at least 1 member'],
    default: 1,
  },
  fundingRaised: {
    type: Number,
    default: 0,
    min: 0,
  },
  lookingFor: {
    type: [String],
    enum: [
      'technical-mentorship',
      'business-strategy',
      'fundraising',
      'sales-marketing',
      'product-development',
      'legal-compliance',
      'hiring',
      'other',
    ],
    default: [],
  },
  linkedinUrl: {
    type: String,
    trim: true,
    match: [/^https:\/\/(www\.)?linkedin\.com\/.*/, 'Please enter a valid LinkedIn URL'],
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [1000, 'Bio must be under 1000 characters'],
  },
  totalMentorSessions: { type: Number, default: 0 },
}, { _id: false });


// ─────────────────────────────────────────────
// Main User Schema
// ─────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // ── Core identity ──────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name must be under 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name must be under 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default
    },

    // ── Role ──────────────────────────────────
    role: {
      type: String,
      enum: ['mentor', 'founder'],
      required: [true, 'Role is required'],
    },

    // ── Role-specific profiles ─────────────────
    mentorProfile: {
      type: mentorProfileSchema,
      default: null,
    },
    founderProfile: {
      type: founderProfileSchema,
      default: null,
    },

    // ── Avatar ────────────────────────────────
    avatarUrl: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-().]{7,20}$/, 'Please enter a valid phone number'],
    },

    // ── Account state ─────────────────────────
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },

    // ── Email verification token ──────────────
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // ── Password reset ────────────────────────
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // ── Refresh tokens (stored hashed) ────────
    refreshTokens: {
      type: [{ token: String, createdAt: Date }],
      select: false,
      default: [],
    },

    // ── Timestamps ────────────────────────────
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ─────────────────────────────────────────────
// Pre-save middleware
// ─────────────────────────────────────────────

userSchema.pre('save', async function (next) {
  // Only hash when password field is modified
  if (!this.isModified('password')) return next();

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

// ─────────────────────────────────────────────
// Instance methods
// ─────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.hasRole = function (role) {
  return this.role === role;
};

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'mentorProfile.expertise': 1 });
userSchema.index({ 'founderProfile.startupStage': 1 });
userSchema.index({ 'founderProfile.industry': 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;