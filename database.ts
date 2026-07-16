import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// TypeScript interfaces matching the database tables
export interface User {
  id: string;
  fullname: string;
  voterid: string;
  email: string;
  phone: string;
  passwordHash: string;
  has_voted: boolean;
  created_at: string;
}

export interface Candidate {
  id: string;
  candidate_name: string;
  party_name: string;
  symbol: string;
  photo: string; // Base64 or URL
  description: string;
  votes: number;
  bonus_votes?: number;
}

export interface Vote {
  id: string;
  user_id: string;
  candidate_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
}

export interface DatabaseState {
  users: User[];
  candidates: Candidate[];
  votes: Vote[];
  election_status: 'Active' | 'Paused' | 'Ended';
  admin_password?: string;
}

const DB_DIR = path.join(process.cwd(), 'instance');
const DB_FILE = path.join(DB_DIR, 'voting.db');

class Database {
  private state: DatabaseState = {
    users: [],
    candidates: [],
    votes: [],
    election_status: 'Active',
    admin_password: 'admin123'
  };

  constructor() {
    this.init();
  }

  // Initialize and load database from instance/voting.db
  private init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.state = JSON.parse(raw);
        if (!this.state.admin_password) {
          this.state.admin_password = 'admin123';
          this.save();
        }
        // Ensure candidates have exact vote counts synced
        this.syncVotes();
      } catch (err) {
        console.error('Error reading database file, starting fresh:', err);
        this.seedDefaults();
      }
    } else {
      this.seedDefaults();
    }
  }

  // Sync vote counts based on votes_history table
  private syncVotes() {
    const voteCounts: Record<string, number> = {};
    this.state.candidates.forEach(c => {
      voteCounts[c.id] = c.bonus_votes || 0;
    });

    this.state.votes.forEach(v => {
      if (voteCounts[v.candidate_id] !== undefined) {
        voteCounts[v.candidate_id]++;
      }
    });

    this.state.candidates.forEach(c => {
      c.votes = voteCounts[c.id] || 0;
    });
  }

  // Seed default candidates if empty
  private seedDefaults() {
    this.state = {
      users: [],
      candidates: [
        {
          id: 'cand_1',
          candidate_name: 'Dr. Johnathan Carter',
          party_name: 'Democratic Alliance (DA)',
          symbol: '⚡ Lightning Bolt',
          photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200',
          description: 'Focusing on clean energy investments, public education technology enhancements, and fiscal transparency.',
          votes: 0
        },
        {
          id: 'cand_2',
          candidate_name: 'Senator Clara Adams',
          party_name: 'Progressive Coalition (PC)',
          symbol: '🌱 Green Leaf',
          photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
          description: 'Advocating for universal healthcare quality, localized enterprise zones, and environmental conservation.',
          votes: 0
        },
        {
          id: 'cand_3',
          candidate_name: 'Robert V. Chen',
          party_name: 'Liberty Unity (LU)',
          symbol: '⭐ Golden Star',
          photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
          description: 'Promoting digital liberties, small business tax breaks, and constitutional protections.',
          votes: 0
        }
      ],
      votes: [],
      election_status: 'Active',
      admin_password: 'admin123'
    };
    this.save();
  }

  // Save changes to persistent storage
  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // Hashing password with SHA-256 (no native build dependencies required)
  public hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // --- USER API ---
  public getUsers(): User[] {
    return this.state.users;
  }

  public getUserById(id: string): User | undefined {
    return this.state.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    const cleanEmail = email.toLowerCase().trim();
    return this.state.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
  }

  public getUserByVoterId(voterid: string): User | undefined {
    const cleanId = voterid.toUpperCase().trim();
    return this.state.users.find(u => u.voterid.toUpperCase().trim() === cleanId);
  }

  public registerUser(data: Omit<User, 'id' | 'passwordHash' | 'has_voted' | 'created_at'> & { passwordPlain: string }): { success: boolean; message: string; user?: User } {
    // Check duplicates
    if (this.getUserByEmail(data.email)) {
      return { success: false, message: 'Email address is already registered.' };
    }
    if (this.getUserByVoterId(data.voterid)) {
      return { success: false, message: 'Voter ID is already registered.' };
    }

    const newUser: User = {
      id: 'usr_' + crypto.randomUUID(),
      fullname: data.fullname,
      voterid: data.voterid.toUpperCase().trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone,
      passwordHash: this.hashPassword(data.passwordPlain),
      has_voted: false,
      created_at: new Date().toISOString()
    };

    this.state.users.push(newUser);
    this.save();
    return { success: true, message: 'User registered successfully!', user: newUser };
  }

  public deleteUser(id: string): boolean {
    const index = this.state.users.findIndex(u => u.id === id);
    if (index !== -1) {
      // Also delete user's vote history if they have voted to keep consistency (or keep statistics, but let's remove so they can vote again or just purge)
      this.state.votes = this.state.votes.filter(v => v.user_id !== id);
      this.state.users.splice(index, 1);
      this.syncVotes();
      this.save();
      return true;
    }
    return false;
  }

  public resetVotingStatus(id: string): boolean {
    const user = this.getUserById(id);
    if (user) {
      user.has_voted = false;
      this.state.votes = this.state.votes.filter(v => v.user_id !== id);
      this.syncVotes();
      this.save();
      return true;
    }
    return false;
  }

  // --- CANDIDATE API ---
  public getCandidates(): Candidate[] {
    return this.state.candidates;
  }

  public getCandidateById(id: string): Candidate | undefined {
    return this.state.candidates.find(c => c.id === id);
  }

  public addCandidate(data: Omit<Candidate, 'id' | 'votes'>): Candidate {
    const newCandidate: Candidate = {
      id: 'cand_' + crypto.randomUUID(),
      candidate_name: data.candidate_name,
      party_name: data.party_name,
      symbol: data.symbol,
      photo: data.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      description: data.description,
      votes: 0,
      bonus_votes: data.bonus_votes || 0
    };
    this.state.candidates.push(newCandidate);
    this.syncVotes();
    this.save();
    return newCandidate;
  }

  public editCandidate(id: string, data: Partial<Omit<Candidate, 'id' | 'votes'>>): boolean {
    const candidate = this.getCandidateById(id);
    if (candidate) {
      if (data.candidate_name !== undefined) candidate.candidate_name = data.candidate_name;
      if (data.party_name !== undefined) candidate.party_name = data.party_name;
      if (data.symbol !== undefined) candidate.symbol = data.symbol;
      if (data.photo !== undefined) candidate.photo = data.photo;
      if (data.description !== undefined) candidate.description = data.description;
      if (data.bonus_votes !== undefined) candidate.bonus_votes = data.bonus_votes;
      this.syncVotes();
      this.save();
      return true;
    }
    return false;
  }

  public deleteCandidate(id: string): boolean {
    const index = this.state.candidates.findIndex(c => c.id === id);
    if (index !== -1) {
      // Cascade delete votes associated with this candidate
      this.state.votes = this.state.votes.filter(v => v.candidate_id !== id);
      this.state.candidates.splice(index, 1);
      // Clean up user voted flags if we reset candidate's votes
      this.syncVotes();
      this.save();
      return true;
    }
    return false;
  }

  // --- VOTING API ---
  public submitVote(userId: string, candidateId: string): { success: boolean; message: string } {
    if (this.state.election_status !== 'Active') {
      return { success: false, message: 'Voting is currently closed or paused.' };
    }

    const user = this.getUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (user.has_voted) {
      return { success: false, message: 'You have already cast your vote. Only one vote per user is allowed.' };
    }

    const candidate = this.getCandidateById(candidateId);
    if (!candidate) {
      return { success: false, message: 'Candidate not found.' };
    }

    // Cast the vote
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const newVote: Vote = {
      id: 'vote_' + crypto.randomUUID(),
      user_id: userId,
      candidate_id: candidateId,
      date: dateStr,
      time: timeStr
    };

    user.has_voted = true;
    this.state.votes.push(newVote);
    this.syncVotes();
    this.save();

    return { success: true, message: 'Vote Submitted Successfully.' };
  }

  public getVotes(): Vote[] {
    return this.state.votes;
  }

  public getElectionStatus(): 'Active' | 'Paused' | 'Ended' {
    return this.state.election_status;
  }

  public setElectionStatus(status: 'Active' | 'Paused' | 'Ended') {
    this.state.election_status = status;
    this.save();
  }

  // --- SETTINGS AND UTILS ---
  public resetElection(): boolean {
    // Keep users, but clear all votes and set has_voted back to false, keep candidates but reset vote counts
    this.state.votes = [];
    this.state.users.forEach(u => {
      u.has_voted = false;
    });
    this.state.candidates.forEach(c => {
      c.votes = 0;
    });
    this.save();
    return true;
  }

  public deleteVotes(): boolean {
    this.state.votes = [];
    this.state.users.forEach(u => {
      u.has_voted = false;
    });
    this.state.candidates.forEach(c => {
      c.votes = 0;
    });
    this.save();
    return true;
  }

  public deleteUsers(): boolean {
    this.state.users = [];
    this.state.votes = [];
    this.state.candidates.forEach(c => {
      c.votes = 0;
    });
    this.save();
    return true;
  }

  public deleteCandidates(): boolean {
    this.state.candidates = [];
    this.state.votes = [];
    this.state.users.forEach(u => {
      u.has_voted = false;
    });
    this.save();
    return true;
  }

  public backupDatabase(): { success: boolean; filepath: string } {
    try {
      const backupFilename = `backup_voting_${Date.now()}.db`;
      const backupPath = path.join(DB_DIR, backupFilename);
      fs.writeFileSync(backupPath, JSON.stringify(this.state, null, 2), 'utf8');
      return { success: true, filepath: backupPath };
    } catch (err: any) {
      return { success: false, filepath: err.message };
    }
  }

  public getAdminPassword(): string {
    return this.state.admin_password || 'admin123';
  }

  public setAdminPassword(password: string): boolean {
    if (!password || password.trim().length === 0) return false;
    this.state.admin_password = password.trim();
    this.save();
    return true;
  }
}

export const db = new Database();
