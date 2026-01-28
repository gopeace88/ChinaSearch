export interface SessionSummary {
  id: number;
  goal: string;
  status: string;
  iteration_count: number;
  confidence_score: number;
}

export interface EvidenceQuality {
  source_type: string;
  source_bias: string;
  freshness: string;
  independence_score: number;
  original_language: string;
  analyzed_by: string;
}

export interface Evidence {
  id: string;
  claim: string;
  content: string;
  source_url: string;
  quality: EvidenceQuality;
}

export interface Question {
  id: string;
  parent_id: string | null;
  type: string;
  text: string;
  status: string;
}

export interface ResearchState {
  research_goal: string;
  decision_context: string;
  assumptions: string[];
  current_hypotheses: string[];
  evidence_list: Evidence[];
  uncertainties: string[];
  confidence_score: number;
  next_questions: Question[];
  iteration_count: number;
  internal_language: string;
  stop_reason: string | null;
}
