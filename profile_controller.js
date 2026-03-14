const User = require('../models/User');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

// ─────────────────────────────────────────────
// Get my profile
// ─────────────────────────────────────────────

exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return successResponse(res, { user });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Update base profile (fields common to both roles)
// ─────────────────────────────────────────────

exports.updateBaseProfile = async (req, res, next) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'country', 'phoneNumber', 'avatarUrl'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return successResponse(res, { user }, 'Profile updated successfully.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Update Mentor Profile
// ─────────────────────────────────────────────

exports.updateMentorProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'mentor') {
      return errorResponse(res, 'Only mentors can update a mentor profile.', 403);
    }

    const allowedMentorFields = [
      'expertise', 'industries', 'yearsOfExperience', 'currentRole', 'company',
      'linkedinUrl', 'availability', 'sessionRate', 'currency', 'bio',
      'isAcceptingMentees',
    ];

    const updates = {};
    allowedMentorFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[`mentorProfile.${field}`] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
      new: true,
      runValidators: true,
    });

    return successResponse(res, { user }, 'Mentor profile updated.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Update Founder Profile
// ─────────────────────────────────────────────

exports.updateFounderProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'founder') {
      return errorResponse(res, 'Only founders can update a founder profile.', 403);
    }

    const allowedFounderFields = [
      'startupName', 'startupStage', 'industry', 'website', 'pitchDeck',
      'problemStatement', 'targetMarket', 'teamSize', 'fundingRaised',
      'lookingFor', 'linkedinUrl', 'bio',
    ];

    const updates = {};
    allowedFounderFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[`founderProfile.${field}`] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
      new: true,
      runValidators: true,
    });

    return successResponse(res, { user }, 'Founder profile updated.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Get public profile by ID
// ─────────────────────────────────────────────

exports.getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.params.userId,
      isActive: true,
      isSuspended: false,
    }).select(
      'firstName lastName role avatarUrl country mentorProfile founderProfile createdAt'
    );

    if (!user) return errorResponse(res, 'User not found.', 404);

    return successResponse(res, { user });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Browse Mentors (with filters & pagination)
// ─────────────────────────────────────────────

exports.browseMentors = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      expertise,
      industry,
      minYears,
      maxRate,
      accepting,
      country,
      search,
    } = req.query;

    const query = { role: 'mentor', isActive: true, isSuspended: false };

    if (expertise) {
      query['mentorProfile.expertise'] = {
        $in: expertise.split(',').map((e) => new RegExp(e.trim(), 'i')),
      };
    }
    if (industry) {
      query['mentorProfile.industries'] = {
        $in: industry.split(',').map((i) => new RegExp(i.trim(), 'i')),
      };
    }
    if (minYears) {
      query['mentorProfile.yearsOfExperience'] = { $gte: parseInt(minYears) };
    }
    if (maxRate !== undefined) {
      query['mentorProfile.sessionRate'] = { $lte: parseFloat(maxRate) };
    }
    if (accepting === 'true') {
      query['mentorProfile.isAcceptingMentees'] = true;
    }
    if (country) {
      query.country = new RegExp(country, 'i');
    }
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { 'mentorProfile.currentRole': new RegExp(search, 'i') },
        { 'mentorProfile.company': new RegExp(search, 'i') },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    const mentors = await User.find(query)
      .select('firstName lastName avatarUrl country mentorProfile createdAt')
      .sort({ 'mentorProfile.rating': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return paginatedResponse(
      res,
      { mentors },
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      'Mentors retrieved.'
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Browse Founders
// ─────────────────────────────────────────────

exports.browseFounders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      stage,
      industry,
      lookingFor,
      search,
    } = req.query;

    const query = { role: 'founder', isActive: true, isSuspended: false };

    if (stage) {
      query['founderProfile.startupStage'] = {
        $in: stage.split(',').map((s) => s.trim()),
      };
    }
    if (industry) {
      query['founderProfile.industry'] = new RegExp(industry, 'i');
    }
    if (lookingFor) {
      query['founderProfile.lookingFor'] = {
        $in: lookingFor.split(',').map((l) => l.trim()),
      };
    }
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { 'founderProfile.startupName': new RegExp(search, 'i') },
        { 'founderProfile.industry': new RegExp(search, 'i') },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    const founders = await User.find(query)
      .select('firstName lastName avatarUrl country founderProfile createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return paginatedResponse(
      res,
      { founders },
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      'Founders retrieved.'
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Deactivate account
// ─────────────────────────────────────────────

exports.deactivateAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isActive: false,
      refreshTokens: [],
    });
    res.clearCookie('refreshToken');
    return successResponse(res, {}, 'Account deactivated. We\'re sorry to see you go.');
  } catch (error) {
    next(error);
  }
};