export type PriceObservation = { period: string; usd: number; source: string }
export function targetPeriod(period: string, years: number) {
  return `${Number(period.slice(0, 4)) - years}${period.slice(4)}`
}
export function selectPrices(observations: PriceObservation[], years: number) {
  const valid = observations.filter(p => /^\d{4}-\d{2}(-\d{2})?$/.test(p.period) && Number.isFinite(p.usd) && p.usd > 0).sort((a,b) => a.period.localeCompare(b.period))
  const latest = valid.at(-1)
  const target = latest ? targetPeriod(latest.period, years) : undefined
  return { latest, target, previous: valid.find(p => p.period === target) }
}
export function observedChange(previous: number, latest: number) { return (latest / previous - 1) }
export function compareObserved(previous: PriceObservation, latest: PriceObservation, previousBtc: number, latestBtc: number, quantity = 1) {
  if (![previous.usd, latest.usd, previousBtc, latestBtc, quantity].every(n => Number.isFinite(n) && n > 0)) return null
  const usdThen = previous.usd * quantity, usdNow = latest.usd * quantity
  const btcThen = usdThen / previousBtc, btcNow = usdNow / latestBtc
  return { usdThen, usdNow, btcThen, btcNow, usdPct: observedChange(usdThen, usdNow), btcPct: observedChange(btcThen, btcNow) }
}
