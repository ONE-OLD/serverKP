const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

// Debugging - Verify environment variables
console.log('Checking Firebase env vars:', {
  hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
  hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
  hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY?.length > 0
});

// Initialize Express
const app = express();
const router = express.Router();

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
app.use('/static', express.static(path.join(__dirname, '../public')));

// ======================
// Firebase Initialization (Serverless-safe)
// ======================
if (admin.apps.length === 0) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Missing Firebase environment variables');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('FATAL: Firebase init failed:', error);
    process.exit(1); // Crash immediately if Firebase fails
  }
}

// ======================
// Authentication Middleware
// ======================
const verifySession = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  
  try {
    await admin.auth().verifySessionCookie(sessionCookie, true);
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ======================
// Route Definitions
// ======================

// Health Check (for debugging)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', firebase: admin.apps.length > 0 });
});

// Public Routes
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Auth Endpoints
router.post('/sessionLogin', async (req, res) => {
  const { idToken } = req.body;
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
    
    res.cookie('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

router.get('/sessionLogout', (req, res) => {
  res.clearCookie('session', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  });
  res.redirect('/');
});

// Protected Routes
const protectedPages = [
  'dashboard', 'apps', 'tutorials', 'html', 'css',
  'javascript', 'python', 'cpp', 'mysql', 'profile',
  'news', 'certificate', 'account'
];

protectedPages.forEach(page => {
  router.get(`/${page}`, verifySession, (req, res) => {
    try {
      res.sendFile(path.join(__dirname, '../private-views', `${page}.html`));
    } catch (error) {
      console.error(`Failed to load ${page}:`, error);
      res.status(404).json({ error: 'Page not found' });
    }
  });
});

// ======================
// Serverless Configuration
// ======================
app.use('/api', router); // Primary endpoint
app.use('/', router);    // Fallback

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel-required export
const handler = serverless(app);
module.exports = handler; // Critical: Default export
