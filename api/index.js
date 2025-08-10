const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Debug startup
console.log("Starting server...");
console.log("Current directory:", __dirname);
console.log("Public dir exists:", fs.existsSync(path.join(__dirname, '../public')));
console.log("Private-views exists:", fs.existsSync(path.join(__dirname, '../private-views')));

// Initialize Express
const app = express();
const router = express.Router();

// ======================
// Enhanced Middleware
// ======================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files with fallback
const staticDir = path.join(__dirname, '../public');
app.use('/static', express.static(staticDir, {
  fallthrough: false,
  setHeaders: (res) => {
    console.log('Serving static file');
    res.set('X-Static', 'true');
  }
}));

// ======================
// Firebase Init (with retries)
// ======================
let firebaseInitialized = false;
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!privateKey) throw new Error('Missing private key');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      firebaseInitialized = true;
      console.log('🔥 Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase init error:', error);
      setTimeout(initializeFirebase, 2000); // Retry after 2 seconds
    }
  }
};
initializeFirebase();

// ======================
// Routes with Debugging
// ======================

// Debug endpoint
router.get('/debug', (req, res) => {
  res.json({
    status: 'online',
    firebase: firebaseInitialized,
    paths: {
      public: staticDir,
      privateViews: path.join(__dirname, '../private-views')
    }
  });
});

// Enhanced file serving
const serveFile = (filePath) => (req, res) => {
  const absolutePath = path.join(__dirname, filePath);
  console.log('Attempting to serve:', absolutePath);
  
  if (fs.existsSync(absolutePath)) {
    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.error('File send error:', err);
        res.status(500).send('File error');
      }
    });
  } else {
    console.error('File not found:', absolutePath);
    res.status(404).send('Not found');
  }
};

// Public routes
router.get('/', serveFile('../public/index.html'));

// Protected routes
const protectedPages = ['dashboard', 'profile', /* ... */];
protectedPages.forEach(page => {
  router.get(`/${page}`, (req, res, next) => {
    console.log(`Accessing protected route: /${page}`);
    if (!firebaseInitialized) return res.status(503).send('Service unavailable');
    next();
  }, verifySession, serveFile(`../private-views/${page}.html`));
});

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Server error');
});

// ======================
// Serverless Export
// ======================
const handler = serverless(app, {
  binary: ['image/*', 'application/*', 'font/*']
});

// Warmup ping
console.log('Server initialized. Testing handler...');
handler({ path: '/debug', httpMethod: 'GET' }, {})
  .then(response => console.log('Handler test response:', response))
  .catch(err => console.error('Handler test failed:', err));

module.exports.handler = handler;
