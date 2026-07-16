import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './database.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON payloads and URL encoded forms
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- API ENDPOINTS ---

  // User Registration
  app.post('/api/auth/register', (req, res) => {
    const { fullname, voterid, email, phone, password, confirmPassword } = req.body;

    // Field validations
    if (!fullname || !voterid || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All registration fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Password strength check (at least 6 characters, includes a number)
    const hasNum = /\d/.test(password);
    if (password.length < 6 || !hasNum) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long and contain at least one number.'
      });
    }

    const result = db.registerUser({
      fullname,
      voterid,
      email,
      phone,
      passwordPlain: password
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Return user (excluding passwordHash)
    const { passwordHash, ...userResponse } = result.user!;
    res.status(201).json({ success: true, message: result.message, user: userResponse });
  });

  // User Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const loginHash = db.hashPassword(password);
    if (user.passwordHash !== loginHash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Secure successful login (omit hash)
    const { passwordHash, ...userResponse } = user;
    res.json({ success: true, message: 'Login successful!', user: userResponse });
  });

  // Fetch Current User Details (Session/Header validation helper)
  app.get('/api/auth/me', (req, res) => {
    const userId = req.headers.authorization;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. No session provided.' });
    }

    const user = db.getUserById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User session invalid.' });
    }

    const { passwordHash, ...userResponse } = user;
    res.json({ success: true, user: userResponse });
  });

  // Get All Candidates
  app.get('/api/candidates', (req, res) => {
    res.json({ success: true, candidates: db.getCandidates() });
  });

  // Cast Vote
  app.post('/api/vote', (req, res) => {
    const userId = req.headers.authorization;
    const { candidateId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Login to vote.' });
    }
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required.' });
    }

    const result = db.submitVote(userId, candidateId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Return updated user and notification
    const user = db.getUserById(userId);
    const { passwordHash, ...userResponse } = user!;
    res.json({ success: true, message: result.message, user: userResponse });
  });

  // Admin Login
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Verify admin credentials dynamically from DB
    if (username === 'admin' && password === db.getAdminPassword()) {
      res.json({
        success: true,
        message: 'Admin access granted.',
        admin: { username: 'admin', role: 'SuperAdmin' }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }
  });

  // Admin Authentication Middleware (Enforce Admin Only)
  app.use('/api/admin', (req, res, next) => {
    if (req.path === '/login') {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'admin') {
      return res.status(401).json({ success: false, message: 'Unauthorized. Only authenticated administrators can access or control this endpoint.' });
    }
    next();
  });

  // Admin Dashboard Statistics
  app.get('/api/admin/stats', (req, res) => {
    const users = db.getUsers();
    const candidates = db.getCandidates();
    const votes = db.getVotes();

    // Map recent votes with names for activity feed
    const recentVotesFeed = votes.slice(-5).reverse().map(vote => {
      const user = users.find(u => u.id === vote.user_id);
      const candidate = candidates.find(c => c.id === vote.candidate_id);
      return {
        id: vote.id,
        voter_name: user ? user.fullname : 'Anonymous Voter',
        voter_id_masked: user ? `${user.voterid.slice(0, 3)}***${user.voterid.slice(-2)}` : '***',
        candidate_name: candidate ? candidate.candidate_name : 'Unknown Candidate',
        party_name: candidate ? candidate.party_name : 'Unknown Party',
        date: vote.date,
        time: vote.time
      };
    });

    res.json({
      success: true,
      stats: {
        total_users: users.length,
        total_candidates: candidates.length,
        total_votes: votes.length,
        election_status: db.getElectionStatus(),
        recent_votes: recentVotesFeed
      }
    });
  });

  // Admin User List (with search and action)
  app.get('/api/admin/users', (req, res) => {
    const search = (req.query.search as string || '').toLowerCase();
    let users = db.getUsers();

    if (search) {
      users = users.filter(u =>
        u.fullname.toLowerCase().includes(search) ||
        u.voterid.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.phone.includes(search)
      );
    }

    // Omit sensitive password hashes
    const sanitizedUsers = users.map(({ passwordHash, ...u }) => u);
    res.json({ success: true, users: sanitizedUsers });
  });

  // Admin Delete User
  app.post('/api/admin/users/delete', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const ok = db.deleteUser(userId);
    if (ok) {
      res.json({ success: true, message: 'User deleted successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'User not found.' });
    }
  });

  // Admin Reset User Voting Status
  app.post('/api/admin/users/reset-vote', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const ok = db.resetVotingStatus(userId);
    if (ok) {
      res.json({ success: true, message: 'Voter status reset successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'User not found.' });
    }
  });

  // Admin Add Candidate
  app.post('/api/admin/candidates/add', (req, res) => {
    const { candidate_name, party_name, symbol, photo, description, bonus_votes } = req.body;

    if (!candidate_name || !party_name || !symbol || !description) {
      return res.status(400).json({ success: false, message: 'All candidate details are required.' });
    }

    const parsedBonus = bonus_votes !== undefined ? parseInt(bonus_votes, 10) : 0;
    const candidate = db.addCandidate({
      candidate_name,
      party_name,
      symbol,
      photo,
      description,
      bonus_votes: isNaN(parsedBonus) ? 0 : parsedBonus
    });
    res.status(201).json({ success: true, message: 'Candidate added successfully!', candidate });
  });

  // Admin Edit Candidate
  app.post('/api/admin/candidates/edit', (req, res) => {
    const { id, candidate_name, party_name, symbol, photo, description, bonus_votes } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required.' });
    }

    const updateData: any = { candidate_name, party_name, symbol, photo, description };
    if (bonus_votes !== undefined) {
      const parsedBonus = parseInt(bonus_votes, 10);
      updateData.bonus_votes = isNaN(parsedBonus) ? 0 : parsedBonus;
    }

    const ok = db.editCandidate(id, updateData);
    if (ok) {
      res.json({ success: true, message: 'Candidate updated successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Candidate not found.' });
    }
  });

  // Admin Delete Candidate
  app.post('/api/admin/candidates/delete', (req, res) => {
    const { candidateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required.' });
    }

    const ok = db.deleteCandidate(candidateId);
    if (ok) {
      res.json({ success: true, message: 'Candidate deleted successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Candidate not found.' });
    }
  });

  // Admin Results Endpoint (detailed calculations and charts)
  app.get('/api/admin/results', (req, res) => {
    const candidates = db.getCandidates();
    const votes = db.getVotes();
    const totalVotes = votes.length;

    const results = candidates.map(c => {
      const percentage = totalVotes > 0 ? ((c.votes / totalVotes) * 100) : 0;
      return {
        id: c.id,
        candidate_name: c.candidate_name,
        party_name: c.party_name,
        symbol: c.symbol,
        photo: c.photo,
        votes: c.votes,
        percentage: parseFloat(percentage.toFixed(1))
      };
    });

    // Sort descending by votes
    results.sort((a, b) => b.votes - a.votes);

    // Calculate winner (if votes cast and there is a leader)
    let winner = null;
    if (totalVotes > 0) {
      const maxVotes = results[0].votes;
      // Check for ties
      const topContenders = results.filter(r => r.votes === maxVotes);
      if (topContenders.length === 1) {
        winner = topContenders[0];
      } else {
        // It's a tie
        winner = {
          candidate_name: 'Draw/Tie Election',
          party_name: 'No single majority',
          symbol: '⚖️',
          photo: '',
          votes: maxVotes,
          percentage: parseFloat(((maxVotes / totalVotes) * 100).toFixed(1)),
          isTie: true
        };
      }
    }

    res.json({
      success: true,
      total_votes: totalVotes,
      results,
      winner
    });
  });

  // Admin Settings & Operations
  app.post('/api/admin/settings/toggle-status', (req, res) => {
    const { status } = req.body;
    if (status !== 'Active' && status !== 'Paused' && status !== 'Ended') {
      return res.status(400).json({ success: false, message: 'Invalid election status.' });
    }

    db.setElectionStatus(status);
    res.json({ success: true, message: `Election status set to ${status}.`, status });
  });

  app.post('/api/admin/settings/reset', (req, res) => {
    db.resetElection();
    res.json({ success: true, message: 'Election voting history cleared successfully.' });
  });

  app.post('/api/admin/settings/delete-votes', (req, res) => {
    db.deleteVotes();
    res.json({ success: true, message: 'All votes have been deleted.' });
  });

  app.post('/api/admin/settings/delete-users', (req, res) => {
    db.deleteUsers();
    res.json({ success: true, message: 'All registered users and voting histories have been deleted.' });
  });

  app.post('/api/admin/settings/delete-candidates', (req, res) => {
    db.deleteCandidates();
    res.json({ success: true, message: 'All candidates have been deleted.' });
  });

  app.post('/api/admin/settings/backup', (req, res) => {
    const result = db.backupDatabase();
    if (result.success) {
      res.json({ success: true, message: `Database backed up successfully. Backup file saved as ${path.basename(result.filepath)}` });
    } else {
      res.status(500).json({ success: false, message: `Failed to backup database: ${result.filepath}` });
    }
  });

  app.post('/api/admin/settings/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current password and new password are required.' });
    }

    if (currentPassword !== db.getAdminPassword()) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const updated = db.setAdminPassword(newPassword);
    if (updated) {
      res.json({ success: true, message: 'Admin password updated successfully.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update admin password.' });
    }
  });

  // --- VITE DEV OR STATIC SITE SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VOTING SERVER] Listening at http://localhost:${PORT}`);
  });
}

startServer();
