import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Archive, ChevronLeft, ChevronRight, LineChart as LineChartIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Bill, BudgetCategory } from './types'
import { budgetCategories } from './types'
import { monthLabel } from './lib/calculations'
import { getBtcHistory, getSpot } from './lib/api'
import { activeBills, billChange, billsTimeline, loggedCount, monthWindow, monthTotal, paymentFor, totalChange } from './lib/bills'
import { useAppStore } from './store'
import { btc, Button, Metric, money, Notice, percent } from './ui'

const categoryLabels: Record<BudgetCategory, string> = { housing: 'Housing', groceries: 'Groceries', transportation: 'Transportation', utilities: 'Utilities', other: 'Other expenses' }
const currentMonth = new Date().toISOString().slice(0, 7)
const fiveYearsAgo = `${new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().slice(0, 7)}`
const makeId = () => crypto.randomUUID()

function shiftMonth(month: string, delta: number) {
  const d = new Date(`${month}-01T12:00:00`)
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().slice(0, 7)
}

function BillDialog({ open, setOpen, bill, onSave }: { open: boolean; setOpen: (v: boolean) => void; bill: Bill | null; onSave: (b: Bill) => void }) {
  const [draft, setDraft] = useState<Bill | null>(null)
  useEffect(() => {
    if (!open) { setDraft(null); return }
    setDraft(bill ?? { id: makeId(), name: '', category: 'other', expectedAmount: undefined, createdAt: new Date().toISOString() })
  }, [open, bill])
  if (!draft) return null
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-ivory p-6 shadow-2xl">
          <Dialog.Title className="display text-3xl">{bill ? 'Edit bill' : 'Add bill'}</Dialog.Title>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-bold">Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 block w-full rounded-lg border border-ink/20 bg-ivory p-3" placeholder="Electric, rent, internet…" /></label>
            <label className="block text-sm font-bold">Category<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as BudgetCategory })} className="mt-1 block w-full rounded-lg border border-ink/20 bg-ivory p-3">{budgetCategories.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select></label>
            <label className="block text-sm font-bold">Expected amount <span className="font-normal text-ink/55">(optional, placeholder in grid)</span><input value={draft.expectedAmount ?? ''} type="number" min="0" step="any" onChange={(e) => setDraft({ ...draft, expectedAmount: e.target.value === '' ? undefined : Number(e.target.value) })} className="mono mt-1 block w-full rounded-lg border border-ink/20 bg-ivory p-3" /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="light" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!draft.name.trim()} onClick={() => onSave(draft)}>Save bill</Button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PaymentCell({ billId, month, expected, value, onCommit }: { billId: string; month: string; expected?: number; value: number | undefined; onCommit: (amount: number | null) => void }) {
  const [local, setLocal] = useState(value !== undefined ? String(value) : '')
  useEffect(() => { setLocal(value !== undefined ? String(value) : '') }, [value, billId, month])
  return (
    <input
      data-cell={`${billId}-${month}`}
      aria-label={`Payment for ${month}`}
      className="mono w-24 min-w-[5.5rem] rounded-md border border-ink/15 bg-ivory px-2 py-1.5 text-right text-sm"
      placeholder={expected !== undefined ? String(expected) : '—'}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const trimmed = local.trim()
        if (!trimmed) { onCommit(null); setLocal(''); return }
        const n = Number(trimmed)
        if (Number.isFinite(n) && n >= 0) onCommit(n)
        else setLocal(value !== undefined ? String(value) : '')
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

export default function BillsView() {
  const { bills, billPayments, personalLines, upsertBill, deleteBill, setBillArchived, setPayment, seedBillsFromBudget } = useAppStore()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [showArchived, setShowArchived] = useState(false)
  const [chartUnit, setChartUnit] = useState<'usd' | 'btc'>('usd')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)

  const spot = useQuery({ queryKey: ['spot'], queryFn: getSpot, refetchInterval: 60_000 })
  const { data: btcResponse } = useQuery({ queryKey: ['btc', fiveYearsAgo, currentMonth], queryFn: () => getBtcHistory(fiveYearsAgo, currentMonth) })
  const btcHistory = btcResponse?.data ?? []

  const gridMonths = useMemo(() => monthWindow(selectedMonth, 12), [selectedMonth])
  const chartMonths = useMemo(() => {
    const all = [...new Set([...gridMonths, ...billPayments.map((p) => p.month)])].sort()
    return all.length ? all : gridMonths
  }, [gridMonths, billPayments])

  const archived = bills.filter((b) => b.archived)
  const displayBills = showArchived ? bills : activeBills(bills)

  const total = monthTotal(bills, billPayments, selectedMonth)
  const { logged, total: billCount } = loggedCount(bills, billPayments, selectedMonth)
  const change = totalChange(bills, billPayments, selectedMonth)
  const spotPrice = spot.data?.data.price
  const monthBtcClose = btcHistory.find((e) => e.date.startsWith(selectedMonth))?.close
  const btcForMonth = selectedMonth === currentMonth && spotPrice ? total / spotPrice : monthBtcClose ? total / monthBtcClose : null

  const timeline = useMemo(() => billsTimeline(bills, billPayments, btcHistory, chartMonths), [bills, billPayments, btcHistory, chartMonths])
  const chartData = timeline.map((p) => ({ month: p.month, value: chartUnit === 'usd' ? p.total : p.btcTotal }))

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (bill: Bill) => { setEditing(bill); setDialogOpen(true) }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-copper-deep">Monthly bills</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">What you actually paid</h1>
          <p className="mt-3 max-w-2xl text-ink/70">Log each bill’s real amount every month. Totals and trends use only what you enter—nothing is estimated from inflation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {personalLines.length > 0 && bills.length === 0 && (
            <Button variant="light" onClick={() => seedBillsFromBudget()}>Import from my budget</Button>
          )}
          <Button onClick={openNew}><Plus className="size-4" />Add bill</Button>
        </div>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" className="rounded-lg border border-ink/15 p-2 hover:bg-paper" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}><ChevronLeft className="size-4" /></button>
          <label className="text-sm font-bold">Month<input type="month" value={selectedMonth} max={currentMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="mono ml-2 rounded-lg border border-ink/20 bg-ivory p-2" /></label>
          <button type="button" aria-label="Next month" disabled={selectedMonth >= currentMonth} className="rounded-lg border border-ink/15 p-2 hover:bg-paper disabled:opacity-40" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}><ChevronRight className="size-4" /></button>
        </div>
        <p className="text-sm text-ink/60">{logged} of {billCount} active bills logged for {monthLabel(selectedMonth)}</p>
      </section>

      {!bills.length ? (
        <Notice><span>Add your recurring bills (rent, utilities, subscriptions) to start tracking. You can import names and expected amounts from <strong>Your life → Use my budget</strong> if you already built a budget there.</span></Notice>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric title="Total paid" value={logged ? money(total) : '—'} detail={logged ? `All logged bills · ${monthLabel(selectedMonth)}` : 'Log every active bill to see a total'} />
            <Metric title="Vs prior complete month" value={percent(change)} detail="Only when this month and the previous logged month are complete" copper />
            <Metric title="In bitcoin" value={logged && btcForMonth ? btc(btcForMonth) : '—'} detail={selectedMonth === currentMonth ? 'Spot rate for today' : 'Last available monthly BTC close'} />
          </section>

          <section className="card overflow-x-auto p-4 sm:p-6">
            <p className="eyebrow text-copper-deep">Bill ledger</p>
            <h2 className="display mt-1 text-2xl">Amount paid by month</h2>
            <table className="mt-4 w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-wide text-ink/55">
                  <th className="sticky left-0 bg-ivory/95 p-2 pr-4">Bill</th>
                  {gridMonths.map((m) => <th key={m} className="p-2 font-mono font-normal">{m.slice(2).replace('-', '·')}</th>)}
                  <th className="p-2">Δ vs prior</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {displayBills.map((bill) => (
                  <tr key={bill.id} className={`border-b border-ink/8 ${bill.archived ? 'opacity-60' : ''}`}>
                    <td className="sticky left-0 bg-ivory/95 p-2 pr-4">
                      <strong>{bill.name}</strong>
                      <span className="block text-xs text-ink/55">{categoryLabels[bill.category]}{bill.archived ? ' · archived' : ''}</span>
                    </td>
                    {gridMonths.map((m) => (
                      <td key={m} className="p-2">
                        <PaymentCell
                          billId={bill.id}
                          month={m}
                          expected={bill.expectedAmount}
                          value={paymentFor(billPayments, bill.id, m)}
                          onCommit={(amount) => setPayment(bill.id, m, amount)}
                        />
                      </td>
                    ))}
                    <td className="mono p-2 text-xs">{percent(billChange(billPayments, bill.id, selectedMonth))}</td>
                    <td className="p-2">
                      <button type="button" aria-label="Edit bill" className="p-1 text-copper-deep" onClick={() => openEdit(bill)}><Pencil className="size-4" /></button>
                      {!bill.archived ? (
                        <button type="button" aria-label="Archive bill" className="p-1 text-copper-deep" onClick={() => setBillArchived(bill.id, true)}><Archive className="size-4" /></button>
                      ) : (
                        <button type="button" className="text-xs underline" onClick={() => setBillArchived(bill.id, false)}>Restore</button>
                      )}
                      <button type="button" aria-label="Delete bill" className="p-1 text-copper-deep" onClick={() => deleteBill(bill.id)}><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {archived.length > 0 && (
              <button type="button" className="mt-3 text-sm font-bold text-copper-deep underline" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Hide archived bills' : `Show ${archived.length} archived`}
              </button>
            )}
          </section>

          <section className="card p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-copper-deep">Trend</p>
                <h2 className="display mt-1 text-3xl">Monthly total over time</h2>
                <p className="mt-1 text-sm text-ink/65">Months missing a bill stay blank—not filled in.</p>
              </div>
              <div className="inline-flex rounded-lg border border-ink/15 bg-paper p-1">
                <button type="button" className={`rounded-md px-3 py-2 text-sm font-bold ${chartUnit === 'usd' ? 'bg-ink text-ivory' : ''}`} onClick={() => setChartUnit('usd')}>USD</button>
                <button type="button" className={`rounded-md px-3 py-2 text-sm font-bold ${chartUnit === 'btc' ? 'bg-ink text-ivory' : ''}`} onClick={() => setChartUnit('btc')}>BTC</button>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(24,15,10,.12)" />
                  <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(2).replace('-', '·')} tick={{ fontSize: 11 }} minTickGap={36} />
                  <YAxis tick={{ fontSize: 11 }} width={chartUnit === 'usd' ? 55 : 45} tickFormatter={(v) => chartUnit === 'usd' ? `$${v}` : String(v)} />
                  <Tooltip formatter={(v: number) => chartUnit === 'usd' ? money(v) : btc(v)} labelFormatter={(l) => monthLabel(String(l))} />
                  <Line type="monotone" dataKey="value" name={chartUnit === 'usd' ? 'Total USD' : 'Total BTC'} stroke="#d68448" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-4 rounded-lg bg-paper/70 p-3">
              <summary className="cursor-pointer text-sm font-bold"><LineChartIcon className="mr-1 inline size-4" />Accessible trend table</summary>
              <table className="mt-3 w-full text-left text-xs">
                <thead><tr className="border-b border-ink/15"><th className="p-2">Month</th><th className="p-2">Total USD</th><th className="p-2">Total BTC</th></tr></thead>
                <tbody>{timeline.map((p) => <tr key={p.month} className="border-b border-ink/8"><td className="p-2">{monthLabel(p.month)}</td><td className="p-2">{money(p.total)}</td><td className="p-2">{btc(p.btcTotal)}</td></tr>)}</tbody>
              </table>
            </details>
          </section>
        </>
      )}

      <Notice><span>Bill names and payment amounts stay in this browser only. Complete months also feed <strong>Your life → My recorded budgets</strong> automatically.</span></Notice>

      <BillDialog
        open={dialogOpen}
        setOpen={(v) => { setDialogOpen(v); if (!v) setEditing(null) }}
        bill={editing}
        onSave={(b) => { upsertBill(b); setDialogOpen(false); setEditing(null) }}
      />
    </div>
  )
}
