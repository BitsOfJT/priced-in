import { Info } from 'lucide-react'

export const money = (value: number | null | undefined) => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
export const percent = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
export const btc = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value.toFixed(value < .01 ? 5 : 3)} BTC`

export function Notice({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' }) {
  return <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${tone === 'warning' ? 'border-copper/50 bg-copper/10' : 'border-ink/15 bg-paper/70'}`}><Info className="mt-0.5 size-4 shrink-0" />{children}</div>
}

export function Button({ children, onClick, variant = 'dark', type = 'button', disabled = false, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'dark' | 'light' | 'quiet'; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  const base = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50'
  const styles = variant === 'dark' ? 'bg-ink text-ivory hover:bg-copper-deep' : variant === 'light' ? 'border border-ink/20 bg-ivory text-ink hover:border-copper' : 'text-ink underline decoration-copper decoration-2 underline-offset-4 hover:text-copper-deep'
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>{children}</button>
}

export function Metric({ title, value, detail, copper = false }: { title: string; value: string; detail: string; copper?: boolean }) {
  return <article className={`card p-5 ${copper ? 'bg-ink text-ivory' : ''}`}><p className={`eyebrow ${copper ? 'text-copper' : 'text-ink/55'}`}>{title}</p><strong className="display mt-2 block text-3xl">{value}</strong><p className={`mt-1 text-sm ${copper ? 'text-ivory/65' : 'text-ink/60'}`}>{detail}</p></article>
}
