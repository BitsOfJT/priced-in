import { describe, expect, it } from 'vitest'
import { migrateLegacy, parseStore, STORE_VERSION } from './storage'

describe('storage migration', () => {
  it('preserves a valid legacy ledger without altering the original payload', () => { const raw = JSON.stringify([{ id: 'one', name: 'Coffee', category: 'food', amount: 4, currency: 'USD', createdAt: '2024-01-01' }]); const migrated = migrateLegacy(raw); expect(migrated.importedLegacy).toBe(true); expect(migrated.savedItems).toHaveLength(1); expect(raw).toContain('Coffee') })
  it('recovers safely from malformed data', () => { expect(migrateLegacy('{bad')).toEqual({}); expect(parseStore(null, '{bad').version).toBe(STORE_VERSION) })
  it('includes empty bill arrays in defaults and legacy v2 payloads', () => {
    const store = parseStore(JSON.stringify({ version: STORE_VERSION, personalLines: [], savedItems: [] }), null)
    expect(store.bills).toEqual([])
    expect(store.billPayments).toEqual([])
  })
})
