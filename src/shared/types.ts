// Research session state machine
export type SessionState =
  | "IDLE"
  | "WAITING_RESEARCH"
  | "READING_RESULT"
  | "ANALYZING"
  | "INSERTING_QUESTION"
  | "WAITING_CONFIRM"
  | "AUTO_SUBMIT"
  | "WAITING_FINAL_REPORT";

export interface ProgressEntry {
  time: number;
  step: string;
  detail: string;
}

export interface ResearchSession {
  id: string;
  topic: string;
  state: SessionState;
  round: number;
  maxRounds: number;
  autoMode: boolean;
  reports: ReportEntry[];
  analyses: AnalysisEntry[];
  progressLog: ProgressEntry[];  // live activity log
  finalReport?: string;          // ChatGPT final summary report
  createdAt: number;
}

export interface ReportEntry {
  round: number;
  content: string;       // ChatGPT deep research report text
  extractedAt: number;
}

export interface AnalysisEntry {
  round: number;
  glmClaims: string;            // GLM extracted key claims
  searchResults: string;        // Brave search results
  claudeAnalysis: string;       // Claude synthesis (meta-assessment stripped)
  metaAssessment: string;       // Claude self-reflection on research trajectory
  followUpQuestion: string;     // Generated follow-up question
  enrichedQuestion: string;     // Full question sent to ChatGPT (with context)
  glmVerification: string;      // kept for backward compat
  createdAt: number;
}

export interface LLMUsage {
  glmCalls: number;
  claudeCalls: number;
}

export interface Settings {
  glmApiKey: string;
  claudeApiKey: string;
  maxRounds: number;
  autoMode: boolean;
}
