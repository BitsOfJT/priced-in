import { btcValue } from './calculations'
import { budgetCategories, type Bill, type BillPayment, type BudgetCategory, type BudgetSnapshot, type BtcObservation } from '../types'

export function paymentFor(payments: BillPayment[], billId: string, month: string): number | undefined {
  const entry = payments.find((p) => p.billId === billId && p.month === month)
  return entry && Number.isFinite(entry.amount) ? entry.amount : undefined
}

export function activeBills(bills: Bill[]): Bill[] {
  return bills.filter((b) => !b.archived)
}

export function monthTotal(bills: Bill[], payments: BillPayment[], month: string, includeArchived = false): number {
  const list = includeArchived ? bills : activeBills(bills)
  return list.reduce((sum, bill) => sum + (paymentFor(payments, bill.id, month) ?? 0), 0)
}

export function monthsWithPayments(payments: BillPayment[]): string[] {
  return [...new Set(payments.map((p) => p.month))].sort()
}

export function monthComplete(bills: Bill[], payments: BillPayment[], month: string): boolean {
  const list = activeBills(bills)
  if (!list.length) return false
  return list.every((bill) => paymentFor(payments, bill.id, month) !== undefined)
}

export function previousLoggedMonth(payments: BillPayment[], billId: string, beforeMonth: string): string | undefined {
  const months = [...new Set(payments.filter((p) => p.billId === billId && p.month < beforeMonth).map((p) => p.month))].sort()
  return months.at(-1)
}

export function billChange(payments: BillPayment[], billId: string, month: string): number | null {
  const current = paymentFor(payments, billId, month)
  const prevMonth = previousLoggedMonth(payments, billId, month)
  if (current === undefined || !prevMonth) return null
  const previous = paymentFor(payments, billId, prevMonth)
  if (previous === undefined || previous === 0) return null
  return (current - previous) / previous * 100
}

export function totalChange(bills: Bill[], payments: BillPayment[], month: string): number | null {
  const current = monthTotal(bills, payments, month)
  const prevMonths = monthsWithPayments(payments).filter((m) => m < month)
  const prevMonth = prevMonths.at(-1)
  if (!prevMonth || !monthComplete(bills, payments, month) || !monthComplete(bills, payments, prevMonth)) return null
  const previous = monthTotal(bills, payments, prevMonth)
  if (previous === 0) return null
  return (current - previous) / previous * 100
}

export type BillTimelinePoint = { month: string; total: number | null; btcTotal: number | null; btcUsd: number | null }

export function billsTimeline(bills: Bill[], payments: BillPayment[], btc: BtcObservation[], months: string[]): BillTimelinePoint[] {
  return months.map((month) => {
    const complete = monthComplete(bills, payments, month)
    const total = complete ? monthTotal(bills, payments, month) : null
    const btcUsd = btcValue(btc, month) ?? null
    const btcTotal = total !== null && btcUsd ? total / btcUsd : null
    return { month, total, btcTotal, btcUsd }
  })
}

export function snapshotsFromBills(bills: Bill[], payments: BillPayment[]): BudgetSnapshot[] {
  const months = monthsWithPayments(payments).filter((month) => monthComplete(bills, payments, month))
  return months.map((month) => {
    const values: Partial<Record<BudgetCategory, number>> = {}
    budgetCategories.forEach((category) => {
      values[category] = activeBills(bills)
        .filter((b) => b.category === category)
        .reduce((sum, bill) => sum + (paymentFor(payments, bill.id, month) ?? 0), 0)
    })
    return { month, values, createdAt: new Date().toISOString() }
  })
}

export function mergeSnapshots(manual: BudgetSnapshot[], derived: BudgetSnapshot[]): BudgetSnapshot[] {
  const byMonth = new Map<string, BudgetSnapshot>()
  derived.forEach((s) => byMonth.set(s.month, s))
  manual.forEach((s) => byMonth.set(s.month, s))
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function monthWindow(endMonth: string, count: number): string[] {
  const output: string[] = []
  const cursor = new Date(`${endMonth}-01T12:00:00`)
  for (let i = 0; i < count; i++) {
    output.unshift(cursor.toISOString().slice(0, 7))
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return output
}

export function loggedCount(bills: Bill[], payments: BillPayment[], month: string): { logged: number; total: number } {
  const list = activeBills(bills)
  const logged = list.filter((b) => paymentFor(payments, b.id, month) !== undefined).length
  return { logged, total: list.length }
}
