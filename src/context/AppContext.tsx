import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as mockApi from '../lib/mockApi'
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
  updateCatalogGroup: <K extends keyof Catalogs>(
    group: K,
    values: Catalogs[K],
  ) => Promise<void>
  resetDemoData: () => Promise<void>
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

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppSnapshot>(emptySnapshot)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      const snapshot = await mockApi.getSnapshot()
      setState(snapshot)
      setIsLoading(false)
    }

    void bootstrap()
  }, [])

  async function refresh() {
    const snapshot = await mockApi.getSnapshot()
    setState(snapshot)
  }

  async function login(identifier: string, password: string): Promise<LoginResult> {
    const snapshot = await mockApi.login(identifier, password)

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
    const snapshot = await mockApi.logout()
    setState(snapshot)
  }

  async function createProject(input: CreateProjectInput) {
    const snapshot = await mockApi.createProject(input)
    setState(snapshot)
  }

  async function updateProject(input: UpdateProjectInput) {
    const snapshot = await mockApi.updateProject(input)
    setState(snapshot)
  }

  async function addProjectDocument(input: CreateDocumentInput) {
    const snapshot = await mockApi.addProjectDocument(input)
    setState(snapshot)
  }

  async function updateProjectDocument(input: UpdateDocumentInput) {
    const snapshot = await mockApi.updateProjectDocument(input)
    setState(snapshot)
  }

  async function deleteProjectDocument(input: DeleteDocumentInput) {
    const snapshot = await mockApi.deleteProjectDocument(input)
    setState(snapshot)
  }

  async function savePlanItem(input: SavePlanItemInput) {
    const snapshot = await mockApi.savePlanItem(input)
    setState(snapshot)
  }

  async function deletePlanItem(input: DeletePlanItemInput) {
    const snapshot = await mockApi.deletePlanItem(input)
    setState(snapshot)
  }

  async function addWorklog(input: SaveWorklogInput) {
    const snapshot = await mockApi.addWorklog(input)
    setState(snapshot)
  }

  async function raiseDelay(input: {
    projectId: string
    taskId: string
    requesterId: string
    reason: string
    impact: string
  }) {
    const snapshot = await mockApi.raiseDelay(input)
    setState(snapshot)
  }

  async function saveAllocation(input: SaveAllocationInput) {
    const snapshot = await mockApi.saveAllocation(input)
    setState(snapshot)
  }

  async function saveRisk(input: SaveRiskInput) {
    const snapshot = await mockApi.saveRisk(input)
    setState(snapshot)
  }

  async function updateCatalogGroup<K extends keyof Catalogs>(
    group: K,
    values: Catalogs[K],
  ) {
    const snapshot = await mockApi.updateCatalogGroup(group, values)
    setState(snapshot)
  }

  async function resetDemoData() {
    const snapshot = await mockApi.resetDemoData()
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
        updateCatalogGroup,
        resetDemoData,
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
