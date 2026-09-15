import type { BudgetCategory, BudgetLine, BudgetSnapshot, BtcObservation, ComparisonResult, CpiObservation, HistoryMode, TimelinePoint } from '../types'

const cpiSeries: Record<BudgetCategory, string> = {
  housing: 'CUUR0000SEHA', groceries: 'CUUR0000SAF11', transportation: 'CUUR0000SAT',
  utilities: 'CUUR0000SAH2', other: 'CUUR0000SA0',
}

export const monthlyAmount = (amount: number, recurrence: BudgetLine['recurrence']) =>
  recurrence === 'weekly' ? amount * 52 / 12 : recurrence === 'annual' ? amount / 12 : amount

export const totalMonthly = (lines: BudgetLine[]) => lines.reduce((sum, line) => sum + monthlyAmount(line.amount, line.recurrence), 0)
export const monthLabel = (month: string) => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))
export const uniqueMonths = (months: string[]) => [...new Set(months)].sort()

function cpiValue(cpi: CpiObservation[], month: string, category: BudgetCategory) {
  return cpi.find((entry) => entry.month === month && entry.series === cpiSeries[category])?.value
}

function btcValue(history: BtcObservation[], month: string) {
  return history.find((entry) => entry.date.slice(0, 7) === month)?.close
}

function lineByCategory(lines: BudgetLine[], category: BudgetCategory) {
  return lines.filter((line) => line.category === category)
}

function estimatedValues(lines: BudgetLine[], month: string, referenceMonth: string, cpi: CpiObservation[]) {
  const values: Partial<Record<BudgetCategory, number>> = {}
  let complete = true
  ;(['housing', 'groceries', 'transportation', 'utilities', 'other'] as BudgetCategory[]).forEach((category) => {
    values[category] = lineByCategory(lines, category).reduce((sum, line) => {
      const amount = monthlyAmount(line.amount, line.recurrence)
      if (line.fixed) return sum + amount
      const index = cpiValue(cpi, month, category)
      const referenceIndex = cpiValue(cpi, referenceMonth, category)
      if (!(index && referenceIndex && index > 0 && referenceIndex > 0)) {
        complete = false
        return sum
      }
      return sum + amount * index / referenceIndex
    }, 0)
  })
  return { values, complete }
}

export function recordedIsComplete(snapshot: BudgetSnapshot) {
  return ['housing', 'groceries', 'transportation', 'utilities', 'other'].every((category) => typeof snapshot.values[category as BudgetCategory] === 'number')
}

export function buildComparison({
  lines, snapshots, mode, referenceMonth, cpi, btc, months,
}: { lines: BudgetLine[]; snapshots: BudgetSnapshot[]; mode: HistoryMode; referenceMonth: string; cpi: CpiObservation[]; btc: BtcObservation[]; months: string[] }): ComparisonResult {
  const points: TimelinePoint[] = uniqueMonths(months).map((month) => {
    const snapshot = snapshots.find((item) => item.month === month)
    const estimated = mode === 'estimated' ? estimatedValues(lines, month, referenceMonth, cpi) : null
    const categories = mode === 'recorded'
      ? (snapshot && recordedIsComplete(snapshot) ? snapshot.values : {})
      : estimated!.values
    const complete = mode === 'estimated' ? Boolean(estimated?.complete) : Boolean(snapshot && recordedIsComplete(snapshot))
    const dollarCost = complete ? Object.values(categories).reduce((sum, value) => sum + (value ?? 0), 0) : null
    const btcUsd = btcValue(btc, month) ?? null
    const bitcoinCost = dollarCost && btcUsd ? dollarCost / btcUsd : null
    return { month, dollarCost, bitcoinCost, btcUsd, dollarIndex: null, bitcoinIndex: null, monthsPerBtc: dollarCost && btcUsd ? btcUsd / dollarCost : null, categories }
  })
  const start = points.find((item) => item.dollarCost !== null && item.bitcoinCost !== null)
  const end = [...points].reverse().find((item) => item.dollarCost !== null && item.bitcoinCost !== null)
  const indexed = points.map((point) => ({
    ...point,
    dollarIndex: start?.dollarCost && point.dollarCost !== null ? point.dollarCost / start.dollarCost * 100 : null,
    bitcoinIndex: start?.bitcoinCost && point.bitcoinCost !== null ? point.bitcoinCost / start.bitcoinCost * 100 : null,
  }))
  const indexedStart = indexed.find((point) => point.month === start?.month)
  const indexedEnd = [...indexed].reverse().find((point) => point.month === end?.month)
  const categoryChanges: Partial<Record<BudgetCategory, number>> = {}
  if (start && end) {
    const endPoint = end
    ;(['housing', 'groceries', 'transportation', 'utilities', 'other'] as BudgetCategory[]).forEach((category) => {
      const first = start.categories[category] ?? 0
      const last = endPoint.categories[category] ?? 0
      categoryChanges[category] = first ? (last - first) / first * 100 : 0
    })
  }
  const dollarChange = start && end && start.dollarCost !== null && end.dollarCost !== null && start.dollarCost !== 0 ? (end.dollarCost - start.dollarCost) / start.dollarCost * 100 : null
  const bitcoinChange = start && end && start.bitcoinCost !== null && end.bitcoinCost !== null && start.bitcoinCost !== 0 ? (end.bitcoinCost - start.bitcoinCost) / start.bitcoinCost * 100 : null
  return {
    points: indexed, start: indexedStart, end: indexedEnd,
    dollarChange, bitcoinChange,
    categoryChanges,
  }
}

export function validateAllocations(lines: { allocation: number }[]) {
  return lines.length > 0 && lines.every((item) => Number.isFinite(item.allocation) && item.allocation >= 0) && Math.abs(lines.reduce((sum, item) => sum + item.allocation, 0) - 100) < 0.001
}

export function investmentValue(capital: number, adjustedStart: number, adjustedEnd: number) {
  if (adjustedStart <= 0 || adjustedEnd <= 0) return null
  return capital * adjustedEnd / adjustedStart
}
