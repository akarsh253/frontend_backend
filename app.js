const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { apiLimiter, authLimiter, emailLimiter } = require('./config/rateLimiter');
const { notFound, globalErrorHandler } = require('./middleware/errorHandler');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');

const app = express();

// ─────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Trust proxy (for accurate IPs behind load balancer)
app.set('trust proxy', 1);

// ─────────────────────────────────────────────
// General Middleware
// ─────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────

app.use('/api', apiLimiter);
app.use('/api/auth/signin', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', emailLimiter);
app.use('/api/auth/resend-verification', emailLimiter);

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'MentorHub API',
    version: '1.0.0',
    description: 'Backend API for Mentor & Startup Founder platform',
    docs: '/api/health',
    endpoints: {
      auth: '/api/auth',
      profiles: '/api/profiles',
      health: '/api/health',
    },
  });
});

// ─────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────

app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;