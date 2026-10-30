/**
 * Demo data store. Holds the mock DB in memory, persists it to localStorage
 * (clearly labelled as demo data in the UI) and exposes simulated async
 * actions with latency and optional injected failures.
 *
 * To integrate a real backend, replace `useActions` / `usePageLoad` with API
 * calls; components do not touch the DB shape directly except via selectors.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeed, DB_VERSION, type DB } from './seed'
import * as A from './actions'
import { ApiError, type Actor } from './actions'
import { sleep } from '@/lib/cn'

const DB_KEY = 'niroo-demo-db'
const DEMO_KEY = 'niroo-demo-settings'

export interface DemoSettings {
  failNetwork: boolean
  slow: boolean
  /** Simulated Jalali day of month (for the "advance from day 10" rule); null = real date */
  dayOverride: number | null
  emptyMode: boolean
}

const defaultDemo: DemoSettings = { failNetwork: false, slow: false, dayOverride: null, emptyMode: false }

interface StoreValue {
  db: DB
  dbRef: React.RefObject<DB>
  commit: (next: DB) => void
  reset: () => void
  demo: DemoSettings
  setDemo: (patch: Partial<DemoSettings>) => void
}

const StoreContext = createContext<StoreValue | null>(null)

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === DB_VERSION) return parsed
    }
  } catch {
    /* corrupted storage → reseed */
  }
  return createSeed()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDb)
  const dbRef = useRef(db)
  const [demo, setDemoState] = useState<DemoSettings>(() => {
    try {
      return { ...defaultDemo, ...JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}') }
    } catch {
      return defaultDemo
    }
  })

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(db))
      } catch {
        /* quota exceeded (large previews) — keep in memory only */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [db])

  useEffect(() => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo))
  }, [demo])

  // Flush pending writes when the tab is hidden or closed (the debounce above may not have fired yet)
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(dbRef.current))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])

  const commit = useCallback((next: DB) => {
    dbRef.current = next
    setDb(next)
  }, [])

  const reset = useCallback(() => {
    const fresh = createSeed()
    commit(fresh)
  }, [commit])

  const setDemo = useCallback((patch: Partial<DemoSettings>) => setDemoState((d) => ({ ...d, ...patch })), [])

  const value = useMemo(() => ({ db, dbRef, commit, reset, demo, setDemo }), [db, commit, reset, demo, setDemo])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside StoreProvider')
  return ctx
}

export function useDB() {
  return useStore().db
}

export function useDemo() {
  const { demo, setDemo } = useStore()
  return { demo, setDemo }
}

async function latency(demo: DemoSettings) {
  await sleep(demo.slow ? 1600 + Math.random() * 900 : 280 + Math.random() * 320)
}

type ActionFn = (db: DB, actor: Actor, ...args: never[]) => unknown
type Bound<F> = F extends (db: DB, actor: Actor, ...args: infer P) => infer R ? (...args: P) => Promise<R> : never

const ACTIONS = {
  saveDraft: A.saveDraft,
  submitRequest: A.submitRequest,
  resubmitRequest: A.resubmitRequest,
  cancelRequest: A.cancelRequest,
  deleteDraft: A.deleteDraft,
  addRequestMessage: A.addRequestMessage,
  decideRequest: A.decideRequest,
  executeRequest: A.executeRequest,
  referRequest: A.referRequest,
  startReview: A.startReview,
  addInternalNote: A.addInternalNote,
  markContractViewed: A.markContractViewed,
  signContractByEmployee: A.signContractByEmployee,
  sendContractForSignature: A.sendContractForSignature,
  remindContract: A.remindContract,
  advanceContractStage: A.advanceContractStage,
  signContractAsParty: A.signContractAsParty,
  createWorkerContract: A.createWorkerContract,
  uploadPersonnelDocument: A.uploadPersonnelDocument,
  reviewDocument: A.reviewDocument,
  updateEmployeeFields: A.updateEmployeeFields,
  removeFromProject: A.removeFromProject,
  requestTermination: A.requestTermination,
  applyImport: A.applyImport,
  addEmployee: A.addEmployee,
  createProject: A.createProject,
  updateProject: A.updateProject,
  createTask: A.createTask,
  updateTask: A.updateTask,
  addTaskComment: A.addTaskComment,
  uploadOrgFile: A.uploadOrgFile,
  reviewOrgFile: A.reviewOrgFile,
  upsertUser: A.upsertUser,
  updateRequestType: A.updateRequestType,
  updateAlertRule: A.updateAlertRule,
  updateSettings: A.updateSettings,
  upsertOrganization: A.upsertOrganization,
  changePassword: A.changePassword,
  revokeSessions: A.revokeSessions,
  createTicket: A.createTicket,
  replyTicket: A.replyTicket,
} satisfies Record<string, ActionFn>

export type Actions = { [K in keyof typeof ACTIONS]: Bound<(typeof ACTIONS)[K]> } & {
  /** Instant, local-only UI state changes (no simulated network) */
  markNotifications: (ids: string[], read?: boolean) => void
}

/**
 * Returns async, simulated-network versions of every mutation bound to the
 * given actor. Failures (network / conflict / validation) reject with ApiError
 * and leave the DB untouched, so forms can keep the user's input.
 */
export function useActionsFor(actor: Actor | null): Actions {
  const { dbRef, commit, demo } = useStore()
  const demoRef = useRef(demo)
  demoRef.current = demo
  const actorRef = useRef(actor)
  actorRef.current = actor

  return useMemo(() => {
    const out: Record<string, unknown> = {}
    for (const [name, fn] of Object.entries(ACTIONS)) {
      out[name] = async (...args: unknown[]) => {
        await latency(demoRef.current)
        if (demoRef.current.failNetwork) throw new ApiError('network', 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.')
        if (!actorRef.current) throw new ApiError('expired', 'نشست شما به پایان رسیده است. دوباره وارد شوید.')
        const draft = structuredClone(dbRef.current)
        const result = (fn as (...a: unknown[]) => unknown)(draft, actorRef.current, ...args)
        commit(draft)
        return result
      }
    }
    out.markNotifications = (ids: string[], read = true) => {
      const draft = structuredClone(dbRef.current)
      A.markNotifications(draft, ids, read)
      commit(draft)
    }
    return out as Actions
  }, [commit, dbRef])
}

/**
 * Simulates fetching a page's data: a short loading phase, then success or a
 * network error (when the demo "network failure" switch is on).
 */
export function usePageLoad(key: string = '') {
  const { demo } = useStore()
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [attempt, setAttempt] = useState(0)
  const failRef = useRef(demo.failNetwork)
  failRef.current = demo.failNetwork
  const slowRef = useRef(demo.slow)
  slowRef.current = demo.slow

  useEffect(() => {
    let alive = true
    setState('loading')
    const ms = slowRef.current ? 1800 : 220 + Math.random() * 260
    const t = setTimeout(() => {
      if (!alive) return
      setState(failRef.current ? 'error' : 'ready')
    }, ms)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [key, attempt])

  return { state, retry: () => setAttempt((a) => a + 1), empty: demo.emptyMode }
}

export { ApiError }
