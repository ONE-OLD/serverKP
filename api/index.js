const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// 1. INITIALIZATION =================================
console.log('🚀 Starting server initialization...');

// Verify directories
const publicDir = path.join(__dirname, '../public');
const privateViewsDir = path.join(__dirname, '../private-views');

if (!fs.existsSync(publicDir) || !fs.existsSync(privateViewsDir)) {
  console.error('💥 Missing required directories');
  process.exit(1);
}

// 2. FIREBASE SETUP =================================
let firebaseApp;
try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    })
  });
  console.log('🔥 Firebase initialized');
} catch (firebaseError) {
  console.error('❌ Firebase init failed:', firebaseError);
  process.exit(1);
}

// 3. AUTH MIDDLEWARE ================================
const verifySession = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  
  try {
    await admin.auth().verifySessionCookie(sessionCookie, true);
    next();
  } catch (error) {
    console.error('🔒 Auth failed:', error.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// 4. EXPRESS APP ====================================
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 5. ROUTES ========================================
const router = express.Router();

// Health check
router.get('/_health', (req, res) => {
  res.json({ 
    status: 'ok',
    firebase: !!firebaseApp,
    time: new Date().toISOString()
  });
});

// Public routes
router.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Auth endpoints
router.post('/sessionLogin', async (req, res) => {
  try {
    const sessionCookie = await admin.auth().createSessionCookie(req.body.idToken, {
      expiresIn: 60 * 60 * 24 * 5 * 1000 // 5 days
    });
    
    res.cookie('session', sessionCookie, {
      maxAge: 86400000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    
    res.json({ status: 'success' });
  } catch (error) {
    res.status(401).json({ error: 'Login failed' });
  }
});

// Protected routes
[
  'dashboard', 'apps', 'tutorials', 'html', 'css',
  'javascript', 'python', 'cpp', 'mysql', 'profile',
  'news', 'certificate', 'account'
].forEach(page => {
  router.get(`/${page}`, verifySession, (req, res) => {
    res.sendFile(path.join(privateViewsDir, `${page}.html`));
  });
});

// 6. ERROR HANDLING ================================
app.use((err, req, res, next) => {
  console.error('💥 Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 7. SERVERLESS EXPORT ============================
const handler = serverless(app);
console.log('✅ Server initialized successfully');

module.exports = { 
  handler,
  // For testing
  _app: app,
  _verifySession: verifySession
};
