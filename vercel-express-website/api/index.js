const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Express app
const app = express();
const router = express.Router();

// ======================
// Serverless Middleware
// ======================
app.use(cors({
  origin: true, // Reflect request origin
  credentials: true // Required for cookies
}));

app.use(express.json()); // Built-in body parser (replaces body-parser)
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ======================
// Firebase Admin Setup (Serverless-safe)
// ======================
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

// ======================
// Authentication Middleware (Optimized for Serverless)
// ======================
const verifySession = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  
  try {
    await admin.auth().verifySessionCookie(sessionCookie, true);
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// ======================
// API Routes (Serverless-ready)
// ======================

// Health Check
router.get('/.netlify/functions/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth Endpoints
router.post('/api/sessionLogin', async (req, res) => {
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

// Protected API Example
router.get('/api/protected-data', verifySession, (req, res) => {
  res.json({ secretData: 'This is protected content' });
});

// ======================
// Serverless Configuration
// ======================
app.use('/.netlify/functions/api', router); // Netlify compatibility
app.use('/api', router); // Vercel primary endpoint
app.use('/', router); // Fallback

// Error handling (Serverless-optimized)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export the serverless-wrapped app
module.exports.handler = serverless(app, {
  binary: [
    'image/*',
    'font/*',
    'application/*'
  ]
});
