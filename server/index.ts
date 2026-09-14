import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { prices } from './prices.js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type CacheEntry = { expiresAt: number; value: unknown }
const cachePath = join(process.cwd(), 'server', 'cache-data.json')
const cache: Record<string, CacheEntry> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, CacheEntry> : {}
const app = express()
app.use(cors())
app.use('/api/prices', prices)

const now = () => new Date().toISOString()
const envelope = <T>(data: T, source: string, status: 'fresh' | 'cached' | 'unavailable', message?: string) => ({ data, source, status, retrievedAt: now(), ...(message ? { message } : {}) })
function readCache<T>(key: string): T | undefined { const entry = cache[key]; return entry && entry.expiresAt > Date.now() ? entry.value as T : undefined }
function saveCache(key: string, value: unknown, ttlMs: number) { cache[key] = { value, expiresAt: Date.now() + ttlMs }; writeFileSync(cachePath, JSON.stringify(cache)) }
async function fetchJson(url: string) { const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Priced-In local comparison app' } }); if (!response.ok) throw new Error(`Provider returned ${response.status}`); return response.json() as Promise<unknown> }

app.get('/api/status', (_request, response) => response.json(envelope({ alphaVantageConfigured: Boolean(process.env.ALPHA_VANTAGE_API_KEY), providers: { cpi: 'BLS public API', bitcoin: 'Coinbase Exchange', stocks: process.env.ALPHA_VANTAGE_API_KEY ? 'Alpha Vantage configured' : 'Alpha Vantage key required' } }, 'Local provider status', 'fresh')))

app.get('/api/btc/spot', async (_request, response) => {
  try {
    const payload = await fetchJson('https://api.exchange.coinbase.com/products/BTC-USD/ticker') as { price: string; open_24h?: string }
    const price = Number(payload.price); const open = Number(payload.open_24h)
    if (!Number.isFinite(price)) throw new Error('Malformed BTC ticker')
    response.json(envelope({ price, change24h: Number.isFinite(open) && open ? (price - open) / open * 100 : undefined }, 'Coinbase Exchange BTC-USD ticker', 'fresh'))
  } catch (error) { response.status(503).json(envelope({ price: 0 }, 'Coinbase Exchange BTC-USD ticker', 'unavailable', error instanceof Error ? error.message : 'BTC spot unavailable')) }
})

function dateAtMonthEnd(month: string) { const [year, monthNumber] = month.split('-').map(Number); return new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59)) }
function monthRange(start: string, end: string) { const output: string[] = []; const date = new Date(`${start}-01T00:00:00Z`); const last = new Date(`${end}-01T00:00:00Z`); while (date <= last) { output.push(date.toISOString().slice(0, 7)); date.setUTCMonth(date.getUTCMonth() + 1) } return output }

