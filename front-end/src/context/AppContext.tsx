import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import * as apiClient from '../lib/apiClient'
import { supabase } from '../lib/supabase'
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
  User,
} from '../types'

interface LoginResult {
  ok: boolean
  message?: string
}

interface AppContextValue extends AppSnapshot {
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<void>
  updateProject: (input: UpdateProjectInput) => Promise<void>
  addProjectDocument: (input: CreateDocumentInput) => Promise<void>
  updateProjectDocument: (input: UpdateDocumentInput) => Promise<void>
  deleteProjectDocument: (input: DeleteDocumentInput) => Promise<void>
  savePlanItem: (input: SavePlanItemInput) => Promise<void>
  deletePlanItem: (input: DeletePlanItemInput) => Promise<void>
  addWorklog: (input: SaveWorklogInput) => Promise<void>
  raiseDelay: (input: {
    projectId: string
    taskId: string
    requesterId: string
    reason: string
    impact: string
  }) => Promise<void>
  saveAllocation: (input: SaveAllocationInput) => Promise<void>
  saveRisk: (input: SaveRiskInput) => Promise<void>
  deleteRisk: (input: { projectId: string; riskId: string }) => Promise<void>
  updateCatalogGroup: <K extends keyof Catalogs>(
    group: K,
    values: Catalogs[K],
  ) => Promise<void>
  resetDemoData: () => Promise<void>
  // v3.2 close workflow
  pauseProject: (projectId: string, reason: string) => Promise<void>
  resumeProject: (projectId: string, reason: string) => Promise<void>
  requestProjectClose: (projectId: string, note: string) => Promise<string>
  ksvDecideClose: (
    projectId: string,
    closeRequestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) => Promise<void>
  tchcDecideClose: (
    projectId: string,
    closeRequestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) => Promise<void>
  getUser: (userId?: string) => User | null
}

