import express from "express";
import session from "express-session";
import path from "path";
import fs from "fs";
import serverless from "serverless-http";

const app = express();
const __dirname = path.resolve();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "supersecretkey123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

// In-memory users DB
const users = {};

// Middleware to require login
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/");
  }
  next();
}

// Inject sidebar with username
function renderPage(filePath, username) {
  let html = fs.readFileSync(filePath, "utf-8");
  const sidebar = `<div class="sidebar">Logged in as: <strong>${username}</strong></div>`;
  html = html.replace("<!--SIDEBAR-->", sidebar);
  return html;
}

// Index page (login/signup/forget)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "index.html"));
});

// Login handler
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.send("Missing username or password.");
  }
  const user = users[username];
  if (!user || user.password !== password) {
    return res.send("Invalid username or password.");
  }
  req.session.user = username;
  res.redirect("/page1");
});

// Signup handler
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.send("Missing username or password.");
  }
  if (users[username]) {
    return res.send("Username already taken.");
  }
  users[username] = { password };
  req.session.user = username;
  res.redirect("/page1");
});

// Logout handler
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Forget password dummy handler
app.post("/forget", (req, res) => {
  res.send("If this was real, you'd get an email to reset your password.");
});

// Serve 13 protected pages
for (let i = 1; i <= 13; i++) {
  app.get(`/page${i}`, requireLogin, (req, res) => {
    const pagePath = path.join(__dirname, "..", "views", `page${i}.html`);
    if (!fs.existsSync(pagePath)) {
      return res.status(404).send("Page not found");
    }
    const html = renderPage(pagePath, req.session.user);
    res.send(html);
  });
}

// Static files (if needed)
app.use("/static", express.static(path.join(__dirname, "..", "static")));

export const handler = serverless(app);