app.get('/api/btc/history', async (request, response) => {
  const start = typeof request.query.start === 'string' ? request.query.start : ''
  const end = typeof request.query.end === 'string' ? request.query.end : ''
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) return response.status(400).json(envelope([], 'Coinbase Exchange', 'unavailable', 'Use valid start and end months.'))
  const key = `btc:${start}:${end}`; const cached = readCache<{ date: string; close: number }[]>(key)
  if (cached) return response.json(envelope(cached, 'Coinbase Exchange BTC-USD daily candles', 'cached'))
  try {
    const months = monthRange(start, end)
    const candles: [number, number, number, number, number, number][] = []
    const finalDate = dateAtMonthEnd(end)
    for (let beginning = new Date(`${start}-01T00:00:00Z`); beginning <= finalDate;) {
      const next = new Date(Math.min(finalDate.getTime(), beginning.getTime() + 280 * 24 * 60 * 60 * 1000))
      const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${beginning.toISOString()}&end=${next.toISOString()}`
      const batch = await fetchJson(url) as [number, number, number, number, number, number][]
      if (!Array.isArray(batch)) throw new Error('Malformed BTC candle response')
      candles.push(...batch)
      beginning = new Date(next.getTime() + 1000)
    }
    const byMonth = new Map<string, { date: string; close: number }>()
    candles.forEach((candle) => { const date = new Date(candle[0] * 1000).toISOString().slice(0, 10); const month = date.slice(0, 7); const existing = byMonth.get(month); if (!existing || date > existing.date) byMonth.set(month, { date, close: Number(candle[4]) }) })
    const output = months.map((month) => byMonth.get(month)).filter((item): item is { date: string; close: number } => Boolean(item && Number.isFinite(item.close)))
    saveCache(key, output, 24 * 60 * 60 * 1000)
    response.json(envelope(output, 'Coinbase Exchange BTC-USD daily candles; monthly last available close', 'fresh'))
  } catch (error) { response.status(503).json(envelope([], 'Coinbase Exchange', 'unavailable', error instanceof Error ? error.message : 'BTC history unavailable')) }
})

const cpiIds = ['CUUR0000SEHA', 'CUUR0000SAF11', 'CUUR0000SAT', 'CUUR0000SAH2', 'CUUR0000SA0']
app.get('/api/cpi/history', express.json(), async (request, response) => {
  const startYear = Number(request.query.startYear); const endYear = Number(request.query.endYear)
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear - startYear > 9) return response.status(400).json(envelope([], 'BLS CPI', 'unavailable', 'Use up to ten years of valid calendar years.'))
  const key = `cpi:${startYear}:${endYear}`; const cached = readCache<{ month: string; series: string; value: number }[]>(key)
  if (cached) return response.json(envelope(cached, 'BLS CPI public API', 'cached'))
  try {
    const source = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seriesid: cpiIds, startyear: String(startYear), endyear: String(endYear) }) })
    if (!source.ok) throw new Error(`BLS returned ${source.status}`)
    const payload = await source.json() as { status?: string; Results?: { series?: { seriesID: string; data: { year: string; period: string; value: string }[] }[] } }
    if (payload.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS did not return requested CPI series')
    const output = (payload.Results?.series ?? []).flatMap((series) => series.data.filter((item) => /^M\d{2}$/.test(item.period)).map((item) => ({ month: `${item.year}-${item.period.slice(1)}`, series: series.seriesID, value: Number(item.value) }))).filter((item) => Number.isFinite(item.value))
    saveCache(key, output, 24 * 60 * 60 * 1000)
    response.json(envelope(output, 'BLS CPI U.S. city average, not seasonally adjusted', 'fresh'))
  } catch (error) { response.status(503).json(envelope([], 'BLS CPI', 'unavailable', error instanceof Error ? error.message : 'CPI history unavailable')) }
})

app.get('/api/stocks/:ticker', async (request, response) => {
  const ticker = request.params.ticker.toUpperCase().replace(/[^A-Z.\-]/g, '')
  if (!ticker) return response.status(400).json(envelope([], 'Alpha Vantage', 'unavailable', 'Enter a U.S. ticker.'))
  if (!process.env.ALPHA_VANTAGE_API_KEY) return response.status(424).json(envelope([], 'Alpha Vantage', 'unavailable', 'Add ALPHA_VANTAGE_API_KEY to the local .env file, then restart the API server.'))
  const key = `stock-dated:${ticker}`; const cached = readCache<{ month: string; date: string; adjustedClose: number; close: number }[]>(key)
  if (cached) return response.json(envelope(cached, `Alpha Vantage ${ticker} monthly adjusted`, 'cached'))
  const budgetKey = `alpha-budget:${new Date().toISOString().slice(0, 10)}`
  const used = readCache<number>(budgetKey) ?? 0
  if (used >= 20) return response.status(429).json(envelope([], 'Alpha Vantage', 'unavailable', 'The local daily request budget has been reached. Cached tickers remain available; try again tomorrow.'))
  saveCache(budgetKey, used + 1, 48 * 60 * 60 * 1000)
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${ticker}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    const payload = await fetchJson(url) as Record<string, unknown>
    const series = payload['Monthly Adjusted Time Series'] as Record<string, Record<string, string>> | undefined
    if (!series) throw new Error(typeof payload.Note === 'string' ? payload.Note : 'Ticker unavailable or malformed provider response')
    const output = Object.entries(series).map(([month, item]) => ({ month: month.slice(0, 7), date: month, adjustedClose: Number(item['5. adjusted close']), close: Number(item['4. close']) })).filter((item) => Number.isFinite(item.adjustedClose) && Number.isFinite(item.close)).sort((a, b) => a.month.localeCompare(b.month))
    if (!output.length) throw new Error('No usable adjusted-close observations returned')
    saveCache(key, output, 24 * 60 * 60 * 1000)
    response.json(envelope(output, `Alpha Vantage ${ticker} monthly adjusted`, 'fresh'))
  } catch (error) { response.status(503).json(envelope([], 'Alpha Vantage', 'unavailable', error instanceof Error ? error.message : 'Stock history unavailable')) }
})

const dist = join(process.cwd(), 'dist')
if (existsSync(dist)) { app.use(express.static(dist)); app.use((_request, response) => response.sendFile(join(dist, 'index.html'))) }
const serverPort = 8787
app.listen(serverPort, '127.0.0.1', () => console.log(`Priced In API listening at http://127.0.0.1:${serverPort}`))
