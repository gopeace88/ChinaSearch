export interface Session {
  id: string;
  topic: string;
  maxRounds: number;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentRound: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressLog {
  timestamp: number;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export interface AnalysisRound {
  round: number;
  question: string;
  search_query: string;
  search_results: SearchResult[];
  analysis: string;
  timestamp: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SessionProgress {
  session: Session;
  logs: ProgressLog[];
  rounds: AnalysisRound[];
}

export interface FinalReport {
  topic: string;
  rounds: AnalysisRound[];
  final_synthesis: string;
  timestamp: number;
}
