export interface Interview {
  interview_id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  project_name: string;
  started_at: string;
}

interface ChatResponse {
  response: string;
  tool_calls: unknown[];
  interview_status: 'in_progress' | 'completed';
}

interface ApiError {
  error: string;
}

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as ApiError).error || 'Request failed');
  }

  return data as T;
}

export function getInterview(token: string): Promise<Interview> {
  return request<Interview>(`/interview/${token}`);
}

export function sendMessage(
  interviewId: string,
  message: string
): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ interview_id: interviewId, message }),
  });
}
