import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'

// Restore the original presentation and its proven ledger controller together.
// The newer budget/investment app remains available through rebuild.html.
function OriginalDesign() {
  useEffect(() => { void import('../app.js') }, [])
  return <>
<a className="skip-link" href="#ledger">Skip to ledger</a>

    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Priced In home">
          <span className="brand-mark" aria-hidden="true">₿</span>
          <span>
            <strong>Priced In</strong>
            <small>Dollars and bitcoin, side by side</small>
          </span>
        </a>

        <div className="market-lockup" aria-live="polite">
          <span className="market-label"><span className="status-dot" id="status-dot"></span>BTC / USD</span>
          <strong id="header-btc-price">Connecting…</strong>
          <span id="header-btc-change" className="market-change">Live rate</span>
        </div>

        <div className="topbar-actions">
          <div className="segmented compact" aria-label="Bitcoin display unit">
            <button type="button" data-denomination="sats" aria-pressed="true">sats</button>
            <button type="button" data-denomination="btc" aria-pressed="false">BTC</button>
          </div>
          <button type="button" className="theme-toggle" id="theme-toggle" aria-label="Switch to light mode" aria-pressed="true">
            <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>
            <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="comparison-panel" aria-labelledby="comparison-title">
          <div className="comparison-heading">
            <div>
              <p className="eyebrow">The same life, another unit</p>
              <h1 id="comparison-title">What does your life cost in bitcoin?</h1>
            </div>
            <div className="timeframe lookback-dial">
              <div className="lookback-readout">
                <span className="lookback-label">Compare with</span>
                <output id="lookback-value" htmlFor="lookback-dial">5 years ago</output>
              </div>
              <input id="lookback-dial" type="range" min="0" max="10" step="1" defaultValue="5" aria-label="Comparison window in years, zero is live" aria-valuetext="5 years ago" list="lookback-ticks" />
              <datalist id="lookback-ticks">
                <option value="0" label="Live"></option>
                <option value="5" label="5y"></option>
                <option value="10" label="10y"></option>
              </datalist>
              <div className="lookback-scale" aria-hidden="true"><span>Live</span><span>5y</span><span>10y</span></div>
            </div>
          </div>

          <div id="hero-content" className="hero-content" aria-live="polite"></div>

          <div className="hero-footer">
            <p id="comparison-note">Dollar side uses CPI. Bitcoin side uses the market rate on that date.</p>
            <p id="quote-meta">Connecting to Coinbase…</p>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="ledger-column" id="ledger">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your ledger</p>
                <h2>Everything you’ve priced</h2>
              </div>
              <button className="button button-primary" type="button" id="add-item-button">
                <span aria-hidden="true">＋</span> Add item
              </button>
            </div>

            <div className="price-mode-row">
              <div className="segmented" aria-label="Price source">
                <button type="button" data-price-mode="catalog" aria-pressed="true">Sourced examples</button>
                <button type="button" data-price-mode="personal" aria-pressed="false">My items</button>
              </div>
              <button type="button" className="icon-button" id="retry-prices" aria-label="Refresh sourced prices">↻</button>
            </div>
            <p className="price-source-status" id="price-source-status" role="status">Loading sourced prices…</p>
            <div className="toolbar">
              <label className="search-field">
                <span className="sr-only">Search your ledger</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                <input id="search-input" type="search" placeholder="Search your ledger" autoComplete="off" />
              </label>
              <label className="sort-field">
                <span className="sr-only">Sort items</span>
                <select id="sort-select">
                  <option value="recent">Most recent</option>
                  <option value="amount">Highest amount</option>
                  <option value="name">Name</option>
                  <option value="cheapest">Cheapest in BTC</option>
                </select>
              </label>
            </div>

            <div className="category-row" id="category-filters" aria-label="Filter by category"></div>
            <div className="ledger-list" id="ledger-list"></div>
          </div>

          <aside className="side-column" aria-label="Ledger summary and converter">
            <section className="summary-card">
              <div className="card-title-row">
                <div>
                  <p className="eyebrow">At a glance</p>
                  <h2>Ledger totals</h2>
                </div>
                <span className="mini-mark" aria-hidden="true">PI</span>
              </div>
              <dl className="summary-list">
                <div>
                  <dt>Listed value</dt>
                  <dd id="listed-usd">$0</dd>
                  <dd id="listed-btc" className="secondary-value">0 sats</dd>
                </div>
                <div>
                  <dt>Monthly recurring</dt>
                  <dd id="monthly-usd">$0</dd>
                  <dd id="monthly-btc" className="secondary-value">0 sats</dd>
                </div>
                <div>
                  <dt>Holdings</dt>
                  <dd id="holdings-usd">$0</dd>
                  <dd id="holdings-btc" className="secondary-value">0 sats</dd>
                </div>
              </dl>
            </section>

            <section className="converter-card">
              <div className="card-title-row">
                <div>
                  <p className="eyebrow">Quick converter</p>
                  <h2>Price anything</h2>
                </div>
                <button className="icon-button" id="swap-button" type="button" aria-label="Swap conversion direction">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 3-3 3 3"></path><path d="M10 4v12"></path><path d="m17 17-3 3-3-3"></path><path d="M14 20V8"></path></svg>
                </button>
              </div>

              <div className="converter-field">
                <label htmlFor="converter-input" id="converter-input-label">US dollars</label>
                <div className="money-input">
                  <span id="converter-input-prefix">$</span>
                  <input id="converter-input" type="number" min="0" step="any" defaultValue="100" inputMode="decimal" />
                  <span id="converter-input-suffix">USD</span>
                </div>
              </div>

              <div className="quick-amounts" id="quick-amounts">
                <button type="button" data-amount="10">$10</button>
                <button type="button" data-amount="100">$100</button>
                <button type="button" data-amount="1000">$1k</button>
                <button type="button" data-amount="10000">$10k</button>
              </div>

              <div className="conversion-result">
                <span id="converter-output-label">Bitcoin today</span>
                <strong id="converter-output">—</strong>
              </div>
              <p className="converter-note" id="converter-note"></p>
            </section>

            <section className="reading-card">
              <p className="eyebrow">How to read it</p>
              <p id="reading-copy">The historical view compares today’s price with what the same CPI-adjusted basket cost in bitcoin then.</p>
            </section>
          </aside>
        </section>
      </main>
    </div>

    <div className="sheet-layer" id="item-sheet" hidden>
      <button className="sheet-backdrop" id="sheet-backdrop" type="button" aria-label="Close item editor"></button>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-header">
          <div>
            <p className="eyebrow" id="sheet-eyebrow">New ledger entry</p>
            <h2 id="sheet-title">Add an item</h2>
          </div>
          <button className="icon-button" id="close-sheet-button" type="button" aria-label="Close item editor">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"></path><path d="M18 6 6 18"></path></svg>
          </button>
        </header>

        <form id="item-form" className="item-form">
          <input type="hidden" id="item-id" />
          <label className="form-field full">
            <span>Name</span>
            <input id="item-name" name="name" type="text" required maxLength={80} placeholder="What are you pricing?" />
          </label>

          <label className="form-field">
            <span>Category</span>
            <select id="item-category" name="category">
              <option value="stocks">Stocks</option>
              <option value="bills">Bills</option>
              <option value="games">Games</option>
              <option value="tech">Tech</option>
              <option value="housing">Housing</option>
              <option value="food">Food</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="form-field">
            <span>Recurrence</span>
            <select id="item-recurrence" name="recurrence">
              <option value="once">One time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>

          <label className="form-field">
            <span>Unit price</span>
            <div className="inline-input"><span>$</span><input id="item-price" name="unitUsd" type="number" min="0.01" step="0.01" required inputMode="decimal" /></div>
          </label>

          <label className="form-field">
            <span>Quantity</span>
            <input id="item-quantity" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required inputMode="decimal" />
          </label>

          <label className="form-field full">
            <span>Notes <small>optional</small></span>
            <textarea id="item-notes" name="notes" rows={4} maxLength={240} placeholder="Ticker, plan, model, or context"></textarea>
          </label>

          <div className="capture-note full">
            <span>BTC rate captured</span>
            <strong id="capture-rate">Current live rate</strong>
          </div>

          <label className="form-field">
            <span>Price observation date</span>
            <input id="price-date" type="date" />
          </label>
          <label className="form-field">
            <span>Source or receipt note</span>
            <input id="price-source" type="text" maxLength={160} placeholder="e.g. July internet bill" />
          </label>
          <p className="price-help full">Record the unit price above for this date. Keep the same product, plan, unit and condition. Leave the date blank to retain an undated input. A year toggle compares the same date in the earlier year; missing observations stay unavailable.</p>
          <label className="form-field full">
            <span>Stock ticker <small>stocks only</small></span>
            <input id="item-ticker" type="text" maxLength={12} placeholder="e.g. AAPL" />
          </label>
          <div className="full"><p className="eyebrow">Saved price observations</p><pre id="price-history-list" className="price-help"></pre></div>

          <footer className="sheet-actions full">
            <button className="button button-danger" id="delete-item-button" type="button" hidden>Delete</button>
            <div className="action-spacer"></div>
            <button className="button button-secondary" id="cancel-item-button" type="button">Cancel</button>
            <button className="button button-primary" type="submit">Save item</button>
          </footer>
        </form>
      </section>
    </div>

    <div className="confirm-layer" id="confirm-dialog" hidden>
      <div className="confirm-backdrop"></div>
      <section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <p className="eyebrow">Remove entry</p>
        <h2 id="confirm-title">Delete this item?</h2>
        <p id="confirm-description">This removes it from your local ledger. This action cannot be undone.</p>
        <div className="confirm-actions">
          <button className="button button-secondary" id="keep-item-button" type="button">Keep item</button>
          <button className="button button-danger solid" id="confirm-delete-button" type="button">Delete item</button>
        </div>
      </section>
    </div>

    <dialog id="source-history" className="source-dialog" aria-labelledby="source-history-title">
      <h2 id="source-history-title">Price history</h2>
      <p className="price-help">Monthly average retail prices in U.S. dollars. National averages, not exact store quotes. Unit and geography remain constant.</p>
      <a id="source-history-link" target="_blank" rel="noreferrer">View BLS source ↗</a>
      <pre id="source-history-content"></pre>
      <button type="button" className="button button-secondary" id="close-source-history">Close history</button>
    </dialog>
    <div className="toast" id="toast" role="status" aria-live="polite"></div>
  </>
}

createRoot(document.getElementById('root')!).render(<OriginalDesign />)
