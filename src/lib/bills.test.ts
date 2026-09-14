import { describe, expect, it } from 'vitest'
import type { Bill, BillPayment } from '../types'
import { billChange, billsTimeline, loggedCount, mergeSnapshots, monthComplete, monthTotal, snapshotsFromBills, totalChange } from './bills'

const bills: Bill[] = [
  { id: 'rent', name: 'Rent', category: 'housing', createdAt: '' },
  { id: 'power', name: 'Electric', category: 'utilities', createdAt: '' },
]

describe('bills calculations', () => {
  it('totals only logged amounts and requires completeness', () => {
    const payments: BillPayment[] = [{ billId: 'rent', month: '2024-01', amount: 1000 }]
    expect(monthTotal(bills, payments, '2024-01')).toBe(1000)
    expect(monthComplete(bills, payments, '2024-01')).toBe(false)
    payments.push({ billId: 'power', month: '2024-01', amount: 120 })
    expect(monthComplete(bills, payments, '2024-01')).toBe(true)
    expect(monthTotal(bills, payments, '2024-01')).toBe(1120)
  })

  it('computes bill change across prior logged month', () => {
    const payments: BillPayment[] = [
      { billId: 'power', month: '2024-01', amount: 100 },
      { billId: 'power', month: '2024-03', amount: 150 },
    ]
    expect(billChange(payments, 'power', '2024-03')).toBeCloseTo(50)
    expect(billChange(payments, 'power', '2024-01')).toBeNull()
  })

  it('leaves timeline gaps when months are incomplete', () => {
    const payments: BillPayment[] = [
      { billId: 'rent', month: '2024-01', amount: 1000 },
      { billId: 'power', month: '2024-01', amount: 100 },
      { billId: 'rent', month: '2024-02', amount: 1000 },
    ]
    const timeline = billsTimeline(bills, payments, [{ date: '2024-01-31', close: 40000 }, { date: '2024-02-29', close: 50000 }], ['2024-01', '2024-02'])
    expect(timeline[0].total).toBe(1100)
    expect(timeline[0].btcTotal).toBeCloseTo(1100 / 40000)
    expect(timeline[1].total).toBeNull()
  })

  it('derives snapshots only for complete months and merges with manual', () => {
    const payments: BillPayment[] = [
      { billId: 'rent', month: '2024-01', amount: 1000 },
      { billId: 'power', month: '2024-01', amount: 100 },
    ]
    const derived = snapshotsFromBills(bills, payments)
    expect(derived).toHaveLength(1)
    expect(derived[0].values.housing).toBe(1000)
    const merged = mergeSnapshots([{ month: '2024-01', values: { housing: 1, groceries: 1, transportation: 1, utilities: 1, other: 1 }, createdAt: '' }], derived)
    expect(merged[0].values.housing).toBe(1)
  })

  it('counts logged bills and total change only when both months complete', () => {
    const payments: BillPayment[] = [
      { billId: 'rent', month: '2024-01', amount: 1000 },
      { billId: 'power', month: '2024-01', amount: 100 },
      { billId: 'rent', month: '2024-02', amount: 1100 },
      { billId: 'power', month: '2024-02', amount: 100 },
    ]
    expect(loggedCount(bills, payments, '2024-02')).toEqual({ logged: 2, total: 2 })
    expect(totalChange(bills, payments, '2024-02')).toBeCloseTo(100 / 1100 * 100)
  })
})
