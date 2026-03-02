require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const adminRoutes = require('./routes/admin');
const agentRoutes = require('./routes/agent');
const powerRoutes = require('./routes/power');
const autoRoutes = require('./routes/auto');
const { errorHandler } = require('./middleware/errorHandler');

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
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
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
});

module.exports = app;