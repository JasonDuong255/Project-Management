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
    return null
  }
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
