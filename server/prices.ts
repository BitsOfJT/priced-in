import { Router } from 'express'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const prices = Router()
const cachePath = process.env.VERCEL ? '/tmp/priced-in-prices-cache.json' : fileURLToPath(new URL('./prices-cache.json', import.meta.url))
type Entry = { at: string; data: unknown }
let cache: Record<string, Entry> = {}
try { cache = JSON.parse(readFileSync(cachePath, 'utf8')) } catch { /* first run */ }
const pending = new Map<string, Promise<unknown>>()
async function cached(key: string, fetcher: () => Promise<unknown>) {
  const previous = cache[key]
  if (previous && Date.now() - Date.parse(previous.at) < 86400000) return { ...previous, status: 'cached' }
  try {
    let task = pending.get(key)
    if (!task) { task = fetcher(); pending.set(key, task) }
    const data = await task
    const entry = { data, at: new Date().toISOString() }
    cache[key] = entry
    try { writeFileSync(cachePath, JSON.stringify(cache)) } catch { /* ephemeral serverless cache */ }
    return { ...entry, status: 'fresh' }
  } catch (error) {
    if (previous) return { ...previous, status: 'stale' }
    throw error
  } finally { pending.delete(key) }
}
const catalog = [
  { id: 'APU0000708111', name: 'Large grade A eggs', unit: '1 dozen', category: 'food' },
  { id: 'APU0000709112', name: 'Whole milk', unit: '1 gallon', category: 'food' },
  { id: 'APU0000717311', name: 'Ground roast coffee', unit: '1 pound', category: 'food' },
  { id: 'APU000074714', name: 'Regular unleaded gasoline', unit: '1 gallon', category: 'other' },
  { id: 'APU000072610', name: 'Electricity', unit: '1 kWh', category: 'bills' },
]
// The lookback dial reaches ten years back, which spans eleven calendar years.
// The BLS public API caps a single request at ten years, so the window is split in two.
export const CATALOG_YEARS_BACK = 10
type BlsSeries = { seriesID: string; data: { period: string; year: string; value: string }[] }
async function fetchBlsSeries(startYear: number, endYear: number): Promise<BlsSeries[]> {
  const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ seriesid: catalog.map(c=>c.id), startyear: String(startYear), endyear: String(endYear) }),
  })
  if (!response.ok) throw new Error('BLS prices are temporarily unavailable.')
  const payload = await response.json() as { status: string; Results?: { series: BlsSeries[] } }
  if (payload.status !== 'REQUEST_SUCCEEDED' || !payload.Results?.series) throw new Error('BLS returned no usable price history.')
  return payload.Results.series
}
prices.get('/catalog', async (_req, res) => {
  try {
    const year = new Date().getUTCFullYear()
    const result = await cached(`catalog:${CATALOG_YEARS_BACK}y:${year}`, async () => {
      const split = year - Math.floor(CATALOG_YEARS_BACK / 2)
      const [older, recent] = await Promise.all([fetchBlsSeries(year - CATALOG_YEARS_BACK, split - 1), fetchBlsSeries(split, year)])
      return catalog.map(item => ({ ...item, observations: [...older, ...recent].filter(s=>s.seriesID===item.id).flatMap(s=>s.data)
        .filter(p=>/^M(0[1-9]|1[0-2])$/.test(p.period) && Number(p.value)>0)
        .map(p=>({ period: `${p.year}-${p.period.slice(1)}`, usd: Number(p.value), source: 'BLS U.S. city average' }))
        .filter((p, index, all) => all.findIndex(other => other.period === p.period) === index)
        .sort((a, b) => a.period.localeCompare(b.period)) }))
    })
    res.json({ ...result, source: 'BLS average retail prices', retrievedAt: result.at })
  } catch(error) { res.status(503).json({ status:'unavailable', message: error instanceof Error ? error.message : 'Prices unavailable' }) }
})
prices.get('/btc', async (req,res) => {
  const period = String(req.query.period ?? '')
  const start = new Date(`${period.length===7 ? period+'-01' : period}T00:00:00Z`)
  if (!/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(period) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0,period.length)!==period || start.getUTCFullYear()<2010 || start > new Date()) { res.status(400).json({message:'A valid past date or month is required.'}); return }
  const end = new Date(start)
  if (period.length===7) end.setUTCMonth(end.getUTCMonth()+1); else end.setUTCDate(end.getUTCDate()+1)
  if (end > new Date()) { res.status(422).json({message:'This period is not complete. Historical conversion is available after it closes.'}); return }
  try {
    const result=await cached(`btc:${period}`,async()=>{
      const response=await fetch(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${start.toISOString()}&end=${end.toISOString()}`,{signal:AbortSignal.timeout(12000)})
      if(!response.ok) throw new Error('Coinbase history is temporarily unavailable.')
      const raw=await response.json()
      if(!Array.isArray(raw)) throw new Error('Invalid Coinbase response.')
      const days=new Map<string,number>()
      for(const row of raw) { if(!Array.isArray(row)) continue; const timestamp=Number(row[0])*1000, close=Number(row[4]); if(timestamp>=+start && timestamp<+end && close>0 && Number.isFinite(close)) days.set(new Date(timestamp).toISOString().slice(0,10),close) }
      const expected=Math.round((+end-+start)/86400000)
      if(days.size!==expected) throw new Error('Complete daily bitcoin prices are unavailable for this period.')
      return { period, usd:[...days.values()].reduce((a,b)=>a+b,0)/days.size, convention:period.length===7?'Mean of daily UTC closes':'Daily UTC close', days:days.size }
    })
    res.json({...result,source:'Coinbase BTC-USD',retrievedAt:result.at})
  } catch(error) { res.status(503).json({status:'unavailable',message:error instanceof Error?error.message:'Bitcoin history unavailable'}) }
})
