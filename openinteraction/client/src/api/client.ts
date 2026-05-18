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

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as ApiError).error || 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
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

export interface ProjectOverview {
  id: string;
  name: string;
  created_at: string;
  total: number;
  completed: number;
  avg_duration_min: number | null;
}

export interface KeywordEntry {
  label: string;
  count: number;
}

export interface ProjectMetrics {
  project: { id: string; name: string; created_at: string };
  overview: {
    total: number;
    completed: number;
    completion_rate: number | null;
    avg_duration_min: number | null;
    avg_messages_per_interview: number | null;
  };
  keywords: {
    pain_point: KeywordEntry[];
    feature_request: KeywordEntry[];
    positive_feedback: KeywordEntry[];
  };
  interviews: Array<{
    id: string;
    started_at: string;
    status: 'in_progress' | 'completed' | 'abandoned';
    duration_min: number | null;
    insight_count: number;
  }>;
}

export interface MonthlyInterviewBucket {
  month: string;
  count: number;
}

export interface RecentInterviewRow {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
}

export interface DashboardOverview {
  total_interviews: number;
  in_progress_interviews: number;
  total_projects: number;
  interview_growth_pct: number | null;
  monthly_interviews: MonthlyInterviewBucket[];
  trending_tags: Array<{ label: string; count: number }>;
  total_keyword_count: number;
  recent_interviews: RecentInterviewRow[];
}

export interface DashboardChat {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AskResponse {
  answer: string;
  truncated: boolean;
  dropped_count: number;
}

export function listProjects(): Promise<ProjectOverview[]> {
  return request<ProjectOverview[]>('/dashboard/projects');
}

export function getDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>('/dashboard/overview');
}

export function getProjectMetrics(id: string): Promise<ProjectMetrics> {
  return request<ProjectMetrics>(`/dashboard/projects/${id}/metrics`);
}

export function getDashboardChats(id: string): Promise<DashboardChat[]> {
  return request<DashboardChat[]>(`/dashboard/projects/${id}/chats`);
}

export function askDashboard(id: string, question: string): Promise<AskResponse> {
  return request<AskResponse>(`/dashboard/projects/${id}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export function clearDashboardChats(id: string): Promise<void> {
  return request<void>(`/dashboard/projects/${id}/chats`, { method: 'DELETE' });
}

export interface CreateProjectParams {
  name: string;
  product_context: string;
  core_topics: Array<{ id: string; description: string }>;
}

export interface CreateProjectResponse {
  id: string;
  name: string;
  created_at: string;
}

export interface CreateInterviewResponse {
  interview_id: string;
  share_token: string;
  share_link: string;
}

export function createProject(params: CreateProjectParams): Promise<CreateProjectResponse> {
  return request<CreateProjectResponse>('/dashboard/projects', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function createInterview(projectId: string): Promise<CreateInterviewResponse> {
  return request<CreateInterviewResponse>('/interview/create', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}
