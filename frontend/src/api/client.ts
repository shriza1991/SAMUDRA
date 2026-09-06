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

export async function getHealth(): Promise<{
  status: string;
  data_mode: string;
  database: string;
  timestamp: string;
}> {
  return request('/health');
}

export async function getDemoScenarios(): Promise<Array<{
  id: string;
  name: string;
  description: string;
  query: string;
}>> {
  return request('/scenarios');
}
