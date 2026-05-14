export interface ProjectOverview {
  id: string;
  name: string;
  created_at: string;
  total: number;
  completed: number;
  avg_duration_min: number | null;
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
  keywords: Record<string, { label: string; count: number }[]>;
  interviews: {
    id: string;
    started_at: string;
    status: string;
    duration_min: number | null;
    insight_count: number;
  }[];
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface Interview {
  id: string;
  token: string;
  project_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export function getInterview(token: string): Promise<Interview>;
export function sendMessage(interviewId: string, message: string): Promise<{ response: string; tool_calls: unknown[]; interview_status: string }>;
export function listProjects(): Promise<ProjectOverview[]>;
export function getProjectMetrics(id: string): Promise<ProjectMetrics>;
export function getDashboardChats(id: string): Promise<ChatMessage[]>;
export function askDashboard(id: string, question: string): Promise<{ answer: string }>;
export function clearDashboardChats(id: string): Promise<void>;
