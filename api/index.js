const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Express
const app = express();

// ======================
// Configuration
// ======================
const publicDir = path.join(__dirname, '../public');
const privateViewsDir = path.join(__dirname, '../private-views');

// Verify directories exist
if (!fs.existsSync(publicDir) || !fs.existsSync(privateViewsDir)) {
  console.error('Missing required directories');
  process.exit(1);
}

// ======================
// Middleware
// ======================
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(publicDir));

// Cache control headers
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ======================
// Firebase Initialization
// ======================
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    process.exit(1);
  }
}

// ======================
// Authentication Middleware
// ======================
const checkAuth = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  
  try {
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
    req.user = decodedClaims;
    next();
  } catch (error) {
    console.error('Authentication failed:', error);
    res.redirect('/');
  }
};

// ======================
// Routes
// ======================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/sessionLogin', async (req, res) => {
  try {
    const sessionCookie = await admin.auth().createSessionCookie(req.body.idToken, {
      expiresIn: 60 * 60 * 1000 // 1 hour
    });
    
    res.cookie('session', sessionCookie, {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Protected routes
const protectedRoutes = [
  'dashboard', 'apps', 'tutorials', 'html', 'css',
  'javascript', 'python', 'cpp', 'mysql', 'profile',
  'news', 'certificate', 'account'
];

protectedRoutes.forEach(route => {
  app.get(`/api/${route}`, checkAuth, (req, res) => {
    res.sendFile(path.join(privateViewsDir, `${route}.html`));
  });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ======================
// Serverless Export
// ======================
module.exports.handler = serverless(app, {
  binary: ['image/*', 'application/*', 'text/*']
});
