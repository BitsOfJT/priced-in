import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BudgetLine, BudgetSnapshot, InvestmentScenario, LedgerItem } from './types'
import { defaultStore, LEGACY_KEY, migrateLegacy, STORE_KEY, STORE_VERSION } from './lib/storage'

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

export const useAppStore = create<AppState>()(persist((set) => ({
  ...defaultStore(),
  ...migrateLegacy(legacy),
  setUseExample: (useExample) => set({ useExample }),
  setLines: (personalLines) => set({ personalLines, useExample: false }),
  saveSnapshot: (snapshot) => set((state) => ({ snapshots: [...state.snapshots.filter((item) => item.month !== snapshot.month), snapshot].sort((a, b) => a.month.localeCompare(b.month)) })),
  removeSnapshot: (month) => set((state) => ({ snapshots: state.snapshots.filter((item) => item.month !== month) })),
  setInvestment: (investment) => set({ investment }),
  upsertSavedItem: (item) => set((state) => ({ savedItems: [...state.savedItems.filter((entry) => entry.id !== item.id), item].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })),
  deleteSavedItem: (id) => set((state) => ({ savedItems: state.savedItems.filter((entry) => entry.id !== id) })),
  importData: (raw) => {
    if (!raw || typeof raw !== 'object') return false
    const incoming = raw as Partial<AppState>
    if (incoming.version !== STORE_VERSION || !Array.isArray(incoming.personalLines) || !Array.isArray(incoming.savedItems)) return false
    set({ ...defaultStore(), ...incoming, version: STORE_VERSION })
    return true
  },
}), { name: STORE_KEY, version: STORE_VERSION }))
