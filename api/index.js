import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const app = express();

const __dirnamePath = path.resolve();
const publicDir = path.join(__dirnamePath, 'public');
const privateViewsDir = path.join(__dirnamePath, 'private-views');

if (!fs.existsSync(publicDir) || !fs.existsSync(privateViewsDir)) {
  console.error('Missing required directories');
  process.exit(1);
}

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(publicDir));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

const checkAuth = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  try {
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
    req.user = decodedClaims;
    next();
  } catch (error) {
    console.error('Authentication failed:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.redirect('/');
  }
};

async function logActivity(userId, action) {
  await db.collection('userActivity')
    .doc(userId)
    .collection('logs')
    .add({
      action,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/sessionLogin', async (req, res) => {
  try {
    const sessionCookie = await admin.auth().createSessionCookie(req.body.idToken, {
      expiresIn: 60 * 60 * 1000,
    });

    const decodedToken = await admin.auth().verifyIdToken(req.body.idToken);
    await logActivity(decodedToken.uid, 'login');

    res.cookie('session', sessionCookie, {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' ? true : false, // secure false on dev
      sameSite: 'lax',
      path: '/',
    });

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/sessionLogout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ status: 'logged out' });
});

app.get('/api/activity-history', checkAuth, async (req, res) => {
  try {
    const logsRef = db.collection('userActivity')
      .doc(req.user.uid)
      .collection('logs')
      .orderBy('timestamp', 'desc')
      .limit(20);

    const snapshot = await logsRef.get();
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ history });
  } catch (error) {
    console.error('Error fetching activity history:', error);
    res.status(500).json({ error: 'Failed to fetch activity history' });
  }
});

app.post('/api/log-activity', checkAuth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required' });
    await logActivity(req.user.uid, action);
    res.json({ status: 'logged' });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

const protectedRoutes = [
  'dashboard', 'apps', 'tutorials', 'html', 'css',
  'javascript', 'python', 'cpp', 'mysql', 'profile',
  'news', 'certificate', 'account'
];

protectedRoutes.forEach(route => {
  app.get(`/${route}`, checkAuth, (req, res) => {
    res.sendFile(path.join(privateViewsDir, `${route}.html`));
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
