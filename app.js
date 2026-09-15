import { selectPrices, compareObserved, observedChange } from './src/lib/observed-prices.ts';
(() => {
  "use strict";

  const STORAGE_KEY = "priced-in-ledger";
  const V3_STORAGE_KEY = "priced-in-v3";

  const CATEGORIES = ["all", "stocks", "bills", "games", "tech", "housing", "food", "other"];
  const CATEGORY_LABELS = {
    all: "All",
    stocks: "Stocks",
    bills: "Bills",
    games: "Games",
    tech: "Tech",
    housing: "Housing",
    food: "Food",
    other: "Other",
  };

  const EXAMPLE_ITEMS = [
    ["ex-0-apple-aapl", "Apple · AAPL", "stocks", "asset", 229.87, 8, "once", 64200, "Eight shares at last review"],
    ["ex-1-msft", "Microsoft · MSFT", "stocks", "asset", 515.42, 4, "once", 65300, "Long-term holding"],
    ["ex-2-netflix", "Netflix", "bills", "expense", 24.99, 1, "monthly", 68100, "Premium plan"],
    ["ex-3-rent", "Apartment rent", "housing", "expense", 1850, 1, "monthly", 57900, "Home base"],
    ["ex-4-groceries", "Weekly groceries", "food", "expense", 168, 1, "weekly", 61700, "Typical basket"],
    ["ex-5-ps5", "PlayStation 5", "games", "purchase", 499.99, 1, "once", 48400, "Disc edition"],
    ["ex-6-elden-ring", "Elden Ring", "games", "purchase", 59.99, 1, "once", 43200, "Base game"],
    ["ex-7-iphone", "iPhone 16 Pro", "tech", "purchase", 999, 1, "once", 59600, "128 GB"],
    ["ex-8-internet", "Home internet", "bills", "expense", 79.99, 1, "monthly", 70100, "Fiber plan"],
    ["ex-9-spotify", "Spotify", "bills", "expense", 11.99, 1, "monthly", 67300, "Individual plan"],
  ].map(([id, name, category, kind, unitUsd, quantity, recurrence, btcUsdAtCapture, notes], index) => ({
    id,
    name,
    category,
    kind,
    unitUsd,
    quantity,
    recurrence,
    btcUsdAtCapture,
    notes,
    createdAt: Date.UTC(2026, 8, 1) + index * 86400000,
    updatedAt: Date.UTC(2026, 8, 1) + index * 86400000,
  }));

  const fallbackQuote = {
    usd: 0,
    change24hPct: null,
    updatedAt: 0,
    source: "unavailable",
    history: null,
    failedAt: 0,
  };

  const state = {
    items: [],
    catalogMode: true,
    catalog: [],
    catalogStatus: "Loading sourced prices…",
    rates: {},
    rateErrors: {},
    denomination: "sats",
    lookback: "5y",
    quote: { ...fallbackQuote },
    category: "all",
    search: "",
    sort: "recent",
    converterDirection: "usd",
    editingId: null,
    lastFocus: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    hero: $("#hero-content"),
    comparisonNote: $("#comparison-note"),
    quoteMeta: $("#quote-meta"),
    headerPrice: $("#header-btc-price"),
    headerChange: $("#header-btc-change"),
    statusDot: $("#status-dot"),
    filters: $("#category-filters"),
    list: $("#ledger-list"),
    search: $("#search-input"),
    sort: $("#sort-select"),
    itemSheet: $("#item-sheet"),
    itemForm: $("#item-form"),
    itemId: $("#item-id"),
    itemName: $("#item-name"),
    itemCategory: $("#item-category"),
    itemKind: $("#item-kind"),
    itemRecurrence: $("#item-recurrence"),
    itemPrice: $("#item-price"),
    itemQuantity: $("#item-quantity"),
    itemNotes: $("#item-notes"),
    sheetEyebrow: $("#sheet-eyebrow"),
    sheetTitle: $("#sheet-title"),
    deleteButton: $("#delete-item-button"),
    captureRate: $("#capture-rate"),
    confirmDialog: $("#confirm-dialog"),
    toast: $("#toast"),
    converterInput: $("#converter-input"),
    converterInputLabel: $("#converter-input-label"),
    converterInputPrefix: $("#converter-input-prefix"),
    converterInputSuffix: $("#converter-input-suffix"),
    converterOutputLabel: $("#converter-output-label"),
    converterOutput: $("#converter-output"),
    converterNote: $("#converter-note"),
    readingCopy: $("#reading-copy"),
    quickAmounts: $("#quick-amounts"),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function validItem(item) {
    return item && typeof item.id === "string" && typeof item.name === "string" &&
      CATEGORIES.includes(item.category) && item.category !== "all" &&
      ["expense", "purchase", "asset"].includes(item.kind || (item.ticker ? "asset" : item.recurrence === "once" ? "purchase" : "expense")) &&
      ["once", "weekly", "monthly", "yearly"].includes(item.recurrence) &&
      finiteNumber(item.unitUsd) > 0 && finiteNumber(item.quantity) > 0;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      if (Array.isArray(saved.items)) {
        const cleaned = saved.items.filter(validItem).map((item) => ({
          ...item,
          kind: ["expense", "purchase", "asset"].includes(item.kind) ? item.kind : (item.ticker ? "asset" : item.recurrence === "once" ? "purchase" : "expense"),
          unitUsd: finiteNumber(item.unitUsd),
          quantity: finiteNumber(item.quantity, 1),
          btcUsdAtCapture: finiteNumber(item.btcUsdAtCapture, 0),
          createdAt: finiteNumber(item.createdAt, Date.now()),
          updatedAt: finiteNumber(item.updatedAt, Date.now()),
          notes: typeof item.notes === "string" ? item.notes : "",
        }));
        state.items = cleaned;
      }
      const v3 = JSON.parse(localStorage.getItem(V3_STORAGE_KEY) || "null");
      const v3Items = Array.isArray(v3?.savedItems) ? v3.savedItems : Array.isArray(v3?.state?.savedItems) ? v3.state.savedItems : [];
      if (!saved?.items && v3Items.length) {
        state.items = v3Items.map((item) => ({
          ...item,
          unitUsd: finiteNumber(item.unitUsd ?? item.amount), quantity: finiteNumber(item.quantity, 1), recurrence: item.recurrence || "once",
          kind: item.kind || (item.ticker ? "asset" : item.recurrence && item.recurrence !== "once" ? "expense" : "purchase"),
          btcUsdAtCapture: finiteNumber(item.btcUsdAtCapture, 0), createdAt: finiteNumber(Date.parse(item.createdAt), Date.now()), updatedAt: finiteNumber(Date.parse(item.updatedAt || item.createdAt), Date.now()), notes: typeof item.notes === "string" ? item.notes : "",
        }));
      }
      if (["sats", "btc"].includes(saved.denomination)) state.denomination = saved.denomination;
      if (["live", "1y", "3y", "5y"].includes(saved.lookback)) state.lookback = saved.lookback;
      if (saved.quote && finiteNumber(saved.quote.usd) > 0) {
        state.quote = {
          ...fallbackQuote,
          ...saved.quote,
          usd: finiteNumber(saved.quote.usd, 0),
          history: saved.quote.history || null,
        };
      }
    } catch {
      // A corrupt local value should never block the ledger.
    }
  }

  function persist() {
    const payload = {
      items: state.items,
      denomination: state.denomination,
      lookback: state.lookback,
      quote: state.quote,
      hasSeeded: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    try {
      const existing = JSON.parse(localStorage.getItem(V3_STORAGE_KEY) || "null") || {};
      localStorage.setItem(V3_STORAGE_KEY, JSON.stringify({ ...existing, version: 3, useExample: false, savedItems: state.items.map((item) => ({ ...item, amount: itemTotal(item), currency: "USD", createdAt: new Date(item.createdAt).toISOString(), updatedAt: new Date(item.updatedAt).toISOString() })) }));
    } catch {
      showToast("Saved locally; shared workspace backup could not be updated");
    }
  }

  function formatUsd(value, compact = false) {
    if (!Number.isFinite(value)) return "—";
    const options = compact && Math.abs(value) >= 10000
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: value < 100 ? 2 : 0 };
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...options }).format(value);
  }

  function formatBitcoinFromUsd(usd, rate = state.quote.usd) {
    if (!rate || rate <= 0 || !Number.isFinite(usd) || usd < 0) return "—";
    const btc = usd / rate;
    if (state.denomination === "btc") {
      const digits = btc >= 1 ? 4 : btc >= 0.01 ? 5 : 7;
      return `${btc.toLocaleString("en-US", { maximumFractionDigits: digits })} BTC`;
    }
    const sats = Math.round(btc * 100000000);
    return `${sats.toLocaleString("en-US")} sats`;
  }

  function usableSpotRate() {
    return state.quote.updatedAt > 0 && !state.quote.failedAt && Date.now() - state.quote.updatedAt <= 120000 ? state.quote.usd : 0;
  }

  function formatBtcValue(btc) {
    if (state.denomination === "btc") {
      return `${btc.toLocaleString("en-US", { maximumFractionDigits: btc >= 1 ? 4 : 7 })} BTC`;
    }
    return `${Math.round(btc * 100000000).toLocaleString("en-US")} sats`;
  }

  function formatPercent(value, absolute = false) {
    const percent = value * 100;
    const shown = absolute ? Math.abs(percent) : percent;
    const sign = absolute ? "" : shown > 0 ? "+" : "";
    return `${sign}${shown.toFixed(Math.abs(shown) >= 10 ? 0 : 1)}%`;
  }

  function relativeTime(timestamp) {
    if (!timestamp) return "reference rate";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 15) return "updated now";
    if (seconds < 60) return `updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `updated ${minutes}m ago`;
  }

  function itemTotal(item) {
    return finiteNumber(item.unitUsd) * finiteNumber(item.quantity, 1);
  }

  function monthlyValue(item) {
    const total = itemTotal(item);
    if (item.recurrence === "weekly") return total * 52 / 12;
    if (item.recurrence === "monthly") return total;
    if (item.recurrence === "yearly") return total / 12;
    return 0;
  }

  function totals() {
    return activeItems().reduce((result, item) => {
      const total = itemTotal(item);
      result.listed += total;
      result.monthly += monthlyValue(item);
      if (item.kind === "asset") result.holdings += total;
      return result;
    }, { listed: 0, monthly: 0, holdings: 0 });
  }

  function renderMarket() {
    const ageMs = state.quote.updatedAt ? Date.now() - state.quote.updatedAt : Infinity;
    const fresh = state.quote.updatedAt > 0 && ageMs <= 120000 && !state.quote.failedAt;
    els.headerPrice.textContent = fresh ? formatUsd(state.quote.usd) : "—";
    const change = state.quote.change24hPct;
    els.headerChange.classList.remove("is-up", "is-down");
    if (Number.isFinite(change)) {
      els.headerChange.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}% · 24h`;
      els.headerChange.classList.add(change >= 0 ? "is-up" : "is-down");
    } else {
      els.headerChange.textContent = fresh ? "Live spot" : state.quote.updatedAt ? "Stale quote" : "Unavailable";
    }
    els.statusDot.classList.toggle("live", fresh);
    els.quoteMeta.textContent = `${state.quote.source} · ${fresh ? relativeTime(state.quote.updatedAt) : state.quote.updatedAt ? `stale · ${relativeTime(state.quote.updatedAt)}` : "unavailable"}`;
  }


  function activeItems() { return state.catalogMode ? state.catalog : state.items; }
  function periods(item) { return selectPrices(item.priceObservations || [], state.lookback === "live" ? 0 : Number.parseInt(state.lookback)); }
  function comparisonFor(item) {
    const {latest, previous} = periods(item);
    if (!latest || !previous) return null;
    return compareObserved(previous, latest, state.rates[previous.period]?.usd, state.rates[latest.period]?.usd, item.quantity);
  }
  function priceLabel(value) { return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:3}).format(value); }
  async function loadObservedRates() {
    const wanted = [...new Set(activeItems().flatMap(item => { const p=periods(item); return [p.latest?.period,p.previous?.period].filter(Boolean); }))];
    await Promise.allSettled(wanted.map(async period => {
      if (state.rates[period]) return;
      try { const result=await fetchJson("/api/prices/btc?period="+encodeURIComponent(period),16000); state.rates[period]=result.data; delete state.rateErrors[period]; }
      catch { state.rateErrors[period]="BTC history unavailable"; }
    }));
    renderAll();
  }
  async function loadCatalog() {
    try {
      const result=await fetchJson("/api/prices/catalog",20000);
      if (!Array.isArray(result.data)) throw new Error("No usable catalog response");
      state.catalog=result.data.map(entry=>{
        const latest=selectPrices(entry.observations,0).latest;
        return {id:entry.id,name:entry.name,category:entry.category,unitUsd:latest?.usd || 0,quantity:1,recurrence:"once",notes:entry.unit+" · U.S. city average",priceObservations:entry.observations,updatedAt:0,createdAt:0};
      });
      state.catalogStatus="BLS average retail prices · "+result.status+" · retrieved "+result.retrievedAt.slice(0,10);
    } catch { state.catalogStatus="Sourced prices are unavailable. Retry, or record prices in My items."; }
    renderAll(); void loadObservedRates();
  }
  function renderHero() {
    const items=activeItems().filter(item=>item.category!=="stocks");
    const matched=items.filter(item=>{const p=periods(item);return p.previous && p.latest;});
    const comparisons=matched.map(comparisonFor).filter(Boolean);
    const thenUsd=matched.reduce((sum,item)=>sum+periods(item).previous.usd*item.quantity,0);
    const nowUsd=matched.reduce((sum,item)=>sum+periods(item).latest.usd*item.quantity,0);
    const btcThen=comparisons.reduce((sum,c)=>sum+c.btcThen,0),btcNow=comparisons.reduce((sum,c)=>sum+c.btcNow,0);
    const dates=[...new Set(matched.map(item=>{const p=periods(item);return p.previous.period+" → "+p.latest.period;}))];
    const usdChange=thenUsd?observedChange(thenUsd,nowUsd):null;
    const btcChange=btcThen && comparisons.length===matched.length?observedChange(btcThen,btcNow):null;
    const latestMode=state.lookback==="live";
    els.hero.innerHTML=`
      <div class="metric-card"><span class="metric-label">${latestMode?"Latest observed basket":"In dollars · matched items"}</span>
      <strong class="metric-value ${usdChange>0?"is-down":"is-up"}">${latestMode ? priceLabel(nowUsd) : usdChange===null?"—":formatPercent(usdChange)}</strong>
      <span class="metric-detail">${matched.length ? "Then "+priceLabel(thenUsd)+" · Latest "+priceLabel(nowUsd) : "Add dated observations or use sourced examples"}</span></div>
      <div class="metric-card accent"><span class="metric-label">In bitcoin · date-matched prices</span>
      <strong class="metric-value ${btcChange>0?"is-down":"is-up"}">${latestMode ? btcNow ? formatBtcValue(btcNow):"—" : btcChange===null?"—":formatPercent(btcChange)}</strong>
      <span class="metric-detail">${btcChange===null?"Complete BTC observations required":"Then "+formatBtcValue(btcThen)+" · Latest "+formatBtcValue(btcNow)}</span></div>`;
    els.comparisonNote.textContent=(dates.length===1?dates[0]+" · ":"")+matched.length+"/"+items.length+" items with matching price dates. Stocks excluded from basket totals.";
    els.readingCopy.textContent="Prices are observed dollar amounts. BLS entries are monthly U.S. city averages, not today's store quotes. Monthly prices use the mean daily BTC/USD close for that month; dated personal prices use that day's UTC close. Missing history is never inferred from inflation.";
    const status=document.getElementById("price-source-status");
    if(status) status.textContent=state.catalogMode?state.catalogStatus:"Your saved prices · undated entries need a dated observation to compare";
    document.querySelectorAll("[data-price-mode]").forEach(button=>button.setAttribute("aria-pressed",String((button.dataset.priceMode==="catalog")===state.catalogMode)));
  }

  function renderFilters() {
    els.filters.innerHTML = CATEGORIES.map((category) => {
      const count = category === "all" ? activeItems().length : activeItems().filter((item) => item.category === category).length;
      return `<button class="category-chip" type="button" data-category="${category}" aria-pressed="${state.category === category}">${CATEGORY_LABELS[category]} <span>${count}</span></button>`;
    }).join("");
  }

  function recurrenceLabel(value) {
    return { once: "One time", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" }[value] || value;
  }


  function itemComparisonMarkup(item) {
    const p=periods(item), comparison=comparisonFor(item);
    const latest=p.latest,previous=p.previous;
    const bitcoin=observation=>observation && state.rates[observation.period] ? formatBitcoinFromUsd(observation.usd*item.quantity,state.rates[observation.period].usd) : "BTC unavailable";
    return `<div class="then-now observed-prices">
      <span><em>Then · ${escapeHtml(p.target || "date needed")}</em><strong>${previous?priceLabel(previous.usd*item.quantity):"Unavailable"}</strong><small>${previous?escapeHtml(bitcoin(previous)):"No matching observation"}</small></span>
      <span><em>Latest · ${escapeHtml(latest?.period || "undated input")}</em><strong>${latest?priceLabel(latest.usd*item.quantity):priceLabel(itemTotal(item))}</strong><small>${latest?escapeHtml(bitcoin(latest)):"Saved input; not a verified quote"}</small></span>
      </div>
      ${previous && latest ? '<span class="comparison-badge">USD '+formatPercent(observedChange(previous.usd,latest.usd))+'</span>' : ""}
      ${comparison?'<span class="comparison-badge '+(comparison.btcPct<=0?'is-up':'is-down')+'">BTC '+formatPercent(comparison.btcPct)+'</span>':""}
      <small class="observation-source">${escapeHtml(latest?.source || (String(item.id).startsWith("ex-")?"Original example input":"User-entered input"))}</small>`;
  }

  function visibleItems() {
    const query = state.search.trim().toLowerCase();
    let items = activeItems().filter((item) => {
      const categoryMatch = state.category === "all" || item.category === state.category;
      const queryMatch = !query || `${item.name} ${item.notes} ${CATEGORY_LABELS[item.category]}`.toLowerCase().includes(query);
      return categoryMatch && queryMatch;
    });
    items = [...items].sort((a, b) => {
      if (state.sort === "amount") return itemTotal(b) - itemTotal(a);
      if (state.sort === "name") return a.name.localeCompare(b.name);
      if (state.sort === "cheapest") return itemTotal(a) - itemTotal(b);
      return b.updatedAt - a.updatedAt;
    });
    return items;
  }

  function renderList() {
    const items = visibleItems();
    if (!items.length && state.catalogMode) { els.list.innerHTML = `<div class="empty-state"><h3>${escapeHtml(state.catalogStatus)}</h3><p>Try My items to enter your own dated prices.</p></div>`; return; }
    if (!items.length) {
      const filtered = state.search || state.category !== "all";
      els.list.innerHTML = `
        <div class="empty-state">
          <h3>${filtered ? "Nothing matches" : "Your ledger is open"}</h3>
          <p>${filtered ? "Try another search or category." : "Add a stock, a bill, a game — anything with a dollar price — and see it in bitcoin."}</p>
          <button class="button button-primary" type="button" data-empty-action>${filtered ? "Clear filters" : "Add your first item"}</button>
        </div>`;
      return;
    }

    els.list.innerHTML = items.map((item) => `
      <button class="ledger-item" type="button" data-item-id="${escapeHtml(item.id)}" aria-label="${state.catalogMode ? "View price history for" : "Edit"} ${escapeHtml(item.name)}">
        <span class="item-main">
          <span class="item-category">${escapeHtml(CATEGORY_LABELS[item.category])}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.notes || recurrenceLabel(item.recurrence))}</small>
        </span>
        <span class="item-money"><small>${state.catalogMode?"Monthly average":"Quantity: "+item.quantity}</small></span>
        <span class="item-compare">${itemComparisonMarkup(item)}</span>
        <span class="item-arrow" aria-hidden="true">›</span>
      </button>`).join("");
  }

  function renderSummary() {
    const current = totals();
    $("#listed-usd").textContent = formatUsd(current.listed);
    $("#listed-btc").textContent = formatBitcoinFromUsd(current.listed, usableSpotRate());
    $("#monthly-usd").textContent = formatUsd(current.monthly);
    $("#monthly-btc").textContent = formatBitcoinFromUsd(current.monthly, usableSpotRate());
    $("#holdings-usd").textContent = formatUsd(current.holdings);
    $("#holdings-btc").textContent = formatBitcoinFromUsd(current.holdings, usableSpotRate());
  }

  function renderConverter() {
    const amount = Math.max(0, finiteNumber(els.converterInput.value));
    if (state.converterDirection === "usd") {
      els.converterInputLabel.textContent = "US dollars";
      els.converterInputPrefix.textContent = "$";
      els.converterInputSuffix.textContent = "USD";
      els.converterOutputLabel.textContent = "Bitcoin today";
      els.converterOutput.textContent = formatBitcoinFromUsd(amount, usableSpotRate());
      els.quickAmounts.hidden = false;
      els.converterNote.textContent = state.quote.updatedAt && !state.quote.failedAt && Date.now() - state.quote.updatedAt <= 120000 ? `Spot conversion only · ${state.quote.source} · ${relativeTime(state.quote.updatedAt)}. Historical item conversions use their observation dates.` : "Spot conversion unavailable until a fresh BTC/USD quote is available.";
    } else {
      els.converterInputLabel.textContent = state.denomination === "sats" ? "Satoshis" : "Bitcoin";
      els.converterInputPrefix.textContent = "";
      els.converterInputSuffix.textContent = state.denomination === "sats" ? "sats" : "BTC";
      const btc = state.denomination === "sats" ? amount / 100000000 : amount;
      els.converterOutputLabel.textContent = "US dollars today";
      const rate = usableSpotRate();
      els.converterOutput.textContent = rate ? formatUsd(btc * rate) : "—";
      els.quickAmounts.hidden = true;
      els.converterNote.textContent = rate ? `Using ${formatUsd(rate)} per bitcoin.` : "Spot conversion unavailable until a fresh BTC/USD quote is available.";
    }
  }

  function renderControls() {
    $$('[data-denomination]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.denomination === state.denomination)));
    $$('[data-lookback]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lookback === state.lookback)));
  }

  function renderAll() {
    renderControls();
    renderMarket();
    renderHero();
    renderFilters();
    renderList();
    renderSummary();
    renderConverter();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("visible"), 2600);
  }

  function openSheet(item = null) {
    state.editingId = item?.id || null;
    state.lastFocus = document.activeElement;
    els.itemForm.reset();
    els.itemId.value = item?.id || "";
    els.itemName.value = item?.name || "";
    els.itemCategory.value = item?.category || "other";
    els.itemKind.value = item?.kind || (item?.ticker ? "asset" : "purchase");
    els.itemRecurrence.value = item?.recurrence || "once";
    els.itemPrice.value = item?.unitUsd ?? "";
    els.itemQuantity.value = item?.quantity ?? 1;
    els.itemNotes.value = item?.notes || "";
    $("#price-date").value = "";
    $("#price-source").value = "";
    $("#price-history-list").textContent = (item?.priceObservations || []).map(p=>p.period+" · "+priceLabel(p.usd)+" · "+p.source).join("\n") || "No dated observations yet. Add a date to record the unit price above.";
    $("#price-date").max = new Date().toISOString().slice(0,10);
    $("#item-ticker").value = item?.ticker || "";
    els.sheetEyebrow.textContent = item ? "Ledger entry" : "New ledger entry";
    els.sheetTitle.textContent = item ? "Edit item" : "Add an item";
    els.deleteButton.hidden = !item;
    const captured = item?.btcUsdAtCapture || state.quote.usd;
    els.captureRate.textContent = `${formatUsd(captured)} / BTC`;
    els.itemSheet.hidden = false;
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => els.itemName.focus());
  }

  function closeSheet() {
    els.itemSheet.hidden = true;
    document.body.classList.remove("sheet-open");
    state.editingId = null;
    if (state.lastFocus && typeof state.lastFocus.focus === "function") state.lastFocus.focus();
  }

  function openConfirm() {
    if (!state.editingId) return;
    els.confirmDialog.hidden = false;
    requestAnimationFrame(() => $("#keep-item-button").focus());
  }

  function closeConfirm() {
    els.confirmDialog.hidden = true;
    if (!els.itemSheet.hidden) els.deleteButton.focus();
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function addItem(input, options = {}) {
    const now = Date.now();
    const item = {
      id: input.id || createId(),
      name: String(input.name || "").trim(),
      category: CATEGORIES.includes(input.category) && input.category !== "all" ? input.category : "other",
      kind: ["expense", "purchase", "asset"].includes(input.kind) ? input.kind : "purchase",
      unitUsd: finiteNumber(input.unitUsd),
      quantity: finiteNumber(input.quantity, 1),
      recurrence: ["once", "weekly", "monthly", "yearly"].includes(input.recurrence) ? input.recurrence : "once",
      btcUsdAtCapture: finiteNumber(input.btcUsdAtCapture, state.quote.usd),
      notes: String(input.notes || "").trim(),
      priceObservations: Array.isArray(input.priceObservations) ? input.priceObservations : [],
      ticker: String(input.ticker || "").toUpperCase().replace(/[^A-Z.\\-]/g,""),
      createdAt: finiteNumber(input.createdAt, now),
      updatedAt: now,
    };
    if (!validItem(item)) throw new Error("Name, price, and quantity are required.");
    const existingIndex = state.items.findIndex((candidate) => candidate.id === item.id);
    if (existingIndex >= 0) {
      item.createdAt = state.items[existingIndex].createdAt;
      state.items.splice(existingIndex, 1, item);
    } else {
      state.items.push(item);
    }
    persist();
    renderAll();
    if (!options.silent) showToast(existingIndex >= 0 ? "Item updated" : "Item added to your ledger");
    return item;
  }

  function saveForm(event) {
    event.preventDefault();
    const existing = state.items.find((item) => item.id === state.editingId);
    try {
      const period = $("#price-date").value;
      const observations = [...(existing?.priceObservations || [])];
      if (period) {
        const today = new Date().toISOString().slice(0, 10);
        if (period > today) throw new Error("Price observations cannot be in the future.");
        if (!Number.isFinite(Number(els.itemPrice.value)) || Number(els.itemPrice.value) <= 0) throw new Error("Enter a positive price observation.");
        const observation = {period, usd: Number(els.itemPrice.value), source: $("#price-source").value.trim() || "User-entered price"};
        const index = observations.findIndex(p=>p.period===period);
        if(index>=0) {
          if (!window.confirm(`Replace the saved observation for ${period}?`)) return;
          observations[index]=observation;
        } else observations.push(observation);
      }
      const latest = selectPrices(observations,0).latest;
      addItem({
        id: existing?.id,
        name: els.itemName.value,
        category: els.itemCategory.value,
        kind: els.itemKind.value,
        recurrence: els.itemRecurrence.value,
        unitUsd: latest?.usd ?? els.itemPrice.value,
        priceObservations: observations,
        ticker: $("#item-ticker").value,
        quantity: els.itemQuantity.value,
        notes: els.itemNotes.value,
        btcUsdAtCapture: existing?.btcUsdAtCapture || state.quote.usd,
        createdAt: existing?.createdAt,
      });
      closeSheet();
      void loadObservedRates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save this item");
    }
  }

  function deleteEditingItem() {
    const index = state.items.findIndex((item) => item.id === state.editingId);
    if (index < 0) return;
    state.items.splice(index, 1);
    persist();
    closeConfirm();
    closeSheet();
    renderAll();
    showToast("Item deleted");
  }

  async function fetchJson(url, timeout = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshQuote() {
    try {
      const result = await fetchJson("/api/btc/spot", 12000);
      const usd = finiteNumber(result?.data?.price);
      if (usd <= 0) throw new Error("No live quote");
      state.quote = { ...state.quote, usd, change24hPct: finiteNumber(result?.data?.change24h, null), updatedAt: Date.now(), source: result.source || "Coinbase", failedAt: 0 };
      persist();
      renderAll();
    } catch {
      state.quote.failedAt = Date.now();
      renderMarket();
      els.quoteMeta.textContent = `${state.quote.source} · live refresh unavailable`;
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const mode = event.target.closest("[data-price-mode]");
      if(mode) {state.catalogMode=mode.dataset.priceMode==="catalog"; state.category="all"; state.search=""; els.search.value=""; renderAll(); void loadObservedRates(); return;}
      if(event.target.closest("#retry-prices")) { void loadCatalog(); return; }
      const denomination = event.target.closest("[data-denomination]");
      if (denomination) {
        state.denomination = denomination.dataset.denomination;
        persist();
        renderAll();
        return;
      }

      const lookback = event.target.closest("[data-lookback]");
      if (lookback) {
        state.lookback = lookback.dataset.lookback;
        persist();
        renderAll();
        void loadObservedRates();
        return;
      }

      const category = event.target.closest("[data-category]");
      if (category) {
        state.category = category.dataset.category;
        renderFilters();
        renderList();
        return;
      }

      const itemButton = event.target.closest("[data-item-id]");
      if (itemButton) {
        const item = activeItems().find((candidate) => candidate.id === itemButton.dataset.itemId);
        if (item && state.catalogMode) {
          const dialog=$("#source-history");
          $("#source-history-title").textContent=item.name+" · "+item.notes;
          $("#source-history-content").textContent=(item.priceObservations || []).sort((a,b)=>b.period.localeCompare(a.period)).map(p=>p.period+"   "+priceLabel(p.usd)).join("\n");
          $("#source-history-link").href="https://data.bls.gov/timeseries/"+item.id;
          dialog.showModal();
        } else if(item) openSheet(item);
        return;
      }

      const emptyAction = event.target.closest("[data-empty-action]");
      if (emptyAction) {
        if (state.search || state.category !== "all") {
          state.search = "";
          state.category = "all";
          els.search.value = "";
          renderFilters();
          renderList();
        } else openSheet();
      }
    });

    $("#add-item-button").addEventListener("click", () => {state.catalogMode=false; renderAll(); openSheet();});
    $("#close-source-history").addEventListener("click",()=>$("#source-history").close());
    $("#close-sheet-button").addEventListener("click", closeSheet);
    $("#sheet-backdrop").addEventListener("click", closeSheet);
    $("#cancel-item-button").addEventListener("click", closeSheet);
    els.itemForm.addEventListener("submit", saveForm);
    els.deleteButton.addEventListener("click", openConfirm);
    $("#keep-item-button").addEventListener("click", closeConfirm);
    $("#confirm-delete-button").addEventListener("click", deleteEditingItem);

    const exportButton = $("#export-ledger-button");
    const importButton = $("#import-ledger-button");
    const importInput = $("#import-ledger-input");
    exportButton?.addEventListener("click", () => {
      const payload = JSON.stringify({ version: 3, savedItems: state.items, exportedAt: new Date().toISOString() }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "priced-in-backup.json"; link.click(); URL.revokeObjectURL(url);
      showToast("Backup exported");
    });
    importButton?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const candidates = Array.isArray(raw) ? raw : Array.isArray(raw?.savedItems) ? raw.savedItems : Array.isArray(raw?.state?.savedItems) ? raw.state.savedItems : [];
        const imported = candidates.map((item) => ({ ...item, kind: item.kind || (item.ticker ? "asset" : item.recurrence && item.recurrence !== "once" ? "expense" : "purchase"), unitUsd: finiteNumber(item.unitUsd ?? item.amount), quantity: finiteNumber(item.quantity, 1), recurrence: item.recurrence || "once", createdAt: finiteNumber(Date.parse(item.createdAt), Date.now()), updatedAt: finiteNumber(Date.parse(item.updatedAt || item.createdAt), Date.now()) })).filter(validItem);
        if (!imported.length) throw new Error("No valid ledger records found");
        if (!window.confirm(`Replace this ledger with ${imported.length} imported item${imported.length === 1 ? "" : "s"}? A recovery copy will be kept.`)) return;
        localStorage.setItem(`${V3_STORAGE_KEY}-recovery`, JSON.stringify({ version: 3, savedItems: state.items, exportedAt: new Date().toISOString() }));
        state.items = imported; state.catalogMode = false; persist(); renderAll(); showToast("Backup imported");
      } catch (error) { showToast(error instanceof Error ? error.message : "Backup could not be imported"); }
      importInput.value = "";
    });

    els.search.addEventListener("input", () => {
      state.search = els.search.value;
      renderList();
    });
    els.sort.addEventListener("change", () => {
      state.sort = els.sort.value;
      renderList();
    });
    els.converterInput.addEventListener("input", renderConverter);
    $("#swap-button").addEventListener("click", () => {
      const current = Math.max(0, finiteNumber(els.converterInput.value));
      if (state.converterDirection === "usd") {
        const btc = current / state.quote.usd;
        els.converterInput.value = state.denomination === "sats" ? Math.round(btc * 100000000) : Number(btc.toFixed(8));
        state.converterDirection = "btc";
      } else {
        const btc = state.denomination === "sats" ? current / 100000000 : current;
        els.converterInput.value = Number((btc * state.quote.usd).toFixed(2));
        state.converterDirection = "usd";
      }
      renderConverter();
    });
    els.quickAmounts.addEventListener("click", (event) => {
      const button = event.target.closest("[data-amount]");
      if (!button) return;
      els.converterInput.value = button.dataset.amount;
      renderConverter();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!els.confirmDialog.hidden) closeConfirm();
      else if (!els.itemSheet.hidden) closeSheet();
    });
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const report = () => {};

    try {
      void Promise.resolve(context.registerTool({
        name: "read_ledger_summary",
        title: "Read ledger summary",
        description: "Return the current Priced In ledger totals and display settings without changing anything.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() {
          const current = totals();
          return { itemCount: state.items.length, listedUsd: current.listed, monthlyUsd: current.monthly, holdingsUsd: current.holdings, btcUsd: state.quote.usd, denomination: state.denomination, lookback: state.lookback };
        },
      })).catch(report);

      void Promise.resolve(context.registerTool({
        name: "add_ledger_item",
        title: "Add ledger item",
        description: "Add one priced item to the visible local ledger and capture the current BTC/USD rate.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            category: { type: "string", enum: CATEGORIES.filter((value) => value !== "all") },
            unitUsd: { type: "number", exclusiveMinimum: 0 },
            quantity: { type: "number", exclusiveMinimum: 0, default: 1 },
            recurrence: { type: "string", enum: ["once", "weekly", "monthly", "yearly"], default: "once" },
            notes: { type: "string", maxLength: 240 },
          },
          required: ["name", "category", "unitUsd"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== "object") throw new Error("Item details are required.");
          const item = addItem({ ...input, quantity: input.quantity ?? 1, recurrence: input.recurrence ?? "once", btcUsdAtCapture: state.quote.usd }, { silent: true });
          showToast("Item added to your ledger");
          return { id: item.id, name: item.name, totalUsd: itemTotal(item), btcUsdAtCapture: item.btcUsdAtCapture };
        },
      })).catch(report);
    } catch {
      // Unsupported or partial WebMCP implementations should not affect the app.
    }
  }

  loadState();
  bindEvents();
  renderAll();
  registerWebMcpTools();
  refreshQuote();
  void loadCatalog();
  setInterval(refreshQuote, 60000);
  setInterval(renderMarket, 15000);
})();
