import type { ChatRequest, ChatResponse } from '../types/contracts';

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
