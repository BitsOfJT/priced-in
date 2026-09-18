import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

// The sandbox blocks socket binds, so these tests drive the real Express
// stack directly instead of listening on an ephemeral port.
const app = createApp() as unknown as {
  request: object
  response: object
  handle: (req: unknown, res: unknown, done: (error?: unknown) => void) => void
}

type Captured = { status: number; body: string }

function get(path: string): Promise<Captured> {
  return new Promise((resolve, reject) => {
    const req = Object.create(app.request)
    Object.assign(req, { method: 'GET', url: path, originalUrl: path, headers: {} })
    const res = Object.create(app.response)
    const headers: Record<string, string> = {}
    let body = ''
    Object.defineProperty(res, 'headersSent', { value: false })
    Object.assign(res, {
      statusCode: 200,
      setHeader: (name: string, value: string) => { headers[String(name).toLowerCase()] = String(value) },
      getHeader: (name: string) => headers[String(name).toLowerCase()],
      getHeaders: () => ({ ...headers }),
      removeHeader: (name: string) => { delete headers[String(name).toLowerCase()] },
      write: (chunk: unknown) => { body += String(chunk); return true },
      end: (chunk?: unknown) => {
        if (chunk !== undefined) body += String(chunk)
        resolve({ status: res.statusCode as number, body })
        return res
      },
    })
    req.res = res
    res.req = req
    try {
      app.handle(req, res, (error: unknown) => (error ? reject(error) : resolve({ status: 404, body })))
    } catch (error) { reject(error) }
  })
}

describe('api validation', () => {
  it('reports provider status without secrets', async () => {
    const response = await get('/api/status')
    expect(response.status).toBe(200)
    const payload = JSON.parse(response.body) as { data: { alphaVantageConfigured: boolean } }
    expect(typeof payload.data.alphaVantageConfigured).toBe('boolean')
  })

  it('rejects invalid btc history windows without calling providers', async () => {
    expect((await get('/api/btc/history?start=2025-01&end=2024-01')).status).toBe(400)
    expect((await get('/api/btc/history?start=soon&end=2025-01')).status).toBe(400)
  })

  it('rejects oversized cpi windows without calling providers', async () => {
    expect((await get('/api/cpi/history?startYear=2000&endYear=2035')).status).toBe(400)
  })

  it('rejects empty tickers without calling providers', async () => {
    expect((await get('/api/stocks/123')).status).toBe(400)
  })

  it('rejects invalid price periods without calling providers', async () => {
    expect((await get('/api/prices/btc?period=not-a-date')).status).toBe(400)
  })
})
