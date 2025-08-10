const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Express app
const app = express();
const router = express.Router();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Firebase Admin Initialization
if (admin.apps.length === 0) {
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
  }
}

// Authentication Middleware
const verifySession = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  try {
    await admin.auth().verifySessionCookie(sessionCookie, true);
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Routes
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
    res.status(401).json({ error: 'Login failed' });
  }
});

router.get('/sessionLogout', (req, res) => {
  res.clearCookie('session');
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
    res.sendFile(path.join(__dirname, '../private-views', `${page}.html`));
  });
});

// Mount router
app.use('/.netlify/functions/api', router); // For local testing
app.use('/api', router); // Vercel primary endpoint
app.use('/', router); // Fallback

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Vercel requires this specific export format
const handler = serverless(app);
module.exports = { handler }; // Correct named export
