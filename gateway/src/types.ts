export interface SessionRecord {
  id: string;
  topic: string;
  max_rounds: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  current_round: number;
  created_at: number;
  updated_at: number;
  final_report?: string;
  error?: string;
}

export interface CreateSessionRequest {
  topic: string;
  maxRounds: number;
  files?: string[];  // file names from uploads
}

export interface SessionResponse {
  id: string;
  topic: string;
  maxRounds: number;
  status: string;
  currentRound: number;
  createdAt: number;
  updatedAt: number;
  finalReport?: string;
  error?: string;
}
