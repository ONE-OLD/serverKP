# Vercel Express Website

This project is a serverless web application hosted on Vercel, utilizing Express.js for server-side logic and Firebase for authentication. The application serves both public and protected routes, allowing users to access various pages based on their authentication status.

## Project Structure

```
vercel-express-website
├── api
│   └── index.js          # Server-side logic and route definitions
├── public
│   └── index.html        # Main entry point for the public-facing website
├── private-views
│   ├── dashboard.html     # Protected dashboard page
│   ├── apps.html          # Protected apps page
│   ├── tutorials.html      # Protected tutorials page
│   ├── html.html          # Protected HTML page
│   ├── css.html           # Protected CSS page
│   ├── javascript.html     # Protected JavaScript page
│   ├── python.html        # Protected Python page
│   ├── cpp.html           # Protected C++ page
│   ├── mysql.html         # Protected MySQL page
│   ├── profile.html       # Protected profile page
│   ├── news.html          # Protected news page
│   ├── certificate.html    # Protected certificate page
│   └── account.html       # Protected account page
├── package.json           # npm configuration file
├── .env                   # Environment variables
└── README.md              # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd vercel-express-website
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Firebase credentials:
   ```
   FIREBASE_PROJECT_ID=<your-project-id>
   FIREBASE_CLIENT_EMAIL=<your-client-email>
   FIREBASE_PRIVATE_KEY=<your-private-key>
   VERCEL_ENV=development
   ```

4. **Run the application locally:**
   ```
   npm start
   ```

5. **Deploy to Vercel:**
   Follow the Vercel documentation to deploy your application. Ensure that your environment variables are set in the Vercel dashboard.

## Usage

- Access the main page at `https://<your-vercel-url>/`.
- Use the login functionality to access protected routes.
- Navigate to various protected pages such as the dashboard, apps, tutorials, etc., after logging in.

## License

This project is licensed under the MIT License.