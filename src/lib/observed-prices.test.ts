import { describe, expect, it } from 'vitest'
import { compareObserved, selectPrices } from './observed-prices'

describe('observed price selection', () => {
  const prices = [
    { period: '2023-08', usd: 2, source: 'source' },
    { period: '2026-08', usd: 3, source: 'source' },
  ]

  it('requires the exact matching comparison month instead of estimating a gap', () => {
    expect(selectPrices(prices, 3).previous?.period).toBe('2023-08')
    expect(selectPrices(prices, 1).previous).toBeUndefined()
  })

  it('reaches ten years back when the matching month exists', () => {
    const decade = [{ period: '2016-08', usd: 1, source: 'source' }, ...prices]
    expect(selectPrices(decade, 10).previous?.period).toBe('2016-08')
    expect(selectPrices(decade, 0).previous?.period).toBe('2026-08')
  })

  it('uses the price observation dates for both dollar and bitcoin changes', () => {
    expect(compareObserved(prices[0], prices[1], 20000, 60000)).toMatchObject({ usdThen: 2, usdNow: 3, btcThen: 0.0001, btcNow: 0.00005 })
  })
})
