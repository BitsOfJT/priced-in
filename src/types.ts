export const budgetCategories = ['housing', 'groceries', 'transportation', 'utilities', 'other'] as const
export type BudgetCategory = (typeof budgetCategories)[number]
export type Recurrence = 'weekly' | 'monthly' | 'annual'
export type HistoryMode = 'estimated' | 'recorded'

export type BudgetLine = {
  id: string
  name: string
  category: BudgetCategory
  amount: number
  recurrence: Recurrence
  fixed?: boolean
}

export type BudgetSnapshot = {
  month: string
  values: Partial<Record<BudgetCategory, number>>
  createdAt: string
}

export type LedgerItem = {
  id: string
  name: string
  category: string
  amount: number
  currency: 'USD' | 'BTC'
  createdAt: string
}

export type Holding = { id: string; ticker: string; allocation: number }
export type InvestmentScenario = { startingCapital: number; holdings: Holding[]; startMonth: string; endMonth: string }

export type CpiObservation = { month: string; series: string; value: number }
export type BtcObservation = { date: string; close: number }
export type SourceState = 'fresh' | 'cached' | 'unavailable'
export type DataEnvelope<T> = { data: T; source: string; retrievedAt: string; status: SourceState; message?: string }

export type TimelinePoint = {
  month: string
  dollarCost: number | null
  bitcoinCost: number | null
  btcUsd: number | null
  dollarIndex: number | null
  bitcoinIndex: number | null
  monthsPerBtc: number | null
  categories: Partial<Record<BudgetCategory, number>>
}

export type ComparisonResult = {
  points: TimelinePoint[]
  start?: TimelinePoint
  end?: TimelinePoint
  dollarChange: number | null
  bitcoinChange: number | null
  categoryChanges: Partial<Record<BudgetCategory, number>>
}
