import { describe, expect, it } from 'vitest'
import { buildComparison, investmentValue, monthlyAmount, recordedIsComplete, validateAllocations } from './calculations'
import type { BudgetLine, BudgetSnapshot, BtcObservation, CpiObservation } from '../types'

const lines: BudgetLine[] = [
  { id: 'home', name: 'Rent', category: 'housing', amount: 1200, recurrence: 'monthly' },
  { id: 'food', name: 'Food', category: 'groceries', amount: 100, recurrence: 'weekly' },
  { id: 'fixed', name: 'Contract', category: 'other', amount: 1200, recurrence: 'annual', fixed: true },
]
const months = ['2024-01', '2024-02']
const cpi: CpiObservation[] = [
  ...['CUUR0000SEHA', 'CUUR0000SAF11', 'CUUR0000SAT', 'CUUR0000SAH2', 'CUUR0000SA0'].flatMap((series, index) => [{ month: '2024-01', series, value: 100 + index }, { month: '2024-02', series, value: 110 + index }]),
]
const btc: BtcObservation[] = [{ date: '2024-01-31', close: 40000 }, { date: '2024-02-29', close: 50000 }]

describe('budget calculations', () => {
  it('normalizes weekly and annual recurrence', () => { expect(monthlyAmount(100, 'weekly')).toBeCloseTo(433.3333); expect(monthlyAmount(1200, 'annual')).toBe(100) })
  it('uses category-specific inflation and preserves fixed payments', () => { const result = buildComparison({ lines, snapshots: [], mode: 'estimated', referenceMonth: '2024-02', cpi, btc, months }); expect(result.start?.categories.housing).toBeCloseTo(1200 / 1.1); expect(result.start?.categories.groceries).toBeCloseTo(433.3333 * 101 / 111); expect(result.start?.categories.other).toBe(100); expect(result.start?.dollarIndex).toBe(100) })
  it('keeps incomplete recorded budgets as gaps', () => { const snapshots: BudgetSnapshot[] = [{ month: '2024-01', values: { housing: 1 }, createdAt: '' }, { month: '2024-02', values: { housing: 1, groceries: 1, transportation: 1, utilities: 1, other: 1 }, createdAt: '' }]; expect(recordedIsComplete(snapshots[0])).toBe(false); expect(buildComparison({ lines, snapshots, mode: 'recorded', referenceMonth: '2024-02', cpi, btc, months }).points[0].dollarCost).toBeNull() })
  it('keeps estimated months as gaps when a non-fixed CPI series is missing', () => { const incomplete = cpi.filter((entry) => !(entry.month === '2024-01' && entry.series === 'CUUR0000SAF11')); const result = buildComparison({ lines, snapshots: [], mode: 'estimated', referenceMonth: '2024-02', cpi: incomplete, btc, months }); expect(result.points[0].dollarCost).toBeNull() })
  it('handles allocation validation and total-return values', () => { expect(validateAllocations([{ allocation: 50 }, { allocation: 50 }])).toBe(true); expect(validateAllocations([{ allocation: 60 }, { allocation: 50 }])).toBe(false); expect(validateAllocations([{ allocation: -1 }, { allocation: 101 }])).toBe(false); expect(investmentValue(10000, 100, 125)).toBe(12500); expect(investmentValue(10000, 0, 125)).toBeNull() })
})
