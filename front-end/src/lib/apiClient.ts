// HTTP API client. Drop-in replacement for mockApi.ts — same exports, same shapes.
// Auth tokens are managed by Supabase. Every backend call attaches the current
// access token; on 401 we attempt one silent refresh before surfacing the error.
import type {
  AppSnapshot,
  Catalogs,
  CreateDocumentInput,
  CreateProjectInput,
  DeleteDocumentInput,
  DeletePlanItemInput,
  SaveAllocationInput,
  SavePlanItemInput,
  SaveRiskInput,
  SaveWorklogInput,
  UpdateDocumentInput,
  UpdateProjectInput,
} from '../types'
import { resolveEmail, supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

const EMPTY_SNAPSHOT: AppSnapshot = {
  currentUser: null,
  users: [],
  projects: [],
  planItems: [],
  worklogs: [],
  delayRaises: [],
  activityLogs: [],
  catalogs: {
    projectStatuses: [],
    healthStatuses: [],
    taskStatuses: [],
    riskLevels: [],
    documentCategories: [],
    departments: [],
    projectMemberRoles: [],
  },
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  retried?: boolean
}

async function apiCall<T>(path: string, opts: ApiCallOptions = {}): Promise<T> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401 && !opts.retried) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      await supabase.auth.signOut()
      throw new Error('Session expired')
    }
    return apiCall<T>(path, { ...opts, retried: true })
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* swallow */
    }
    throw new Error(message)
  }

  if (res.status === 204) return EMPTY_SNAPSHOT as unknown as T
  return (await res.json()) as T
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function login(identifier: string, password: string): Promise<AppSnapshot | null> {
  const email = resolveEmail(identifier)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    void logAuthEvent(email, 'FAILURE', error?.message ?? 'unknown')
    return null
  }
  void logAuthEvent(email, 'SUCCESS', '')
  return apiCall<AppSnapshot>('/snapshot')
}

export async function logout(): Promise<AppSnapshot> {
  await supabase.auth.signOut()
  return EMPTY_SNAPSHOT
}

export async function getSnapshot(): Promise<AppSnapshot> {
  const token = await getAccessToken()
  if (!token) return EMPTY_SNAPSHOT
  try {
    return await apiCall<AppSnapshot>('/snapshot')
  } catch {
    return EMPTY_SNAPSHOT
  }
}

// ─── Projects ──────────────────────────────────────────────────────────────

export async function createProject(input: CreateProjectInput): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>('/projects', { method: 'POST', body: input })
}

export async function updateProject(input: UpdateProjectInput): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(`/projects/${input.projectId}`, {
    method: 'PATCH',
    body: { patch: input.patch },
  })
}

// ─── Documents ─────────────────────────────────────────────────────────────

export async function addProjectDocument(input: CreateDocumentInput): Promise<AppSnapshot> {
  const { projectId, ...rest } = input
  return apiCall<AppSnapshot>(`/projects/${projectId}/documents`, {
    method: 'POST',
    body: rest,
  })
}

export async function updateProjectDocument(input: UpdateDocumentInput): Promise<AppSnapshot> {
  const { projectId, documentId, ...rest } = input
  return apiCall<AppSnapshot>(`/projects/${projectId}/documents/${documentId}`, {
    method: 'PATCH',
    body: rest,
  })
}

export async function deleteProjectDocument(input: DeleteDocumentInput): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(`/projects/${input.projectId}/documents/${input.documentId}`, {
    method: 'DELETE',
  })
}

// ─── Plan items ────────────────────────────────────────────────────────────

export async function savePlanItem(input: SavePlanItemInput): Promise<AppSnapshot> {
  const { projectId, id, ...rest } = input
  if (id) {
    return apiCall<AppSnapshot>(`/projects/${projectId}/plan-items/${id}`, {
      method: 'PATCH',
      body: rest,
    })
  }
  return apiCall<AppSnapshot>(`/projects/${projectId}/plan-items`, {
    method: 'POST',
    body: rest,
  })
}

export async function deletePlanItem(input: DeletePlanItemInput): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(`/projects/${input.projectId}/plan-items/${input.planItemId}`, {
    method: 'DELETE',
  })
}

// ─── Worklogs / delays ─────────────────────────────────────────────────────

