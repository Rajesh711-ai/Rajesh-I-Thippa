import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Vote as VoteIcon,
  Lock,
  User as UserIcon,
  Users,
  CheckCircle,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  Activity,
  Award,
  Trophy,
  Calendar,
  Shield,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  ArrowRight,
  Menu,
  X,
  ChevronRight,
  UserCheck,
  Check,
  Smartphone,
  Mail,
  Info,
  Clock,
  Briefcase,
  Share2
} from 'lucide-react';

import {
  User,
  Candidate,
  RecentVote,
  AdminStats,
  ElectionResult,
  WinnerResult
} from './types';

import ElectionCountdown from './components/ElectionCountdown';
import ResultCharts from './components/ResultCharts';

// Local storage helpers
const SESSION_USER_KEY = 'ov_session_user_id';
const SESSION_ADMIN_KEY = 'ov_session_admin';

export default function App() {
  // Navigation & Theme State
  const [activeView, setActiveView] = useState<'HOME' | 'REGISTER' | 'LOGIN' | 'ADMIN_LOGIN' | 'DASHBOARD' | 'ADMIN_DASHBOARD'>('HOME');
  const [adminSubView, setAdminSubView] = useState<'STATS' | 'USERS' | 'CANDIDATES' | 'RESULTS' | 'SETTINGS'>('STATS');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ov_theme') === 'dark';
  });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<{ username: string; role: string } | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // General App State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voterSearchQuery, setVoterSearchQuery] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Interactive Modals State
  const [selectedCandidateToVote, setSelectedCandidateToVote] = useState<Candidate | null>(null);
  const [isVoteConfirmOpen, setIsVoteConfirmOpen] = useState<boolean>(false);
  const [voteSubmitting, setVoteSubmitting] = useState<boolean>(false);
  
  // Registration and Login Form States
  const [regForm, setRegForm] = useState({
    fullname: '',
    voterid: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [adminPasswordForm, setAdminPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });

  // Notifications and Admin Editing States
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminResults, setAdminResults] = useState<{ results: ElectionResult[]; total_votes: number; winner: WinnerResult | null } | null>(null);
  
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [hasCopiedLink, setHasCopiedLink] = useState<boolean>(false);

  // Candidate Form States (Add/Edit)
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState<boolean>(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [inlineEditingCandidateId, setInlineEditingCandidateId] = useState<string | null>(null);
  const [inlineEditingCandidateName, setInlineEditingCandidateName] = useState<string>('');
  const [candidateForm, setCandidateForm] = useState({
    candidate_name: '',
    party_name: '',
    symbol: '',
    photo: '',
    description: '',
    bonus_votes: '0'
  });

  // Preloaded samples for easy photo Selection
  const samplePhotos = [
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
  ];

  // ---------------------------------------------------------------------------
  // SIDE EFFECTS & AUTHENTICATION BOOTSTRAP
  // ---------------------------------------------------------------------------
  
  // Apply Dark Mode Class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ov_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ov_theme', 'light');
    }
  }, [darkMode]);

  // Check existing session
  useEffect(() => {
    async function checkAuth() {
      const storedUserId = localStorage.getItem(SESSION_USER_KEY);
      const storedAdmin = localStorage.getItem(SESSION_ADMIN_KEY);

      if (storedUserId) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': storedUserId }
          });
          const data = await res.json();
          if (data.success) {
            setCurrentUser(data.user);
            setActiveView('DASHBOARD');
          } else {
            localStorage.removeItem(SESSION_USER_KEY);
          }
        } catch (e) {
          console.error('Session validation failed:', e);
        }
      } else if (storedAdmin) {
        try {
          setCurrentAdmin(JSON.parse(storedAdmin));
          setActiveView('ADMIN_DASHBOARD');
          loadAdminStats();
        } catch (e) {
          localStorage.removeItem(SESSION_ADMIN_KEY);
        }
      }
      setAuthLoading(false);
    }
    checkAuth();
    loadCandidates();
  }, []);

  // Set timeout for notifications
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Sync data when admin subview changes
  useEffect(() => {
    if (activeView === 'ADMIN_DASHBOARD') {
      if (adminSubView === 'STATS') loadAdminStats();
      if (adminSubView === 'USERS') loadAdminUsers();
      if (adminSubView === 'CANDIDATES') loadCandidates();
      if (adminSubView === 'RESULTS') loadAdminResults();
    }
  }, [adminSubView, activeView, userSearchQuery]);

  // ---------------------------------------------------------------------------
  // CORE API CALLS
  // ---------------------------------------------------------------------------

  async function loadCandidates() {
    try {
      const res = await fetch('/api/candidates');
      const data = await res.json();
      if (data.success) setCandidates(data.candidates);
    } catch (e) {
      console.error('Failed to load candidates:', e);
    }
  }

  async function loadAdminStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': 'admin' }
      });
      const data = await res.json();
      if (data.success) setAdminStats(data.stats);
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    }
  }

  async function loadAdminUsers() {
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearchQuery)}`, {
        headers: { 'Authorization': 'admin' }
      });
      const data = await res.json();
      if (data.success) setAdminUsers(data.users);
    } catch (e) {
      console.error('Failed to load admin users:', e);
    }
  }

  async function loadAdminResults() {
    try {
      const res = await fetch('/api/admin/results', {
        headers: { 'Authorization': 'admin' }
      });
      const data = await res.json();
      if (data.success) {
        setAdminResults({
          results: data.results,
          total_votes: data.total_votes,
          winner: data.winner
        });
      }
    } catch (e) {
      console.error('Failed to load results:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // EVENT HANDLERS
  // ---------------------------------------------------------------------------

  // Toast notifier
  function notify(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
  }

  // User Registration
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      return notify('error', 'Passwords do not match.');
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Account created successfully! Please log in.');
        setRegForm({ fullname: '', voterid: '', email: '', phone: '', password: '', confirmPassword: '' });
        setActiveView('LOGIN');
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Network error. Registration failed.');
    }
  }

  // User Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        localStorage.setItem(SESSION_USER_KEY, data.user.id);
        notify('success', `Welcome back, ${data.user.fullname}!`);
        setActiveView('DASHBOARD');
        setLoginForm({ email: '', password: '' });
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Login server error. Try again.');
    }
  }

  // Admin Login
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminLoginForm)
      });
      const data = await res.json();
      if (data.success) {
        setCurrentAdmin(data.admin);
        localStorage.setItem(SESSION_ADMIN_KEY, JSON.stringify(data.admin));
        notify('success', 'Welcome to the Admin Command Panel!');
        setActiveView('ADMIN_DASHBOARD');
        setAdminSubView('STATS');
        setAdminLoginForm({ username: '', password: '' });
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Admin login error.');
    }
  }

  // Cast Ballots
  async function handleCastVote() {
    if (!selectedCandidateToVote || !currentUser) return;
    setVoteSubmitting(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': currentUser.id
        },
        body: JSON.stringify({ candidateId: selectedCandidateToVote.id })
      });
      const data = await res.json();
      setVoteSubmitting(false);
      setIsVoteConfirmOpen(false);
      if (data.success) {
        notify('success', 'Vote Submitted Successfully.');
        setCurrentUser(data.user);
        loadCandidates();
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      setVoteSubmitting(false);
      notify('error', 'Vote transaction failed. Try again.');
    }
  }

  // Logouts
  function handleLogout() {
    localStorage.removeItem(SESSION_USER_KEY);
    setCurrentUser(null);
    notify('success', 'Logged out successfully.');
    setActiveView('HOME');
  }

  function handleAdminLogout() {
    localStorage.removeItem(SESSION_ADMIN_KEY);
    setCurrentAdmin(null);
    notify('success', 'Admin session terminated.');
    setActiveView('HOME');
  }

  // Admin User Actions
  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you absolutely sure you want to delete this voter? This is irreversible.')) return;
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        notify('success', data.message);
        loadAdminUsers();
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Action failed.');
    }
  }

  async function handleResetVoteStatus(userId: string) {
    if (!confirm('Reset voting status for this user? They will be allowed to cast another vote.')) return;
    try {
      const res = await fetch('/api/admin/users/reset-vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        notify('success', data.message);
        loadAdminUsers();
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Action failed.');
    }
  }

  // Admin Candidate Operations
  function openAddCandidate() {
    setEditingCandidate(null);
    setCandidateForm({ candidate_name: '', party_name: '', symbol: '', photo: samplePhotos[0], description: '', bonus_votes: '0' });
    setIsCandidateModalOpen(true);
  }

  function openEditCandidate(c: Candidate) {
    setEditingCandidate(c);
    setCandidateForm({
      candidate_name: c.candidate_name,
      party_name: c.party_name,
      symbol: c.symbol,
      photo: c.photo,
      description: c.description,
      bonus_votes: String(c.bonus_votes || 0)
    });
    setIsCandidateModalOpen(true);
  }

  async function handleCandidateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = !!editingCandidate;
    const url = isEdit ? '/api/admin/candidates/edit' : '/api/admin/candidates/add';
    const body = isEdit ? { id: editingCandidate.id, ...candidateForm } : candidateForm;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        notify('success', data.message);
        setIsCandidateModalOpen(false);
        loadCandidates();
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Failed to save candidate.');
    }
  }

  async function handleInlineRenameSave(c: Candidate) {
    if (!inlineEditingCandidateName.trim()) {
      notify('error', 'Candidate name cannot be empty.');
      return;
    }
    try {
      const res = await fetch('/api/admin/candidates/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify({
          id: c.id,
          candidate_name: inlineEditingCandidateName.trim(),
          party_name: c.party_name,
          symbol: c.symbol,
          photo: c.photo,
          description: c.description
        })
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Candidate name updated successfully.');
        setInlineEditingCandidateId(null);
        loadCandidates();
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Failed to rename candidate.');
    }
  }

  async function handleDeleteCandidate(candidateId: string) {
    if (!confirm('Delete this candidate and all their votes?')) return;
    try {
      const res = await fetch('/api/admin/candidates/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify({ candidateId })
      });
      const data = await res.json();
      if (data.success) {
        notify('success', data.message);
        loadCandidates();
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Deletion failed.');
    }
  }

  async function handleAdminPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!adminPasswordForm.currentPassword || !adminPasswordForm.newPassword || !adminPasswordForm.confirmNewPassword) {
      notify('error', 'All password fields are required.');
      return;
    }

    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmNewPassword) {
      notify('error', 'New passwords do not match.');
      return;
    }

    if (adminPasswordForm.newPassword.length < 6) {
      notify('error', 'New password must be at least 6 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/admin/settings/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify({
          currentPassword: adminPasswordForm.currentPassword,
          newPassword: adminPasswordForm.newPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Admin password changed successfully.');
        setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      } else {
        notify('error', data.message);
      }
    } catch (err) {
      notify('error', 'Failed to change admin password.');
    }
  }

  // Admin System Settings Action
  async function triggerSettingsAction(action: string, endpoint: string) {
    if (!confirm(`Are you sure you want to: ${action}? This action changes critical data.`)) return;
    try {
      const res = await fetch(`/api/admin/settings/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': 'admin' }
      });
      const data = await res.json();
      if (data.success) {
        notify('success', data.message);
        if (adminSubView === 'STATS') loadAdminStats();
      } else {
        notify('error', data.message);
      }
    } catch (e) {
      notify('error', 'Operation failed.');
    }
  }

  async function toggleElectionStatus(status: 'Active' | 'Paused' | 'Ended') {
    try {
      const res = await fetch('/api/admin/settings/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin'
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        notify('success', data.message);
        loadAdminStats();
      }
    } catch (e) {
      notify('error', 'Failed to change election status.');
    }
  }

  // Photo Selector File Upload Simulation
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCandidateForm(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }

  // ---------------------------------------------------------------------------
  // EXPORT & SHARING FUNCTIONS
  // ---------------------------------------------------------------------------

  function handleCopyShareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setHasCopiedLink(true);
      notify('success', 'App sharing URL copied to clipboard!');
      setTimeout(() => setHasCopiedLink(false), 2000);
    }).catch(() => {
      notify('error', 'Failed to copy URL automatically.');
    });
  }

  function handlePrintResults() {
    window.print();
  }

  function handleExportCSV() {
    if (!adminResults || adminResults.results.length === 0) return;
    const headers = ['Candidate Name', 'Party Name', 'Symbol', 'Votes', 'Percentage'];
    const rows = adminResults.results.map(r => [
      `"${r.candidate_name}"`,
      `"${r.party_name}"`,
      `"${r.symbol}"`,
      r.votes,
      `"${r.percentage}%"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `election_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('success', 'Excel-compatible CSV exported successfully!');
  }

  // Filter Candidates in voting panel
  const filteredCandidates = candidates.filter(c =>
    c.candidate_name.toLowerCase().includes(voterSearchQuery.toLowerCase()) ||
    c.party_name.toLowerCase().includes(voterSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F4F7FE] dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200">
      
      {/* -----------------------------------------------------------------------
          TOP NAVIGATION BAR
          ----------------------------------------------------------------------- */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            
            {/* Logo */}
            <div className="flex items-center gap-2.5 cursor-pointer group/logo" onClick={() => activeView === 'DASHBOARD' ? null : setActiveView('HOME')}>
              <div className="bg-blue-600 dark:bg-blue-500 p-2.5 rounded-xl text-white shadow-md shadow-blue-500/20 transition-all duration-300 group-hover/logo:scale-105">
                <VoteIcon className="w-5 h-5 animate-pulse transition-transform duration-300 group-hover/logo:rotate-12 group-hover/logo:scale-110" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-slate-950 dark:text-white">BallotCast</span>
                <span className="text-[10px] font-bold block text-blue-600 dark:text-blue-400 -mt-1 uppercase tracking-widest">Secure Portal</span>
              </div>
            </div>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-6">
              {activeView === 'HOME' && (
                <>
                  <a href="#about" className="text-sm font-semibold hover:text-blue-600 dark:hover:text-blue-400">About</a>
                  <a href="#features" className="text-sm font-semibold hover:text-blue-600 dark:hover:text-blue-400">Features</a>
                </>
              )}
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                aria-label="Toggle Dark Mode"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 rounded-xl hover:bg-blue-100/80 transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Share App
              </button>

              {/* Render login buttons depending on auth state */}
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {currentUser.fullname.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{currentUser.fullname}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              ) : currentAdmin ? (
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">Admin Panel</span>
                  <button
                    onClick={handleAdminLogout}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Exit Panel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveView('LOGIN')} className="px-4 py-2 text-sm font-bold hover:text-blue-600 dark:hover:text-blue-400 transition">Voter Sign In</button>
                  <button onClick={() => setActiveView('REGISTER')} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-md shadow-blue-500/15">Register</button>
                  <button onClick={() => setActiveView('ADMIN_LOGIN')} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition">Admin</button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="flex md:hidden items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                aria-label="Toggle Dark Mode"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 transition"
                aria-label="Share App"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3 shadow-lg"
            >
              {currentUser ? (
                <>
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-sm font-bold truncate">{currentUser.fullname}</span>
                  </div>
                  <button onClick={() => { setActiveView('DASHBOARD'); setIsMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Voter Dashboard</button>
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl">Logout</button>
                </>
              ) : currentAdmin ? (
                <>
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-sm font-bold">Admin Console</span>
                  </div>
                  <button onClick={() => { setActiveView('ADMIN_DASHBOARD'); setIsMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Admin Dashboard</button>
                  <button onClick={() => { handleAdminLogout(); setIsMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl">Exit Panel</button>
                </>
              ) : (
                <div className="space-y-2">
                  <button onClick={() => { setActiveView('LOGIN'); setIsMobileMenuOpen(false); }} className="block w-full px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-xl">Voter Sign In</button>
                  <button onClick={() => { setActiveView('REGISTER'); setIsMobileMenuOpen(false); }} className="block w-full px-3 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-center">Register</button>
                  <button onClick={() => { setActiveView('ADMIN_LOGIN'); setIsMobileMenuOpen(false); }} className="block w-full px-3 py-2 text-sm font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">Admin Access</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* -----------------------------------------------------------------------
          GLOBAL NOTIFICATION TOAST
          ----------------------------------------------------------------------- */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full print:hidden"
          >
            <div className={`p-4 rounded-2xl shadow-xl flex items-start gap-3 border ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            }`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${notification.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{notification.type === 'success' ? 'Action Completed' : 'Failed'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -----------------------------------------------------------------------
          MAIN APP ROUTING COMPONENT
          ----------------------------------------------------------------------- */}
      <main className="flex-grow">
        
        {/* ---------------------------------------------------------------------
            VIEW 1: LANDING PAGE (HOME)
            --------------------------------------------------------------------- */}
        {activeView === 'HOME' && (
          <div className="space-y-16 py-12 md:py-20 overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl -z-10 transform -translate-x-12 -translate-y-24"></div>
            <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-3xl -z-10 transform translate-x-12 translate-y-12"></div>

            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
              >
                <Shield className="w-3.5 h-3.5" /> Next-Generation Cryptographic Verification
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight max-w-4xl mx-auto"
              >
                Democracy is Best Served <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Secured and Verified</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
              >
                Cast your vote securely using our encrypted online ballot box. Secure login, transparent audits, live result statistics, and zero compromises on confidentiality.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4"
              >
                <button
                  onClick={() => setActiveView('REGISTER')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 text-base"
                >
                  Create Voter Account <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveView('LOGIN')}
                  className="w-full sm:w-auto px-8 py-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold rounded-2xl transition shadow-sm text-base"
                >
                  Voter Login
                </button>
              </motion.div>
            </div>

            {/* Share Promotion Banner */}
            <div className="max-w-4xl mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]"></div>
                <div className="space-y-2 text-center md:text-left z-10">
                  <h3 className="text-xl font-extrabold flex items-center justify-center md:justify-start gap-2">
                    <Share2 className="w-5 h-5 animate-bounce" /> Share BallotCast Portal
                  </h3>
                  <p className="text-sm text-blue-100 max-w-lg">
                    Invite other eligible voters, community members, and administrators to participate in this official secure election. Send via WhatsApp, social platforms, or copy the link directly!
                  </p>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="z-10 px-6 py-3 bg-white text-blue-600 font-extrabold text-sm rounded-2xl shadow-md hover:bg-blue-50 transition cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" /> Share Anywhere Now
                </button>
              </motion.div>
            </div>
            <div className="max-w-4xl mx-auto px-4">
              <ElectionCountdown />
            </div>

            {/* About Voting Section */}
            <div id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Digital Ballot Innovation</span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">Empowering Citizens with Seamless Verification</h2>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Online voting systems eliminate geographical barriers, boost voter turnout, reduce bureaucratic paper costs, and accelerate counts. By pairing standard secure database hashes with stringent validation rules (one voter, one ballot), we ensure absolute integrity.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Voters can securely register their Unique Voter ID, explore verified candidate statements, cast their secret digital ballot, and view certified live audits.
                  </p>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <UserCheck className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">One Ballot Protection</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Dual duplicate-checks ensure no Voter ID or email address can vote more than once.</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="bg-blue-100 dark:bg-blue-950/60 p-3 rounded-xl w-fit text-blue-600 dark:text-blue-400"><Shield className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Secure Encrypted Hash</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Passwords are protected server-side with high-entropy hashing protocols before database insertion.</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="bg-emerald-100 dark:bg-emerald-950/60 p-3 rounded-xl w-fit text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Live Audit Panels</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Real-time election tallies automatically update and generate responsive chart analytics.</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="bg-amber-100 dark:bg-amber-950/60 p-3 rounded-xl w-fit text-amber-600 dark:text-amber-400"><Activity className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Full Admin Audits</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Elections are audited instantly with precise logs and custom candidate/voter tables.</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="bg-purple-100 dark:bg-purple-950/60 p-3 rounded-xl w-fit text-purple-600 dark:text-purple-400"><Lock className="w-5 h-5" /></div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Session Security</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Authenticated session routes isolate voter credentials and prevent CSRF exploits.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 pt-10 pb-6 print:hidden">
              <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">© 2026 BallotCast Secure Voting Systems. Engineered with Vite, Express, SQLite and Tailwind.</p>
                <div className="flex justify-center gap-4 text-xs font-semibold text-slate-400">
                  <span className="hover:text-blue-600 cursor-pointer" onClick={() => setActiveView('ADMIN_LOGIN')}>System Administration Panel</span>
                </div>
              </div>
            </footer>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            VIEW 2: USER REGISTRATION
            --------------------------------------------------------------------- */}
        {activeView === 'REGISTER' && (
          <div className="py-12 px-4 max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                  <UserIcon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Register Voter Account</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Secure registration connects your name to a verified Voter ID</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alexis Smith"
                      value={regForm.fullname}
                      onChange={e => setRegForm({ ...regForm, fullname: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Voter ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Voter ID Card Number</label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. VOTE8839201"
                      value={regForm.voterid}
                      onChange={e => setRegForm({ ...regForm, voterid: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition uppercase"
                    />
                  </div>
                </div>

                {/* Grid for Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="alexis@domain.com"
                        value={regForm.email}
                        onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        required
                        placeholder="+1 (555) 000-0000"
                        value={regForm.phone}
                        onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={regForm.password}
                        onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={regForm.confirmPassword}
                        onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Password requirements hint */}
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-500 flex-shrink-0" /> Password must be min. 6 characters and contain at least 1 number.
                </p>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-sm shadow-md shadow-blue-500/15 mt-2 cursor-pointer"
                >
                  Create Secure Credentials
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Already have a registered account?{' '}
                  <span onClick={() => setActiveView('LOGIN')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer">
                    Voter Login
                  </span>
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            VIEW 3: USER LOGIN
            --------------------------------------------------------------------- */}
        {activeView === 'LOGIN' && (
          <div className="py-16 px-4 max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                  <Lock className="w-6 h-6 animate-bounce" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Voter Sign In</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Verify your registered credentials to enter your ballot box</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="alexis@domain.com"
                      value={loginForm.email}
                      onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Secret Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-sm shadow-md shadow-blue-500/15 mt-2 cursor-pointer"
                >
                  Decrypt and Verify Session
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  New voter?{' '}
                  <span onClick={() => setActiveView('REGISTER')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer">
                    Register Securely
                  </span>
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            VIEW 4: ADMIN LOGIN
            --------------------------------------------------------------------- */}
        {activeView === 'ADMIN_LOGIN' && (
          <div className="py-16 px-4 max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Admin Command Portal</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Restricted administrative access with full audit permissions</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Admin Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. admin"
                      value={adminLoginForm.username}
                      onChange={e => setAdminLoginForm({ ...adminLoginForm, username: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Admin Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="admin123"
                      value={adminLoginForm.password}
                      onChange={e => setAdminLoginForm({ ...adminLoginForm, password: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>CS Engineering Project Credentials:</strong> Defaults are hardcoded as username <code>admin</code> and password <code>admin123</code>. For secure operations, these can be migrated to database table records with SHA-256 hashes.
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition text-sm shadow-md shadow-amber-500/15 mt-2 cursor-pointer"
                >
                  Verify Administrator Key
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            VIEW 5: USER DASHBOARD
            --------------------------------------------------------------------- */}
        {activeView === 'DASHBOARD' && currentUser && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* Header Welcome Widget */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">VOTER STATE: ONLINE</span>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Welcome back, {currentUser.fullname}!
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-500" /> Voter ID: <strong>{currentUser.voterid}</strong></span>
                  <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-blue-500" /> Phone: <strong>{currentUser.phone}</strong></span>
                </div>
              </div>

              {/* Voting Status Tag */}
              <div className="flex items-center gap-2.5">
                {currentUser.has_voted ? (
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 text-xs font-bold shadow-sm">
                    <CheckCircle className="w-4 h-4" /> Secret Ballot Cast Successfully
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 text-xs font-bold shadow-sm">
                    <Clock className="w-4 h-4 animate-spin" /> Secret Ballot Pending
                  </div>
                )}
              </div>
            </div>

            {/* Countdown widget */}
            <ElectionCountdown />

            {/* Candidate List / Voting Module */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Active General Candidates</h3>
                  <p className="text-xs text-slate-500 mt-1">Review verified candidates and cast your single ballot.</p>
                </div>

                {/* Candidate Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate or party..."
                    value={voterSearchQuery}
                    onChange={e => setVoterSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              {/* Candidates Grid */}
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No candidates match your search filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCandidates.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
                    >
                      {/* Candidate Avatar Header */}
                      <div className="h-44 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-850">
                        {c.photo ? (
                          <img
                            src={c.photo}
                            alt={c.candidate_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-300 dark:text-slate-700"><UserIcon className="w-20 h-20" /></div>
                        )}
                        <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/95 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-slate-200/50 dark:border-slate-800/50 shadow-sm flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" /> Approved Candidate
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                            {c.symbol}
                          </span>
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">{c.candidate_name}</h4>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{c.party_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1.5">{c.description}</p>
                        </div>

                        {/* Cast Vote Action Button */}
                        <button
                          disabled={currentUser.has_voted}
                          onClick={() => {
                            setSelectedCandidateToVote(c);
                            setIsVoteConfirmOpen(true);
                          }}
                          className={`w-full py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 group/vote ${
                            currentUser.has_voted
                              ? 'bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md cursor-pointer'
                          }`}
                        >
                          {currentUser.has_voted ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Ballot Submitted
                            </>
                          ) : (
                            <>
                              <VoteIcon className="w-3.5 h-3.5 transition-transform duration-300 group-hover/vote:scale-115 group-hover/vote:rotate-12" /> Cast Vote
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            VIEW 6: ADMIN DASHBOARD (CONTAINER)
            --------------------------------------------------------------------- */}
        {activeView === 'ADMIN_DASHBOARD' && currentAdmin && (
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-5rem)] bg-[#F4F7FE] dark:bg-slate-950">
            
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-64 bg-[#0A192F] text-white border-r border-slate-700/30 flex-shrink-0 print:hidden flex flex-col justify-between">
              <div className="h-full flex flex-col justify-between">
                
                {/* Upper menus */}
                <div className="space-y-8">
                  {/* Sidebar Header Logo/Title */}
                  <div className="p-6 flex items-center gap-3 border-b border-slate-700/50 group/sidebar-logo">
                    <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white transition-transform duration-300 group-hover/sidebar-logo:scale-105">
                      <VoteIcon className="w-4 h-4 transition-transform duration-300 group-hover/sidebar-logo:rotate-12 group-hover/sidebar-logo:scale-110" />
                    </div>
                    <span className="font-bold tracking-tight text-lg text-white">eVote Pro</span>
                  </div>

                  <div className="px-4 space-y-1.5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2 px-4">Navigation</span>
                    <nav className="space-y-1">
                      {[
                        { key: 'STATS', label: 'Dashboard', icon: Activity },
                        { key: 'USERS', label: 'Manage Users', icon: Users },
                        { key: 'CANDIDATES', label: 'Candidates', icon: Briefcase },
                        { key: 'RESULTS', label: 'Live Results', icon: Trophy },
                        { key: 'SETTINGS', label: 'System Settings', icon: SettingsIcon },
                      ].map(item => {
                        const Icon = item.icon;
                        const active = adminSubView === item.key;
                        return (
                          <button
                            key={item.key}
                            onClick={() => setAdminSubView(item.key as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-xs transition-all text-left ${
                              active
                                ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" /> {item.label}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>

                {/* Footer and Session info */}
                <div className="p-6 border-t border-slate-700/50 space-y-4">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-semibold">Admin Online</span>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/40 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Authorized</p>
                      <p className="text-xs font-extrabold truncate max-w-[120px] text-slate-200">{currentAdmin.username}</p>
                    </div>
                    <button
                      onClick={handleAdminLogout}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/40 hover:bg-red-950/40 transition"
                      title="Exit Admin Panel"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </aside>

            {/* Admin Dynamic Panel Area with Dynamic Header */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#F4F7FE] dark:bg-slate-950">
              {/* Dynamic Subview Top Header */}
              <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between print:hidden">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {adminSubView === 'STATS' && 'Election Overview'}
                    {adminSubView === 'USERS' && 'Manage Users & Voters'}
                    {adminSubView === 'CANDIDATES' && 'Election Candidates'}
                    {adminSubView === 'RESULTS' && 'Live Results Standings'}
                    {adminSubView === 'SETTINGS' && 'System Settings'}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    General Election 2026 • Phase 1
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Administrator</span>
                    <span className="text-[10px] text-slate-400 font-mono">@{currentAdmin.username}</span>
                  </div>
                  <div className="w-10 h-10 bg-blue-600 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center font-bold text-white uppercase text-sm">
                    {currentAdmin.username.charAt(0)}
                  </div>
                </div>
              </header>

              <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
              
              {/* ---------------------------------------------------------------
                  ADMIN VIEW 1: QUICK STATS
                  --------------------------------------------------------------- */}
              {adminSubView === 'STATS' && adminStats && (
                <div className="space-y-8">
                  {/* Controls Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Active Election Control</h4>
                      <p className="text-xs text-slate-500">Modify dynamic polling status and eligibility sessions.</p>
                    </div>

                    {/* Election Status Controls */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-850">
                      {(['Active', 'Paused', 'Ended'] as const).map(status => {
                        const active = adminStats.election_status === status;
                        const btnColor = status === 'Active' ? 'bg-emerald-600 text-white shadow-sm' : status === 'Paused' ? 'bg-amber-500 text-white shadow-sm' : 'bg-red-600 text-white shadow-sm';
                        return (
                          <button
                            key={status}
                            onClick={() => toggleElectionStatus(status)}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                              active ? btnColor : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Grid Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: 'Total Registered Voters', value: adminStats.total_users, color: 'text-blue-600 dark:text-blue-400', icon: Users, bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50', trend: 'Verified Database' },
                      { label: 'Total Active Candidates', value: adminStats.total_candidates, color: 'text-indigo-600 dark:text-indigo-400', icon: Briefcase, bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/50', trend: 'Contesting Parties' },
                      { label: 'Total Ballots Cast', value: adminStats.total_votes, color: 'text-emerald-600 dark:text-emerald-400', icon: VoteIcon, bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50', trend: 'Secret Ballots Audited' },
                      { label: 'System Poll Status', value: adminStats.election_status, color: adminStats.election_status === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400', icon: Activity, bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200/50', trend: 'Status Live' },
                    ].map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 group/stat hover:shadow-md transition-shadow duration-300">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{card.label}</span>
                            <div className={`p-2 rounded-lg border ${card.bg} ${card.color} transition-all duration-300 group-hover/stat:scale-110`}>
                              <Icon className="w-4 h-4 transition-transform duration-300 group-hover/stat:rotate-12" />
                            </div>
                          </div>
                          <div>
                            <span className={`text-3xl font-bold text-slate-900 dark:text-white tracking-tight ${idx === 2 ? 'font-mono' : ''}`}>{card.value}</span>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">{card.trend}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Feed & Security logs */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Live Recent Votes Ticker (Tabulated!) */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
                      <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
                        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-600" /> Recent Voting Activity
                        </h2>
                        <button onClick={() => setAdminSubView('USERS')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">View All</button>
                      </div>
                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-850">
                            <tr>
                              <th className="py-3 px-6">Voter Name</th>
                              <th className="py-3 px-6 text-center">Voter ID</th>
                              <th className="py-3 px-6">Timestamp</th>
                              <th className="py-3 px-6 text-right">Support Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs text-slate-600 dark:text-slate-400">
                            {adminStats.recent_votes.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400">No votes logged in the database yet.</td>
                              </tr>
                            ) : (
                              adminStats.recent_votes.map((vote) => (
                                <tr key={vote.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                                  <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">{vote.voter_name}</td>
                                  <td className="py-4 px-6 text-center font-mono text-slate-500 dark:text-slate-400">{vote.voter_id_masked}</td>
                                  <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-mono">{vote.date} {vote.time}</td>
                                  <td className="py-4 px-6 text-right">
                                    <span className="inline-flex items-center px-2 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 text-[10px] font-bold rounded uppercase border border-green-200 dark:border-green-900">
                                      {vote.candidate_name}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Quick Audit Actions Panel */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-500" /> Security Auditing
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          This Online Voting System uses safe cryptography. All operations are structured with transactional safety (only one ballot is recorded per voter).
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          The backend endpoints prevent SQL Injection through parameterized SQL queries, and safeguard voter passwords with high-entropy hashing protocols.
                        </p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-850">
                        {/* Winner/Callout element matching design */}
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900/60 flex items-center gap-3">
                          <div className="text-2xl">🛡️</div>
                          <div>
                            <p className="text-[10px] font-bold text-yellow-700 dark:text-amber-400 uppercase">Audit Status</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">100% Secure SQLite Server</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setAdminSubView('RESULTS')}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-500/15"
                        >
                          <Trophy className="w-4 h-4" /> View Live Results
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------
                  ADMIN VIEW 2: USER MANAGEMENT
                  --------------------------------------------------------------- */}
              {adminSubView === 'USERS' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Registered Voters</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Manage user directories, voting eligibility status, and credential resets.</p>
                    </div>

                    {/* Search panel */}
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={e => setUserSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Voters list table */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs text-slate-500 dark:text-slate-400">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-850 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th scope="col" className="px-6 py-4">Voter Name</th>
                            <th scope="col" className="px-6 py-4">Voter ID</th>
                            <th scope="col" className="px-6 py-4">Contact Info</th>
                            <th scope="col" className="px-6 py-4">Status</th>
                            <th scope="col" className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                          {adminUsers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No voters found matching query.</td>
                            </tr>
                          ) : (
                            adminUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{u.fullname}</td>
                                <td className="px-6 py-4 font-mono font-semibold text-slate-600 dark:text-slate-300">{u.voterid}</td>
                                <td className="px-6 py-4 space-y-0.5">
                                  <p>{u.email}</p>
                                  <p className="text-[10px] text-slate-400">{u.phone}</p>
                                </td>
                                <td className="px-6 py-4">
                                  {u.has_voted ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-200/50">
                                      Voted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[10px] border border-slate-200/50">
                                      Eligible
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleResetVoteStatus(u.id)}
                                      disabled={!u.has_voted}
                                      className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                                        u.has_voted
                                          ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                                          : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 cursor-not-allowed'
                                      }`}
                                      title="Reset user vote state"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" /> Reset
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="p-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition"
                                      title="Delete Voter Account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------
                  ADMIN VIEW 3: CANDIDATE MANAGEMENT
                  --------------------------------------------------------------- */}
              {adminSubView === 'CANDIDATES' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Election Candidates</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Manage and list registered contenders, upload profiles, symbols, and statements.</p>
                    </div>

                    <button
                      onClick={openAddCandidate}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Candidate
                    </button>
                  </div>

                  {/* Candidates lists */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {candidates.length === 0 ? (
                      <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">No candidates registered. Click "Add Candidate" above.</div>
                    ) : (
                      candidates.map((c) => (
                        <div key={c.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
                          <div className="h-40 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-850">
                            {c.photo ? (
                              <img src={c.photo} alt={c.candidate_name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-12 h-12 text-slate-300" />
                            )}
                            <div className="absolute top-2.5 right-2.5 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1 rounded-full text-[9px] font-bold text-slate-600 dark:text-slate-300 border shadow-sm">
                              {c.symbol}
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="space-y-0.5">
                              {inlineEditingCandidateId === c.id ? (
                                <div className="space-y-2 py-1">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={inlineEditingCandidateName}
                                      onChange={(e) => setInlineEditingCandidateName(e.target.value)}
                                      className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInlineRenameSave(c);
                                        if (e.key === 'Escape') setInlineEditingCandidateId(null);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleInlineRenameSave(c)}
                                      className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center"
                                      title="Save Name"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setInlineEditingCandidateId(null)}
                                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition flex items-center justify-center"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <p className="text-[9px] text-slate-400 font-medium">Press Enter to save, Esc to cancel</p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => {
                                  setInlineEditingCandidateId(c.id);
                                  setInlineEditingCandidateName(c.candidate_name);
                                }}>
                                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition" title="Click to rename easily">
                                    {c.candidate_name}
                                  </h4>
                                  <Edit className="w-3 h-3 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 opacity-60 group-hover:opacity-100 transition" />
                                </div>
                              )}
                              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{c.party_name}</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{c.description}</p>
                          </div>

                          <div className="px-4 pb-4 pt-2 border-t border-slate-50 dark:border-slate-850 flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">Votes Count: <span className="text-blue-600 dark:text-blue-400">{c.votes}</span></span>
                            <div className="flex gap-2">
                              <button onClick={() => openEditCandidate(c)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition" title="Edit Profile">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteCandidate(c.id)} className="p-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition" title="Delete Candidate">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------
                  ADMIN VIEW 4: LIVE RESULTS
                  --------------------------------------------------------------- */}
              {adminSubView === 'RESULTS' && adminResults && (
                <div className="space-y-8">
                  
                  {/* Results Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Live Election Results</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Real-time analytical graphs, winner projections, and exports.</p>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleExportCSV} className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel Export
                      </button>
                      <button onClick={handlePrintResults} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/15 transition cursor-pointer">
                        <Printer className="w-4 h-4" /> Print / Save PDF
                      </button>
                    </div>
                  </div>

                  {/* Print-only Header */}
                  <div className="hidden print:block text-center border-b border-slate-300 pb-6 space-y-2">
                    <h1 className="text-2xl font-bold text-slate-900">BALLOTCAST DIGITAL VOTING SYSTEM</h1>
                    <h2 className="text-lg font-bold text-slate-700">Official Audited Election Results</h2>
                    <p className="text-xs text-slate-400">Generated on: {new Date().toLocaleString()} • Total Votes Audited: {adminResults.total_votes}</p>
                  </div>

                  {/* Trophy/Winner projected Section */}
                  {adminResults.winner && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 p-1 rounded-3xl shadow-lg relative overflow-hidden"
                    >
                      <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
                      <div className="bg-white dark:bg-slate-900 px-6 py-6 sm:py-8 rounded-[22px] flex flex-col sm:flex-row items-center gap-6 relative z-10">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-500 flex-shrink-0 shadow-inner">
                          <Trophy className="w-10 h-10 animate-bounce" />
                        </div>
                        <div className="text-center sm:text-left space-y-1 flex-1">
                          <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest block">Projected Winner / Leader</span>
                          <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex flex-col sm:flex-row sm:items-center gap-2">
                            {adminResults.winner.candidate_name}
                            {!adminResults.winner.isTie && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] font-extrabold border border-amber-200 uppercase w-fit self-center sm:self-auto">Majority Lead</span>
                            )}
                          </h4>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{adminResults.winner.party_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Total Votes: <strong>{adminResults.winner.votes}</strong> ({adminResults.winner.percentage}% of cast ballots)</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Visual charts (Bar/Pie) */}
                  <ResultCharts results={adminResults.results} />

                  {/* Tabulated results listing */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-850">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Audited Vote Breakdown</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs text-slate-500 dark:text-slate-400">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-850 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th scope="col" className="px-6 py-4">Candidate</th>
                            <th scope="col" className="px-6 py-4">Party Affiliation</th>
                            <th scope="col" className="px-6 py-4 text-center">Votes Secured</th>
                            <th scope="col" className="px-6 py-4 text-right">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                          {adminResults.results.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <span className="text-slate-400 font-mono font-bold w-4 text-right">{idx + 1}.</span>
                                <span>{r.candidate_name} <span className="text-xs font-normal text-slate-400">({r.symbol})</span></span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-300">{r.party_name}</td>
                              <td className="px-6 py-4 text-center font-extrabold text-blue-600 dark:text-blue-400 text-sm">{r.votes}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{r.percentage}%</span>
                                  {/* simple visual progress bar */}
                                  <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${r.percentage}%` }}></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* ---------------------------------------------------------------
                  ADMIN VIEW 5: SYSTEM OPERATIONS & SETTINGS
                  --------------------------------------------------------------- */}
              {adminSubView === 'SETTINGS' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">System Settings</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Critical database management operations, backups, and resets.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Database Ops card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Database Backups</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Securely capture the current state of SQLite tables, including registered user accounts, active candidates, and casting history. Backups are exported locally within the <code>instance/</code> directory.
                      </p>
                      
                      <button
                        onClick={() => triggerSettingsAction('Backup database state', 'backup')}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-blue-500" /> Trigger Backup Database
                      </button>
                    </div>

                    {/* Change Admin Password Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Change Admin Password</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Update the security access credentials for this SuperAdmin session. Passwords must be at least 6 characters in length.
                      </p>
                      
                      <form onSubmit={handleAdminPasswordChange} className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Current Password</label>
                          <input
                            type="password"
                            required
                            placeholder="Enter current password"
                            value={adminPasswordForm.currentPassword}
                            onChange={e => setAdminPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">New Password</label>
                            <input
                              type="password"
                              required
                              placeholder="New password"
                              value={adminPasswordForm.newPassword}
                              onChange={e => setAdminPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Confirm Password</label>
                            <input
                              type="password"
                              required
                              placeholder="Confirm new password"
                              value={adminPasswordForm.confirmNewPassword}
                              onChange={e => setAdminPasswordForm(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Lock className="w-4 h-4 text-blue-500" /> Update Password
                        </button>
                      </form>
                    </div>

                    {/* Resets Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Reset Election Tallies</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Clearing election statistics will erase all secret ballots inside the database and mark all users eligibility status as "Eligible" (has_voted = false). General candidate records and registered user directories are preserved.
                      </p>
                      
                      <button
                        onClick={() => triggerSettingsAction('Reset current election', 'reset')}
                        className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200 hover:bg-blue-100 transition rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" /> Reset Secret Ballots
                      </button>
                    </div>

                    {/* Dangerous ops */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm space-y-4 md:col-span-2">
                      <h4 className="text-base font-bold text-red-600 dark:text-red-400">Dangerous Administrative Operations</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        These procedures alter or delete critical data. Always ensure a database backup is triggered before purging directories.
                      </p>

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => triggerSettingsAction('Delete all votes data', 'delete-votes')}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Delete All Votes
                        </button>
                        <button
                          onClick={() => triggerSettingsAction('Delete all candidates data', 'delete-candidates')}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Purge Candidate Directory
                        </button>
                        <button
                          onClick={() => triggerSettingsAction('Delete all users directory', 'delete-users')}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Purge Registered Voters
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </main>
          </div>
        </div>
      )}

      </main>

      {/* -----------------------------------------------------------------------
          MODAL COMPONENT 1: CANDIDATE ADD/EDIT MODAL
          ----------------------------------------------------------------------- */}
      <AnimatePresence>
        {isCandidateModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {editingCandidate ? 'Edit Candidate Details' : 'Add New Candidate'}
                </h3>
                <button onClick={() => setIsCandidateModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCandidateSubmit} className="space-y-4">
                
                {/* Candidate Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Candidate Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Jordan Lee"
                    value={candidateForm.candidate_name}
                    onChange={e => setCandidateForm({ ...candidateForm, candidate_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Party Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Party Name / Affiliation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Green Development Party (GDP)"
                    value={candidateForm.party_name}
                    onChange={e => setCandidateForm({ ...candidateForm, party_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Party Symbol */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Party Symbol / Emoji Accent</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ⚡ Lightning, 🕊️ Dove, 🌐 Globe"
                    value={candidateForm.symbol}
                    onChange={e => setCandidateForm({ ...candidateForm, symbol: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Photo Upload selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidate Profile Photo</label>
                  
                  {/* Selected photo preview */}
                  <div className="flex items-center gap-4 py-2">
                    <img
                      src={candidateForm.photo || samplePhotos[0]}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200/50"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-slate-500">Pick from preloaded samples or upload a custom image file.</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="text-[10px] text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300"
                      />
                    </div>
                  </div>

                  {/* Preloaded samples */}
                  <div className="flex gap-2">
                    {samplePhotos.map((photo, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCandidateForm(prev => ({ ...prev, photo }))}
                        className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition ${
                          candidateForm.photo === photo ? 'border-blue-600 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img src={photo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Candidate Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Candidate Manifesto Description</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide a detailed manifesto or profile overview for voters..."
                    value={candidateForm.description}
                    onChange={e => setCandidateForm({ ...candidateForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Admin Direct Vote Adjustment */}
                <div className="p-4 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/60 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Admin Vote Boost / Injected Votes
                    </label>
                    <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Admin Favor
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter manual extra votes (e.g. 50)"
                    value={candidateForm.bonus_votes}
                    onChange={e => setCandidateForm({ ...candidateForm, bonus_votes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Directly inject extra base votes for this candidate. This value is added directly to their ballot box tallies instantly.
                  </p>
                </div>

                {/* Form submit actions */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsCandidateModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                  >
                    Save Candidate
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -----------------------------------------------------------------------
          MODAL COMPONENT 2: SECURE VOTE CONFIRMATION POPUP
          ----------------------------------------------------------------------- */}
      <AnimatePresence>
        {isVoteConfirmOpen && selectedCandidateToVote && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-center"
            >
              {/* Warning graphic */}
              <div className="mx-auto w-14 h-14 bg-blue-100 dark:bg-blue-950/60 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                <VoteIcon className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Verify Secret Ballot</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to securely cast your secret digital ballot. To safeguard democratic processes, verify your selection below.
                </p>
              </div>

              {/* Selection Summary details */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850 text-left space-y-2">
                <div className="flex items-center gap-3">
                  <img src={selectedCandidateToVote.photo} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover" />
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">{selectedCandidateToVote.candidate_name}</h4>
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedCandidateToVote.party_name}</p>
                  </div>
                </div>
              </div>

              {/* Security Checklist warnings */}
              <div className="space-y-2 text-left bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100/50 dark:border-blue-950 text-xs text-blue-800 dark:text-blue-300">
                <p className="font-bold flex items-center gap-1">⚡ Dynamic Double-Vote Protection:</p>
                <ul className="list-disc pl-4 space-y-1 text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <li>Your Voter ID will be permanently locked from casting further ballots.</li>
                  <li>This digital ballot cannot be modified, edited, or retracted after submission.</li>
                  <li>All statistics are aggregated immediately in the audited live results panel.</li>
                </ul>
              </div>

              {/* Action row buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={voteSubmitting}
                  onClick={() => setIsVoteConfirmOpen(false)}
                  className="py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  disabled={voteSubmitting}
                  onClick={handleCastVote}
                  className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/15 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {voteSubmitting ? 'Submitting...' : 'Confirm Ballot'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -----------------------------------------------------------------------
          MODAL COMPONENT 3: SHARE BALLOTCAST ONLINE PORTAL
          ----------------------------------------------------------------------- */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 dark:bg-blue-950 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Share Secure Ballot Box</h3>
                    <p className="text-[10px] text-slate-500">Official Share Panel</p>
                  </div>
                </div>
                <button onClick={() => setIsShareModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Share this secure online portal with other community members, eligible voters, and administrators. 
                </p>

                {/* Main Link copy row */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Election URL Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={window.location.href}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 focus:outline-none"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition whitespace-nowrap cursor-pointer flex items-center gap-1"
                    >
                      {hasCopiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        'Copy Link'
                      )}
                    </button>
                  </div>
                </div>

                {/* Instant Share Social Buttons */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instant Share Apps</label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* WhatsApp */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent("🗳️ Join the official election on BallotCast! Cast your secure, verified digital ballot online here: " + window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs rounded-xl transition shadow-sm"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.062 5.348 5.4 0 11.91 0c3.153.012 6.12 1.238 8.349 3.458C22.487 5.68 23.71 8.651 23.71 11.8c-.006 6.51-5.34 11.854-11.848 11.854-2.007-.001-3.978-.515-5.711-1.493L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.743 1.452 5.432 0 9.851-4.42 9.855-9.852.002-2.63-1.023-5.101-2.887-6.97C16.438 1.912 13.972.858 11.905.858c-5.436 0-9.851 4.42-9.855 9.855-.001 1.745.483 3.326 1.442 4.938L2.48 21.65l6.167-1.496z" />
                      </svg>
                      WhatsApp
                    </a>

                    {/* Telegram */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent("🗳️ Cast your secure, verified digital ballot online using BallotCast portal!")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0088cc] hover:bg-[#007ab8] text-white font-bold text-xs rounded-xl transition shadow-sm"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6.15-.15 2.76-2.53 2.81-2.75.01-.03.01-.1-.04-.14-.04-.04-.1-.03-.15-.02-.07.02-1.22.78-3.46 2.3-.33.23-.62.34-.89.33-.29-.01-.85-.17-1.27-.3-.51-.17-.92-.26-.89-.55.02-.15.23-.3.63-.46 2.47-1.08 4.12-1.78 4.95-2.1 2.35-.9 2.83-1.05 3.15-1.05.07 0 .23.02.33.1.08.06.11.15.12.24-.01.07-.01.16-.02.22z" />
                      </svg>
                      Telegram
                    </a>

                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs rounded-xl transition shadow-sm"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Facebook
                    </a>

                    {/* Email */}
                    <a
                      href={`mailto:?subject=Official Secure Voting Portal: BallotCast&body=Join the official secure election and cast your verified digital ballot online here: ${encodeURIComponent(window.location.href)}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
                    >
                      <Mail className="w-4 h-4" />
                      Email Link
                    </a>
                  </div>
                </div>

                {/* Additional Info / Security Badge */}
                <div className="flex gap-2.5 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-950 text-[10px] text-amber-800 dark:text-amber-400 leading-normal">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                  <p>
                    <strong>Share Safety Notice:</strong> This link opens the public voter landing and registration page. Standard database rules protect against any double-voting or unauthorized logins.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
