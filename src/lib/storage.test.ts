import { describe, expect, it } from 'vitest'
import { migrateLegacy, migrateRebuild, parseStore, STORE_VERSION } from './storage'

describe('storage migration', () => {
  it('preserves a valid legacy ledger without altering the original payload', () => { const raw = JSON.stringify([{ id: 'one', name: 'Coffee', category: 'food', amount: 4, currency: 'USD', createdAt: '2024-01-01' }]); const migrated = migrateLegacy(raw); expect(migrated.importedLegacy).toBe(true); expect(migrated.savedItems).toHaveLength(1); expect(raw).toContain('Coffee') })
  it('recovers safely from malformed data', () => { expect(migrateLegacy('{bad')).toEqual({}); expect(parseStore(null, '{bad').version).toBe(STORE_VERSION) })
  it('normalizes the default ledger object format and classifies items', () => {
    const migrated = migrateLegacy(JSON.stringify({ items: [{ id: 'rent', name: 'Rent', category: 'housing', unitUsd: 1200, quantity: 1, recurrence: 'monthly', currency: 'USD', createdAt: '2026-01-01' }] }))
    expect(migrated.savedItems?.[0]).toMatchObject({ kind: 'expense', includeInBudget: true, unitUsd: 1200 })
  })
  it('reads the Zustand rebuild envelope without replacing the source key', () => {
    const migrated = migrateRebuild(JSON.stringify({ state: { savedItems: [{ id: 'one', name: 'Coffee', amount: 4, currency: 'USD', createdAt: '2026-01-01' }], personalLines: [{ id: 'rent', name: 'Rent', category: 'housing', amount: 1200, recurrence: 'monthly' }] }, version: 2 }))
    expect(migrated.savedItems?.[0].id).toContain('rebuild:')
    expect(migrated.savedItems?.some((item) => item.kind === 'expense' && item.name === 'Rent')).toBe(true)
    expect(parseStore(null, null, JSON.stringify({ state: { savedItems: [{ id: 'one', name: 'Coffee', amount: 4, currency: 'USD', createdAt: '2026-01-01' }] } }))).toMatchObject({ version: STORE_VERSION, savedItems: [{ name: 'Coffee' }] })
  })
})
