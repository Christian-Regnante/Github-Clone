const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
  // Store the access token in the user object
  profile.accessToken = accessToken;
  return done(null, profile);
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Serve static files from frontend directory (for Docker container)
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Middleware to check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Routes

// Serve index.html at root (for Docker container)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    message: 'GitHub Clone Backend is running!',
    authenticated: req.isAuthenticated()
  });
});

// GitHub OAuth login
app.get('/auth/github', passport.authenticate('github', { 
  scope: ['user:email', 'public_repo'] 
}));

// GitHub OAuth callback
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Successful authentication - redirect to dashboard on same port
    res.redirect('/dashboard.html');
  }
);

// Authentication failure
app.get('/auth/failure', (req, res) => {
  res.status(401).json({ error: 'Authentication failed' });
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// Get authenticated user's profile
app.get('/api/user', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitHub-Clone-App'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching user data:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get authenticated user's repositories
app.get('/api/repos', ensureAuthenticated, async (req, res) => {
  try {
    const { sort = 'updated', per_page = 100 } = req.query;
    
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitHub-Clone-App'
      },
      params: {
        sort,
        per_page,
        type: 'all'
      }
    });

    // Transform the data to include only relevant fields
    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      watchers_count: repo.watchers_count,
      size: repo.size,
      default_branch: repo.default_branch,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      private: repo.private,
      fork: repo.fork,
      archived: repo.archived,
      disabled: repo.disabled,
      topics: repo.topics || []
    }));

    res.json(repos);
  } catch (error) {
    console.error('Error fetching repositories:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get user's GitHub statistics
app.get('/api/stats', ensureAuthenticated, async (req, res) => {
  try {
    const [userResponse, reposResponse] = await Promise.all([
      axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${req.user.accessToken}`,
          'User-Agent': 'GitHub-Clone-App'
        }
      }),
      axios.get('https://api.github.com/user/repos', {
        headers: {
          'Authorization': `token ${req.user.accessToken}`,
          'User-Agent': 'GitHub-Clone-App'
        },
        params: {
          per_page: 100,
          type: 'all'
        }
      })
    ]);

    const user = userResponse.data;
    const repos = reposResponse.data;

    // Calculate stats
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
    const languages = {};
    
    repos.forEach(repo => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    });

    const stats = {
      public_repos: user.public_repos,
      followers: user.followers,
      following: user.following,
      total_stars: totalStars,
      total_forks: totalForks,
      languages: Object.entries(languages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5) // Top 5 languages
        .map(([lang, count]) => ({ language: lang, count }))
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      profileUrl: req.user.profileUrl,
      photos: req.user.photos
    } : null
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GitHub Clone Backend running on http://localhost:${PORT}`);
  console.log(`📝 Make sure to set up your GitHub OAuth App with:`);
  console.log(`   - Homepage URL: http://localhost:${PORT}`);
  console.log(`   - Callback URL: http://localhost:${PORT}/auth/github/callback`);
  console.log(`⚙️  Don't forget to update your .env file with GitHub OAuth credentials!`);
});