const emptySnapshot: AppSnapshot = {
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

const AppContext = createContext<AppContextValue | null>(null)

const REALTIME_TABLES = [
  'projects',
  'plan_items',
  'worklogs',
  'delay_raises',
  'project_documents',
  'project_risks',
  'monthly_allocations',
  'project_members',
  'activity_logs',
  'profiles',
  'catalog_groups',
] as const

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppSnapshot>(emptySnapshot)
  const [isLoading, setIsLoading] = useState(true)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  async function refresh() {
    const snapshot = await apiClient.getSnapshot()
    setState(snapshot)
  }

  refreshRef.current = refresh

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      const snapshot = await apiClient.getSnapshot()
      if (mounted) {
        setState(snapshot)
        setIsLoading(false)
      }
    }
    void bootstrap()

    // Refresh whenever the auth state changes (login, logout, token refresh).
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setState(emptySnapshot)
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void refreshRef.current()
      }
    })

    // Realtime: any change on the QLDA tables triggers a snapshot refresh.
    // Pattern A from the implementation plan — simple and correct; granular
    // row-merging is deferred until refresh storms become a measurable issue.
    const channel = supabase.channel('qlda-app')
    for (const table of REALTIME_TABLES) {
      channel.on(
        // The channel API uses a string literal we must pass through.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          void refreshRef.current()
        },
      )
    }
    void channel.subscribe()

    return () => {
      mounted = false
      authSub.subscription.unsubscribe()
      void supabase.removeChannel(channel)
    }
  }, [])

  async function login(identifier: string, password: string): Promise<LoginResult> {
    const snapshot = await apiClient.login(identifier, password)
    if (!snapshot) {
      return {
        ok: false,
        message: 'Sai tài khoản hoặc mật khẩu. Hãy dùng các tài khoản demo bên dưới.',
      }
    }
    setState(snapshot)
    return { ok: true }
  }

  async function logout() {
    const snapshot = await apiClient.logout()
    setState(snapshot)
  }

  async function createProject(input: CreateProjectInput) {
    const snapshot = await apiClient.createProject(input)
    setState(snapshot)
  }

  async function updateProject(input: UpdateProjectInput) {
    const snapshot = await apiClient.updateProject(input)
    setState(snapshot)
  }

  async function addProjectDocument(input: CreateDocumentInput) {
    const snapshot = await apiClient.addProjectDocument(input)
    setState(snapshot)
  }

  async function updateProjectDocument(input: UpdateDocumentInput) {
    const snapshot = await apiClient.updateProjectDocument(input)
    setState(snapshot)
  }

  async function deleteProjectDocument(input: DeleteDocumentInput) {
    const snapshot = await apiClient.deleteProjectDocument(input)
    setState(snapshot)
  }

  async function savePlanItem(input: SavePlanItemInput) {
    const snapshot = await apiClient.savePlanItem(input)
    setState(snapshot)
  }

  async function deletePlanItem(input: DeletePlanItemInput) {
    const snapshot = await apiClient.deletePlanItem(input)
    setState(snapshot)
  }

  async function addWorklog(input: SaveWorklogInput) {
    const snapshot = await apiClient.addWorklog(input)
    setState(snapshot)
  }

  async function raiseDelay(input: {
    projectId: string
    taskId: string
    requesterId: string
    reason: string
    impact: string
  }) {
    const snapshot = await apiClient.raiseDelay(input)
    setState(snapshot)
  }

  async function saveAllocation(input: SaveAllocationInput) {
    const snapshot = await apiClient.saveAllocation(input)
    setState(snapshot)
  }

  async function saveRisk(input: SaveRiskInput) {
    const snapshot = await apiClient.saveRisk(input)
    setState(snapshot)
  }

  async function deleteRisk(input: { projectId: string; riskId: string }) {
    const snapshot = await apiClient.deleteRisk(input)
    setState(snapshot)
  }

  async function updateCatalogGroup<K extends keyof Catalogs>(
    group: K,
    values: Catalogs[K],
  ) {
    const snapshot = await apiClient.updateCatalogGroup(group, values)
    setState(snapshot)
  }

  async function resetDemoData() {
    const snapshot = await apiClient.resetDemoData()
    setState(snapshot)
  }

  async function pauseProject(projectId: string, reason: string) {
    const snapshot = await apiClient.pauseProject(projectId, reason)
    setState(snapshot)
  }

  async function resumeProject(projectId: string, reason: string) {
    const snapshot = await apiClient.resumeProject(projectId, reason)
    setState(snapshot)
  }

  async function requestProjectClose(projectId: string, note: string): Promise<string> {
    const result = await apiClient.requestProjectClose(projectId, note)
    const { closeRequestId, ...snapshot } = result
    setState(snapshot)
    return closeRequestId
  }

  async function ksvDecideClose(
    projectId: string,
    closeRequestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason = '',
  ) {
    const snapshot = await apiClient.ksvDecideClose(projectId, closeRequestId, decision, reason)
    setState(snapshot)
  }

  async function tchcDecideClose(
    projectId: string,
    closeRequestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason = '',
  ) {
    const snapshot = await apiClient.tchcDecideClose(projectId, closeRequestId, decision, reason)
    setState(snapshot)
  }

  function getUser(userId?: string) {
    if (!userId) {
      return null
    }

    return state.users.find((user) => user.id === userId) ?? null
  }

  return (
    <AppContext.Provider
      value={{
        ...state,
        isLoading,
        login,
        logout,
        refresh,
        createProject,
        updateProject,
        addProjectDocument,
        updateProjectDocument,
        deleteProjectDocument,
        savePlanItem,
        deletePlanItem,
        addWorklog,
        raiseDelay,
        saveAllocation,
        saveRisk,
        deleteRisk,
        updateCatalogGroup,
        resetDemoData,
        pauseProject,
        resumeProject,
        requestProjectClose,
        ksvDecideClose,
        tchcDecideClose,
        getUser,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppData() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAppData must be used within AppProvider')
  }

  return context
}
