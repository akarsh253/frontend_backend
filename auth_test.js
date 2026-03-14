const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

// ─────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mentor_startup_test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

afterEach(async () => {
  await User.deleteMany({});
});

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const mentorPayload = {
  firstName: 'Arjun',
  lastName: 'Sharma',
  email: 'arjun.mentor@test.com',
  password: 'Test@1234',
  country: 'India',
  mentorProfile: {
    expertise: ['Product Management', 'Go-to-Market'],
    yearsOfExperience: 10,
    currentRole: 'VP Product',
    company: 'TechCorp',
    bio: 'Helping founders build great products.',
    sessionRate: 50,
  },
};

const founderPayload = {
  firstName: 'Priya',
  lastName: 'Kapoor',
  email: 'priya.founder@test.com',
  password: 'Test@1234',
  country: 'India',
  founderProfile: {
    startupName: 'AgroAI',
    startupStage: 'seed',
    industry: 'AgriTech',
    problemStatement: 'Helping farmers optimize crop yield using AI.',
    teamSize: 4,
    lookingFor: ['fundraising', 'product-development'],
  },
};

// ─────────────────────────────────────────────
// MENTOR REGISTRATION
// ─────────────────────────────────────────────

describe('POST /api/auth/register/mentor', () => {
  it('should register a mentor successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register/mentor')
      .send(mentorPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('mentor');
    expect(res.body.data.user.email).toBe(mentorPayload.email);
    expect(res.body.data.user.isEmailVerified).toBe(false);
  });

  it('should reject duplicate email', async () => {
    await request(app).post('/api/auth/register/mentor').send(mentorPayload);
    const res = await request(app).post('/api/auth/register/mentor').send(mentorPayload);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing required mentor fields', async () => {
    const { mentorProfile, ...withoutProfile } = mentorPayload;
    const res = await request(app)
      .post('/api/auth/register/mentor')
      .send({ ...withoutProfile, mentorProfile: { expertise: [], yearsOfExperience: 5 } });

    expect(res.statusCode).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('should reject weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register/mentor')
      .send({ ...mentorPayload, password: 'weakpass' });

    expect(res.statusCode).toBe(422);
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register/mentor')
      .send({ ...mentorPayload, email: 'not-an-email' });

    expect(res.statusCode).toBe(422);
  });
});

// ─────────────────────────────────────────────
// FOUNDER REGISTRATION
// ─────────────────────────────────────────────

describe('POST /api/auth/register/founder', () => {
  it('should register a founder successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register/founder')
      .send(founderPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('founder');
    expect(res.body.data.user.email).toBe(founderPayload.email);
  });

  it('should reject missing startup name', async () => {
    const payload = {
      ...founderPayload,
      founderProfile: { ...founderPayload.founderProfile, startupName: '' },
    };
    const res = await request(app).post('/api/auth/register/founder').send(payload);
    expect(res.statusCode).toBe(422);
  });

  it('should reject invalid startup stage', async () => {
    const payload = {
      ...founderPayload,
      founderProfile: { ...founderPayload.founderProfile, startupStage: 'unicorn' },
    };
    const res = await request(app).post('/api/auth/register/founder').send(payload);
    expect(res.statusCode).toBe(422);
  });
});

// ─────────────────────────────────────────────
// SIGN IN
// ─────────────────────────────────────────────

describe('POST /api/auth/signin', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register/mentor').send(mentorPayload);
  });

  it('should sign in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/signin').send({
      email: mentorPayload.email,
      password: mentorPayload.password,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('mentor');
    // Check httpOnly cookie was set
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject wrong password', async () => {
    const res = await request(app).post('/api/auth/signin').send({
      email: mentorPayload.email,
      password: 'WrongPass@99',
    });
    expect(res.statusCode).toBe(401);
  });

  it('should reject non-existent email', async () => {
    const res = await request(app).post('/api/auth/signin').send({
      email: 'nobody@test.com',
      password: 'Test@1234',
    });
    expect(res.statusCode).toBe(401);
  });

  it('should reject missing password', async () => {
    const res = await request(app).post('/api/auth/signin').send({
      email: mentorPayload.email,
    });
    expect(res.statusCode).toBe(422);
  });
});

// ─────────────────────────────────────────────
// GET ME
// ─────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let accessToken;

  beforeEach(async () => {
    await request(app).post('/api/auth/register/mentor').send(mentorPayload);
    const signin = await request(app).post('/api/auth/signin').send({
      email: mentorPayload.email,
      password: mentorPayload.password,
    });
    accessToken = signin.body.data.accessToken;
  });

  it('should return current user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(mentorPayload.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshTokens).toBeUndefined();
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register/mentor').send(mentorPayload);
  });

  it('should return 200 for registered email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: mentorPayload.email });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for unregistered email (anti-enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@nowhere.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────

describe('POST /api/auth/signout', () => {
  let accessToken;

  beforeEach(async () => {
    await request(app).post('/api/auth/register/mentor').send(mentorPayload);
    const signin = await request(app).post('/api/auth/signin').send({
      email: mentorPayload.email,
      password: mentorPayload.password,
    });
    accessToken = signin.body.data.accessToken;
  });

  it('should sign out and clear cookie', async () => {
    const res = await request(app)
      .post('/api/auth/signout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject signout without token', async () => {
    const res = await request(app).post('/api/auth/signout');
    expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────

describe('GET /api/health', () => {
  it('should return 200 with server status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBeDefined();
  });
});