export async function addWorklog(input: SaveWorklogInput): Promise<AppSnapshot> {
  const { projectId, ...rest } = input
  return apiCall<AppSnapshot>(`/projects/${projectId}/worklogs`, {
    method: 'POST',
    body: rest,
  })
}

export async function raiseDelay(input: {
  projectId: string
  taskId: string
  requesterId: string
  reason: string
  impact: string
}): Promise<AppSnapshot> {
  const { projectId, ...rest } = input
  return apiCall<AppSnapshot>(`/projects/${projectId}/delay-raises`, {
    method: 'POST',
    body: rest,
  })
}

// ─── Allocations / risks ───────────────────────────────────────────────────

export async function saveAllocation(input: SaveAllocationInput): Promise<AppSnapshot> {
  const { projectId, ...rest } = input
  return apiCall<AppSnapshot>(`/projects/${projectId}/allocations`, {
    method: 'POST',
    body: rest,
  })
}

export async function saveRisk(input: SaveRiskInput): Promise<AppSnapshot> {
  const { projectId, ...rest } = input
  return apiCall<AppSnapshot>(`/projects/${projectId}/risks`, {
    method: 'POST',
    body: rest,
  })
}

// ─── Catalogs / admin ──────────────────────────────────────────────────────

export async function updateCatalogGroup<K extends keyof Catalogs>(
  group: K,
  values: Catalogs[K],
): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(`/catalogs/${group}`, { method: 'PATCH', body: values })
}

export async function resetDemoData(): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>('/admin/reset-demo-data', { method: 'POST' })
}

// ─── v3.2 Close workflow ───────────────────────────────────────────────────

export async function pauseProject(projectId: string): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(`/projects/${projectId}/pause`, { method: 'POST' })
}

export async function resumeProject(projectId: string): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(`/projects/${projectId}/resume`, { method: 'POST' })
}

export async function requestProjectClose(
  projectId: string,
  note: string,
): Promise<{ closeRequestId: string } & AppSnapshot> {
  return apiCall(`/projects/${projectId}/close-requests`, {
    method: 'POST',
    body: { note },
  })
}

export async function ksvDecideClose(
  projectId: string,
  closeRequestId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason = '',
): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(
    `/projects/${projectId}/close-requests/${closeRequestId}/ksv`,
    { method: 'PATCH', body: { decision, reason } },
  )
}

export async function tcnlDecideClose(
  projectId: string,
  closeRequestId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason = '',
): Promise<AppSnapshot> {
  return apiCall<AppSnapshot>(
    `/projects/${projectId}/close-requests/${closeRequestId}/tcnl`,
    { method: 'PATCH', body: { decision, reason } },
  )
}

export interface CloseInboxItem {
  id: string
  projectId: string
  requestedById: string
  requestedAt: string
  note: string
  ksvDecision: 'PENDING' | 'APPROVED' | 'REJECTED'
  ksvDecidedById: string | null
  ksvDecidedAt: string | null
  ksvRejectReason: string
  tcnlDecision: 'PENDING' | 'APPROVED' | 'REJECTED'
  tcnlDecidedById: string | null
  tcnlDecidedAt: string | null
  tcnlRejectReason: string
  project: { id: string; code: string; name: string }
}

export async function fetchCloseInbox(): Promise<{ items: CloseInboxItem[] }> {
  return apiCall('/close-inbox')
}

// ─── v3.2 Notifications ────────────────────────────────────────────────────

export interface NotificationItem {
  id: string
  userId: string
  kind: string
  title: string
  body: string
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export async function fetchNotifications(
  unreadOnly = false,
): Promise<{ items: NotificationItem[] }> {
  return apiCall(`/notifications${unreadOnly ? '?unread=1' : ''}`)
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return apiCall(`/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return apiCall('/notifications/read-all', { method: 'POST' })
}

// ─── v3.2 Auth log (BRD VIII.3) ────────────────────────────────────────────

export async function logAuthEvent(
  email: string,
  status: 'SUCCESS' | 'FAILURE',
  reason = '',
): Promise<void> {
  // Best-effort. Failures here must not block the user's login.
  try {
    const token = await getAccessToken()
    await fetch(`${API_URL}/auth-log/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ email, status, reason }),
    })
  } catch {
    /* swallow */
  }
}
