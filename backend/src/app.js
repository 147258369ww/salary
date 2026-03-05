require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const adminRoutes = require('./routes/admin');
const agentRoutes = require('./routes/agent');
const powerRoutes = require('./routes/power');
const autoRoutes = require('./routes/auto');
const { errorHandler } = require('./middleware/errorHandler');
const { startPowerScheduler } = require('./services/powerScheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Parse CORS origins from environment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: isProduction, // 生产环境true，开发环境false
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax', // 生产环境none允许跨站，开发环境lax
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/agent/power', powerRoutes);
app.use('/api/agent/auto-tasks', autoRoutes);
app.use('/api/agent/power', powerRoutes);
app.use('/api/agent/auto-tasks', autoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // 启动电量自动消耗调度器（每小时减少电量）
  startPowerScheduler();
});

module.exports = app;