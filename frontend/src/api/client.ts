import type { ChatRequest, ChatResponse, TranscribeResponse, VoiceChatResponse } from '../types/contracts';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, res.statusText, body);
  }
  return res.json();
}

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice_recording.webm');

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, res.statusText, body);
  }

  return res.json();
}

export interface VoiceChatParams {
  conversation_id?: string;
  origin_harbor?: string;
  craft_profile?: string;
  language_preference?: string;
}

export async function sendVoiceChat(
  audioBlob: Blob,
  params?: VoiceChatParams,
): Promise<VoiceChatResponse> {
  const formData = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
  formData.append('file', audioBlob, `call_recording.${ext}`);

  if (params?.conversation_id) {
    formData.append('conversation_id', params.conversation_id);
  }
  if (params?.origin_harbor) {
    formData.append('origin_harbor', params.origin_harbor);
  }
  if (params?.craft_profile) {
    formData.append('craft_profile', params.craft_profile);
  }
  if (params?.language_preference) {
    formData.append('language_preference', params.language_preference);
  }

  const res = await fetch(`${API_BASE}/voice/chat`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, res.statusText, body);
  }

  return res.json();
}


export interface HealthResponse {
  status: string;
  app_name?: string;
  app_env?: string;
  data_mode?: string;
  database?: string;
  timestamp?: string;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export interface DemoScenario {
  id: string;
  name: string;
  category?: string;
  intent?: string;
  description?: string;
  query?: string;
  harbor?: string;
  expected_status?: string;
  expected_confidence?: string;
  ui_metadata?: {
    icon?: string;
    badge?: string;
    badge_color?: string;
    summary?: string;
  };
}

export async function getDemoScenarios(): Promise<DemoScenario[]> {
  try {
    const res = await request<any>('/scenarios');
    return Array.isArray(res) ? res : (res?.scenarios || []);
  } catch {
    const res = await request<any>('/demo-scenarios').catch(() => []);
    return Array.isArray(res) ? res : (res?.scenarios || []);
  }
}

export async function getScenarioDetails(scenarioId: string): Promise<any> {
  return request<any>(`/scenarios/${scenarioId}`);
}

export interface ScenarioBenchmarkResult {
  scenario_id: string;
  scenario_name: string;
  passed: boolean;
  actual_intent: string;
  expected_intent: string;
  actual_status: string;
  expected_status: string;
  actual_confidence: string;
  expected_confidence: string;
  executed_tools: string[];
  evidence_count: number;
  evidence_grounded: boolean;
  response_text: string;
  trace_steps_count: number;
  warnings: string[];
  validation_notes: string[];
}

export async function runScenario(scenarioId: string, language?: string): Promise<ScenarioBenchmarkResult> {
  const url = language ? `/scenarios/${scenarioId}/run?language=${encodeURIComponent(language)}` : `/scenarios/${scenarioId}/run`;
  return request<ScenarioBenchmarkResult>(url, { method: 'POST' });
}

export async function getBaseLayers(): Promise<GeoJSON.FeatureCollection> {
  return request<GeoJSON.FeatureCollection>('/layers/base');
}

export interface ConversationTurn {
  id: string;
  status: string;
  started_at?: string;
  request?: any;
  response?: any;
  data_mode?: string;
}

export async function getConversationHistory(conversationId: string): Promise<{ conversation_id: string; history: ConversationTurn[] }> {
  return request<{ conversation_id: string; history: ConversationTurn[] }>(`/chat/${conversationId}/history`);
}

export async function getRunDetails(runId: string): Promise<any> {
  return request<any>(`/runs/${runId}`);
}

export interface DemoSector {
  public_id: string;
  name: string;
  code: string;
  station_name: string;
  harbor_id: string;
  center: [number, number];
  zoom: number;
  polygon: [number, number][];
}

export interface DemoVessel {
  public_id: string;
  name: string;
  vessel_type: string;
  length_m: number;
  capacity_tons: number;
  home_harbor_id: string;
  status: string;
  metadata_json?: {
    engine_hp?: number;
    hull_material?: string;
  };
}

export interface VesselPosition {
  public_id: string;
  vessel_id: string;
  trip_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed_knots: number;
  heading_deg: number;
}

export interface DemoNotification {
  public_id: string;
  recipient_role: string;
  vessel_id?: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  is_read: boolean;
  timestamp: string;
}

export interface DemoHazard {
  public_id: string;
  hazard_type: string;
  severity: string;
  description: string;
  coordinates: [number, number] | [number, number][];
  valid_from: string;
  valid_until: string;
  source: string;
}

export async function getDemoSectors(): Promise<DemoSector[]> {
  return request<DemoSector[]>('/demo/sectors');
}

export async function getDemoVessels(sector?: string): Promise<DemoVessel[]> {
  const url = sector ? `/demo/vessels?sector=${encodeURIComponent(sector)}` : '/demo/vessels';
  return request<DemoVessel[]>(url);
}

export async function getDemoVesselReplay(vesselId: string): Promise<VesselPosition[]> {
  return request<VesselPosition[]>(`/demo/vessels/${encodeURIComponent(vesselId)}/replay`);
}

export async function getDemoNotifications(sector?: string): Promise<DemoNotification[]> {
  const url = sector ? `/demo/notifications?sector=${encodeURIComponent(sector)}` : '/demo/notifications';
  return request<DemoNotification[]>(url);
}

export async function getDemoHazards(sector?: string): Promise<DemoHazard[]> {
  const url = sector ? `/demo/hazards?sector=${encodeURIComponent(sector)}` : '/demo/hazards';
  return request<DemoHazard[]>(url);
}
