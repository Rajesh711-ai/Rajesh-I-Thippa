export interface User {
  id: string;
  fullname: string;
  voterid: string;
  email: string;
  phone: string;
  has_voted: boolean;
  created_at: string;
}

export interface Candidate {
  id: string;
  candidate_name: string;
  party_name: string;
  symbol: string;
  photo: string;
  description: string;
  votes: number;
  bonus_votes?: number;
}

export interface Vote {
  id: string;
  user_id: string;
  candidate_id: string;
  date: string;
  time: string;
}

export interface RecentVote {
  id: string;
  voter_name: string;
  voter_id_masked: string;
  candidate_name: string;
  party_name: string;
  date: string;
  time: string;
}

export interface AdminStats {
  total_users: number;
  total_candidates: number;
  total_votes: number;
  election_status: 'Active' | 'Paused' | 'Ended';
  recent_votes: RecentVote[];
}

export interface ElectionResult {
  id: string;
  candidate_name: string;
  party_name: string;
  symbol: string;
  photo: string;
  votes: number;
  percentage: number;
}

export interface WinnerResult {
  candidate_name: string;
  party_name: string;
  symbol: string;
  photo: string;
  votes: number;
  percentage: number;
  isTie?: boolean;
}
