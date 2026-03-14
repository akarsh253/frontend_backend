require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║        🚀 MentorHub API Server           ║
╠═══════════════════════════════════════════╣
║  Status  : Running                        ║
║  Port    : ${PORT}                             ║
║  Mode    : ${(process.env.NODE_ENV || 'development').padEnd(27)}║
╚═══════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('✅ HTTP server closed.');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('Unhandled Rejection');
  });

  process.on('uncaughtException', (error) => {
    console.error('🔥 Uncaught Exception:', error);
    shutdown('Uncaught Exception');
  });
};

startServer();