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
  intent?: string;
  description?: string;
  query?: string;
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
