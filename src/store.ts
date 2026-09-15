import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bill, BudgetLine, BudgetSnapshot, InvestmentScenario, LedgerItem } from './types'
import { defaultStore, LEGACY_KEY, LEGACY_REBUILD_KEY, migrateLegacy, migrateRebuild, STORE_KEY, STORE_VERSION, RECOVERY_KEY, parseImport, exportStore } from './lib/storage'
import { monthlyAmount } from './lib/calculations'

type AppState = ReturnType<typeof defaultStore> & {
  setUseExample: (value: boolean) => void
  setLines: (lines: BudgetLine[]) => void
  saveSnapshot: (snapshot: BudgetSnapshot) => void
  removeSnapshot: (month: string) => void
  setInvestment: (investment: InvestmentScenario) => void
  upsertSavedItem: (item: LedgerItem) => void
  deleteSavedItem: (id: string) => void
  upsertBill: (bill: Bill) => void
  deleteBill: (id: string) => void
  setBillArchived: (id: string, archived: boolean) => void
  setPayment: (billId: string, month: string, amount: number | null) => void
  seedBillsFromBudget: () => void
  importData: (raw: unknown) => boolean
}

const legacy = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_KEY) : null
const rebuildLegacy = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_REBUILD_KEY) : null

export const useAppStore = create<AppState>()(persist((set, get) => ({
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
  upsertBill: (bill) => set((state) => ({ bills: [...state.bills.filter((b) => b.id !== bill.id), bill].sort((a, b) => a.name.localeCompare(b.name)) })),
  deleteBill: (id) => set((state) => ({ bills: state.bills.filter((b) => b.id !== id), billPayments: state.billPayments.filter((p) => p.billId !== id) })),
  setBillArchived: (id, archived) => set((state) => ({ bills: state.bills.map((b) => b.id === id ? { ...b, archived } : b) })),
  setPayment: (billId, month, amount) => set((state) => {
    const rest = state.billPayments.filter((p) => !(p.billId === billId && p.month === month))
    if (amount === null || !Number.isFinite(amount)) return { billPayments: rest }
    return { billPayments: [...rest, { billId, month, amount }] }
  }),
  seedBillsFromBudget: () => {
    const { personalLines, bills } = get()
    if (bills.length || !personalLines.length) return
    const seeded: Bill[] = personalLines.map((line) => ({
      id: crypto.randomUUID(),
      name: line.name,
      category: line.category,
      expectedAmount: monthlyAmount(line.amount, line.recurrence),
      createdAt: new Date().toISOString(),
    }))
    set({ bills: seeded })
  },
  importData: (raw) => {
    if (!raw || typeof raw !== 'object') return false
    const incoming = parseImport(JSON.stringify(raw))
    if (!incoming) return false
    try {
      const previous = useAppStore.getState()
      window.localStorage.setItem(RECOVERY_KEY, exportStore({ ...previous, version: STORE_VERSION, bills: previous.bills, billPayments: previous.billPayments, selectedCatalogIds: previous.selectedCatalogIds }))
      set({ ...defaultStore(), ...incoming, version: STORE_VERSION })
    } catch { return false }
    return true
  },
}), { name: STORE_KEY, version: STORE_VERSION, migrate: (persisted) => ({ ...defaultStore(), ...(persisted as Partial<AppState>), version: STORE_VERSION }) }))
