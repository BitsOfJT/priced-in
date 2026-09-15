import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BudgetLine, BudgetSnapshot, InvestmentScenario, LedgerItem } from './types'
import { defaultStore, LEGACY_KEY, LEGACY_REBUILD_KEY, migrateLegacy, migrateRebuild, STORE_KEY, STORE_VERSION, RECOVERY_KEY, parseImport, exportStore } from './lib/storage'

type AppState = ReturnType<typeof defaultStore> & {
  setUseExample: (value: boolean) => void
  setLines: (lines: BudgetLine[]) => void
  saveSnapshot: (snapshot: BudgetSnapshot) => void
  removeSnapshot: (month: string) => void
  setInvestment: (investment: InvestmentScenario) => void
  upsertSavedItem: (item: LedgerItem) => void
  deleteSavedItem: (id: string) => void
  importData: (raw: unknown) => boolean
}

const legacy = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_KEY) : null
const rebuildLegacy = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_REBUILD_KEY) : null

export const useAppStore = create<AppState>()(persist((set) => ({
  ...defaultStore(),
  ...migrateLegacy(legacy),
  ...migrateRebuild(rebuildLegacy),
  setUseExample: (useExample) => set({ useExample }),
  setLines: (personalLines) => set({ personalLines, useExample: false }),
  saveSnapshot: (snapshot) => set((state) => ({ snapshots: [...state.snapshots.filter((item) => item.month !== snapshot.month), snapshot].sort((a, b) => a.month.localeCompare(b.month)) })),
  removeSnapshot: (month) => set((state) => ({ snapshots: state.snapshots.filter((item) => item.month !== month) })),
  setInvestment: (investment) => set({ investment }),
  upsertSavedItem: (item) => set((state) => ({ savedItems: [...state.savedItems.filter((entry) => entry.id !== item.id), item].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })),
  deleteSavedItem: (id) => set((state) => ({ savedItems: state.savedItems.filter((entry) => entry.id !== id) })),
  importData: (raw) => {
    if (!raw || typeof raw !== 'object') return false
    const incoming = parseImport(JSON.stringify(raw))
    if (!incoming) return false
    try {
      const previous = useAppStore.getState()
      window.localStorage.setItem(RECOVERY_KEY, exportStore({ version: STORE_VERSION, useExample: previous.useExample, personalLines: previous.personalLines, snapshots: previous.snapshots, savedItems: previous.savedItems, investment: previous.investment, importedLegacy: previous.importedLegacy, selectedCatalogIds: previous.selectedCatalogIds }))
      set({ ...defaultStore(), ...incoming, version: STORE_VERSION })
    } catch {
      return false
    }
    return true
  },
}), { name: STORE_KEY, version: STORE_VERSION, migrate: (persisted) => ({ ...defaultStore(), ...(persisted as Partial<AppState>), version: STORE_VERSION }) }))
