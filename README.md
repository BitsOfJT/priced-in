# Priced In

The original dark, copper-accented ledger is the default view. It uses a React/TypeScript entry with the original stylesheet and a locally stored personal ledger. New installations start empty; sourced examples are kept separate from personal entries.

The React/Tailwind budget and investment experience remains available at `/rebuild.html`. Both views understand the versioned `priced-in-v3` store and retain the older `priced-in-ledger` and `priced-in-v2` keys as migration sources.

The default ledger now offers **Sourced examples**—BLS U.S. city-average retail prices for eggs, milk, coffee, gasoline, and electricity—alongside **My items**. Historical dollar comparisons use the exact matching BLS month, and bitcoin comparisons use the matching Coinbase BTC/USD observations. Personal items remain unavailable until you add a dated price observation; missing history is never estimated.

## Run locally

```bash
npm install
npm run dev:api
# In a second terminal:
npm run dev
```

Open `http://127.0.0.1:4173`.

For a compiled-app check, run `npm run build`, then `npm start` and open `http://127.0.0.1:8787`.

## Live data

- BLS average retail prices and Coinbase BTC/USD observations are source-backed through the local API and cached locally.
- Stock/ETF history requires a free Alpha Vantage key. Copy `.env.example` to `.env`, add `ALPHA_VANTAGE_API_KEY`, and restart `npm run dev:api`. The key is never exposed to the browser.
- Personal budgets, snapshots, ledger entries, and allocations stay in browser storage; JSON backup/import is available from both views. Imports are validated and a recovery copy is kept before replacement.

## Data and comparison boundaries

- Item types are explicit: recurring expense, one-time purchase, or asset/holding. Only assets contribute to holdings.
- Estimated CPI history requires complete category data for a month. Missing data stays a gap; it is never treated as zero or inferred.
- Monthly retail prices use monthly mean BTC closes. Dated personal observations use daily UTC closes. Current spot conversion is separate and is shown only when a fresh quote is available.
- The local API keeps provider keys on the server. No account, brokerage connection, cloud sync, or financial transaction is involved.

If a migration is needed, open either view once after upgrading. The app reads the old keys without deleting them and writes the normalized v3 store. Export a backup before importing a replacement file; the previous store is retained under a recovery key.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```
# priced-in
