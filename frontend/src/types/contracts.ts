/**
 * Canonical Shared Contracts for SAMUDRA Frontend
 *
 * Direct TypeScript translation of backend/app/contracts/chat.py
 * Owned by Dev 1 (Frontend Lead) & Dev 2 (Backend Platform).
 */

export type RecommendationStatus = 'GO' | 'CAUTION' | 'NO_GO' | 'UNKNOWN' | 'INFORMATIONAL';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface UserContext {
  origin_harbor?: string;
  coordinates?: [number, number]; // [lon, lat]
  craft_profile?: 'traditional_non_motorized' | 'motorized_boat' | 'mechanized_trawler';
  language_preference?: 'auto' | 'en' | 'hi' | 'mr' | 'ta';
}

export interface ChatRequest {
  conversation_id?: string;
  message: string;
  user_context?: UserContext;
}

export interface Recommendation {
  status: RecommendationStatus;
  summary: string;
  decisive_factors: string[];
  next_action: string;
}

export interface Confidence {
  level: ConfidenceLevel;
  reasons: string[];
}

export interface EvidenceItem {
  source_name: string;
  source_url?: string;
  observed_time?: string;
  valid_from?: string;
  valid_to?: string;
  retrieved_at: string;
  geometry?: {
    type: string;
    coordinates: any;
  };
  metric_name?: string;
  metric_value?: any;
  metric_unit?: string;
  quality_flags: string[];
}

export interface MapLayer {
  layer_id: string;
  name: string;
  layer_type: 'geojson';
  visible: boolean;
  style?: Record<string, any>;
  geojson: {
    type: 'Feature' | 'FeatureCollection';
    features?: any[];
    [key: string]: any;
  };
}

export interface AgentTraceItem {
  step: number;
  node: string;
  action: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: string;
}

export interface ChatResponse {
  run_id: string;
  conversation_id: string;
  language: string;
  intent: string;
  answer: string;
  recommendation: Recommendation;
  confidence: Confidence;
  evidence: EvidenceItem[];
  map_layers: MapLayer[];
  trace: AgentTraceItem[];
  warnings: string[];
  suggested_followups: string[];
}

export interface TranscribeResponse {
  transcript: string;
  language: string;
  normalized_language: string;
}

export interface VoiceChatResponse extends ChatResponse {
  transcript: string;
  detected_language: string;
  audio_base64?: string;
  audio_format?: string;
}

