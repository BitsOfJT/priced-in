import type { Bill, BillPayment, BudgetLine, BudgetSnapshot, InvestmentScenario, LedgerItem } from '../types'

export const STORE_VERSION = 2
export const LEGACY_KEY = 'priced-in-ledger'
export const STORE_KEY = 'priced-in-v2'

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
}

const defaultInvestment = (): InvestmentScenario => ({
  startingCapital: 10000,
  holdings: [{ id: crypto.randomUUID(), ticker: 'SPY', allocation: 100 }],
  startMonth: '', endMonth: '',
})

export const defaultStore = (): PricedInStore => ({ version: STORE_VERSION, useExample: true, personalLines: [], snapshots: [], bills: [], billPayments: [], savedItems: [], investment: defaultInvestment(), importedLegacy: false })

function isLedger(value: unknown): value is LedgerItem[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === 'object' && 'name' in item && 'amount' in item)
}

export function migrateLegacy(raw: string | null): Partial<PricedInStore> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isLedger(parsed) ? { savedItems: parsed, importedLegacy: true } : {}
  } catch { return {} }
}

export function parseStore(raw: string | null, legacyRaw: string | null): PricedInStore {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PricedInStore>
      if (parsed.version === STORE_VERSION) return { ...defaultStore(), ...parsed, version: STORE_VERSION }
    } catch { /* recover below */ }
  }
  return { ...defaultStore(), ...migrateLegacy(legacyRaw) }
}
