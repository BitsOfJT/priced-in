# Priced In

The original dark, copper-accented ledger is restored as the default view. It uses a React/TypeScript entry with the original stylesheet and ledger controller. Its saved entries and preferences remain in `priced-in-ledger`.

The newer React/Tailwind budget and investment experience is preserved at `/rebuild.html`, including its separate `priced-in-v2` browser data. The source modules and local data API remain available for future work.

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
- Personal budgets, snapshots, ledger entries, and allocations stay in browser storage; JSON backup/import is included.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```
# priced-in
