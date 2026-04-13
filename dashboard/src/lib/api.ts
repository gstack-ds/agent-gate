import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `API error ${res.status}`);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

// --- Types ---

export interface Agent {
  id: string;
  name: string;
  api_key_prefix: string;
  status: "active" | "paused" | "revoked";
  created_at: string;
}

export interface AgentWithKey extends Agent {
  api_key: string;
}

export interface Rule {
  id: string;
  agent_id: string;
  rule_type: string;
  value: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface AuthRequest {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  action: string | null;
  amount: number | null;
  currency: string | null;
  vendor: string | null;
  category: string | null;
  description: string | null;
  status: string;
  rule_evaluation?: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_requests: number;
  auto_approved: number;
  pending: number;
  approved: number;
  denied: number;
  expired: number;
  total_spend: number;
  approval_rate: number;
  agents_active: number;
}

export interface ActivityItem {
  id: string;
  event_type: string;
  agent_name: string;
  action: string;
  amount: number | null;
  vendor: string | null;
  description: string | null;
  created_at: string;
}

export interface RuleTemplate {
  name: string;
  description: string;
  risk_level?: string;
  rules: Array<{
    rule_type: string;
    value: Record<string, unknown>;
  }>;
}

// --- Agents ---

export async function getAgents(): Promise<Agent[]> {
  return apiFetch<Agent[]>("/v1/agents");
}

export async function createAgent(name: string): Promise<AgentWithKey> {
  return apiFetch<AgentWithKey>("/v1/agents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateAgent(
  id: string,
  data: { name?: string; status?: string }
): Promise<Agent> {
  return apiFetch<Agent>(`/v1/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function revokeAgent(id: string): Promise<void> {
  return apiFetch<void>(`/v1/agents/${id}`, { method: "DELETE" });
}

// --- Rules ---

export async function getAgentRules(agentId: string): Promise<Rule[]> {
  return apiFetch<Rule[]>(`/v1/agents/${agentId}/rules`);
}

export async function createRule(
  agentId: string,
  rule_type: string,
  value: Record<string, unknown>
): Promise<Rule> {
  return apiFetch<Rule>(`/v1/agents/${agentId}/rules`, {
    method: "POST",
    body: JSON.stringify({ rule_type, value }),
  });
}

export async function deleteRule(ruleId: string): Promise<void> {
  return apiFetch<void>(`/v1/rules/${ruleId}`, { method: "DELETE" });
}

export async function getRuleTemplates(
  agentId: string
): Promise<RuleTemplate[]> {
  return apiFetch<RuleTemplate[]>(`/v1/agents/${agentId}/rules/templates`);
}

export async function getGlobalRuleTemplates(): Promise<RuleTemplate[]> {
  return apiFetch<RuleTemplate[]>("/v1/rules/templates");
}

export async function restoreAgentRules(agentId: string): Promise<void> {
  return apiFetch<void>(`/v1/agents/${agentId}/rules/restore`, { method: "POST" });
}

// --- Requests ---

export async function getRequests(status?: string): Promise<AuthRequest[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<AuthRequest[]>(`/v1/requests${qs}`);
}

export async function approveRequest(id: string): Promise<void> {
  return apiFetch<void>(`/v1/requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note: "Approved via dashboard" }),
  });
}

export async function denyRequest(id: string, reason?: string): Promise<void> {
  return apiFetch<void>(`/v1/requests/${id}/deny`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "Denied via dashboard" }),
  });
}

// --- Dashboard ---

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/v1/dashboard/stats");
}

export async function getActivity(): Promise<ActivityItem[]> {
  return apiFetch<ActivityItem[]>("/v1/dashboard/activity");
}

// --- Usage ---

export interface UsageData {
  plan: string;
  authorizations_this_month: number;
  requests_limit: number | null;
  agents_active: number;
  agents_limit: number | null;
}

export async function getUsage(): Promise<UsageData> {
  return apiFetch<UsageData>("/v1/usage");
}

// --- Billing ---

export async function createCheckoutSession(
  plan: "starter" | "pro"
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export async function createBillingPortal(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/v1/billing/portal", { method: "POST" });
}
