import { z } from 'zod'
import type { Bill, BillPayment, BudgetCategory, BudgetLine, BudgetSnapshot, InvestmentScenario, LedgerItem, LedgerItemKind } from '../types'

export const STORE_VERSION = 3
export const LEGACY_KEY = 'priced-in-ledger'
export const LEGACY_REBUILD_KEY = 'priced-in-v2'
export const STORE_KEY = 'priced-in-v3'
export const RECOVERY_KEY = 'priced-in-v3-recovery'

export const exampleLines: BudgetLine[] = [
  ['housing', 'Housing', 1800], ['groceries', 'Groceries', 600], ['transportation', 'Transportation', 400], ['utilities', 'Utilities', 250], ['other', 'Other expenses', 450],
].map(([category, name, amount]) => ({ id: crypto.randomUUID(), category: category as BudgetLine['category'], name: String(name), amount: Number(amount), recurrence: 'monthly' }))

export type PricedInStore = {
  version: number
  useExample: boolean
  personalLines: BudgetLine[]
  snapshots: BudgetSnapshot[]
  bills: Bill[]
  billPayments: BillPayment[]
  savedItems: LedgerItem[]
  investment: InvestmentScenario
  importedLegacy: boolean
  selectedCatalogIds: string[]
}

const defaultInvestment = (): InvestmentScenario => ({
  startingCapital: 10000,
  holdings: [{ id: crypto.randomUUID(), ticker: 'SPY', allocation: 100 }],
  startMonth: '', endMonth: '',
})

export const defaultStore = (): PricedInStore => ({ version: STORE_VERSION, useExample: false, personalLines: [], snapshots: [], bills: [], billPayments: [], savedItems: [], investment: defaultInvestment(), importedLegacy: false, selectedCatalogIds: [] })

const id = () => globalThis.crypto?.randomUUID?.() ?? `priced-in-${Date.now()}-${Math.random().toString(16).slice(2)}`
const legacyItemSchema = z.object({ id: z.string().optional(), name: z.string().min(1), category: z.string().optional(), amount: z.coerce.number().nonnegative().optional(), currency: z.enum(['USD', 'BTC']).optional(), createdAt: z.union([z.string(), z.number()]).optional(), unitUsd: z.coerce.number().positive().optional(), quantity: z.coerce.number().positive().optional(), recurrence: z.enum(['once', 'weekly', 'monthly', 'yearly']).optional(), notes: z.string().optional(), ticker: z.string().optional(), priceObservations: z.array(z.object({ period: z.string(), usd: z.coerce.number().positive(), source: z.string() })).optional(), kind: z.enum(['expense', 'purchase', 'asset']).optional(), budgetCategory: z.enum(['housing', 'groceries', 'transportation', 'utilities', 'other']).optional(), fixed: z.boolean().optional(), includeInBudget: z.boolean().optional() })
function normalizeItem(raw: unknown, namespace: string): LedgerItem | null {
  const parsed = legacyItemSchema.safeParse(raw); if (!parsed.success) return null
  const item = parsed.data; const amount = item.amount ?? item.unitUsd ?? 0; if (!Number.isFinite(amount) || amount < 0) return null
  const recurrence = item.recurrence ?? 'once'; const kind: LedgerItemKind = item.kind ?? (recurrence !== 'once' ? 'expense' : item.ticker ? 'asset' : 'purchase'); const createdAt = new Date(item.createdAt ?? Date.now()).toISOString()
  return { id: `${namespace}:${item.id ?? id()}`, name: item.name.trim(), category: item.category ?? 'other', amount, currency: item.currency ?? 'USD', createdAt, updatedAt: createdAt, kind, unitUsd: item.unitUsd ?? amount, quantity: item.quantity ?? 1, recurrence, notes: item.notes ?? '', ticker: item.ticker ?? '', priceObservations: item.priceObservations ?? [], budgetCategory: item.budgetCategory as BudgetCategory | undefined, fixed: item.fixed ?? false, includeInBudget: item.includeInBudget ?? kind === 'expense' }
}
function extractItems(raw: unknown, namespace: string): LedgerItem[] { const candidates = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : []; return candidates.map((item) => normalizeItem(item, namespace)).filter((item): item is LedgerItem => Boolean(item)) }

export function migrateLegacy(raw: string | null): Partial<PricedInStore> {
  if (!raw) return {}
  try {
    const savedItems = extractItems(JSON.parse(raw), 'legacy')
    return savedItems.length ? { savedItems, importedLegacy: true } : {}
  } catch { return {} }
}

export function migrateRebuild(raw: string | null): Partial<PricedInStore> {
  if (!raw) return {}
  try { const parsed = JSON.parse(raw) as { state?: Partial<PricedInStore> } & Partial<PricedInStore>; const state: Partial<PricedInStore> = parsed.state ?? parsed; const savedItems = extractItems(state.savedItems, 'rebuild'); const personalLines = Array.isArray(state.personalLines) ? state.personalLines : []; const budgetItems = personalLines.map((line) => normalizeItem({ id: `budget-${(line as BudgetLine).id}`, name: (line as BudgetLine).name, category: (line as BudgetLine).category, amount: (line as BudgetLine).amount, currency: 'USD', recurrence: (line as BudgetLine).recurrence === 'annual' ? 'yearly' : (line as BudgetLine).recurrence, kind: 'expense', includeInBudget: true, fixed: Boolean((line as BudgetLine).fixed) }, 'rebuild-budget')).filter((item): item is LedgerItem => Boolean(item)); return { ...((savedItems.length || budgetItems.length) ? { savedItems: [...savedItems, ...budgetItems] } : {}), ...(personalLines.length ? { personalLines, useExample: false } : {}), ...(Array.isArray(state.snapshots) ? { snapshots: state.snapshots } : {}), ...(state.investment ? { investment: state.investment } : {}), ...(Array.isArray(state.bills) ? { bills: state.bills, billPayments: state.billPayments ?? [] } : {}), importedLegacy: true } } catch { return {} }
}

export function parseStore(raw: string | null, legacyRaw: string | null, rebuildRaw: string | null = null): PricedInStore {
  const base = defaultStore()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PricedInStore>
      if (parsed.version === STORE_VERSION) return { ...base, ...parsed, version: STORE_VERSION, selectedCatalogIds: parsed.selectedCatalogIds ?? [] }
    } catch { /* recover below */ }
  }
  const migrated = migrateRebuild(rebuildRaw); const legacy = migrateLegacy(legacyRaw); const savedItems = [...(migrated.savedItems ?? []), ...(legacy.savedItems ?? [])]; const deduped = savedItems.filter((item, index) => savedItems.findIndex((candidate) => candidate.id === item.id) === index)
  return { ...base, ...migrated, ...legacy, savedItems: deduped, importedLegacy: Boolean(migrated.importedLegacy || legacy.importedLegacy) }
}

export function exportStore(store: PricedInStore) { return JSON.stringify({ ...store, version: STORE_VERSION }, null, 2) }
export function parseImport(raw: string): PricedInStore | null { try { const parsed = JSON.parse(raw) as Partial<PricedInStore>; if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.savedItems) || !Array.isArray(parsed.personalLines)) return null; return { ...defaultStore(), ...parsed, version: STORE_VERSION, selectedCatalogIds: parsed.selectedCatalogIds ?? [], bills: parsed.bills ?? [], billPayments: parsed.billPayments ?? [] } } catch { return null } }
