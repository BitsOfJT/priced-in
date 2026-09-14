import { selectPrices, compareObserved, observedChange } from './src/lib/observed-prices.ts';
(() => {
  "use strict";

  const STORAGE_KEY = "priced-in-ledger";

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
    ["ex-0-apple-aapl", "Apple · AAPL", "stocks", 229.87, 8, "once", 64200, "Eight shares at last review"],
    ["ex-1-msft", "Microsoft · MSFT", "stocks", 515.42, 4, "once", 65300, "Long-term holding"],
    ["ex-2-netflix", "Netflix", "bills", 24.99, 1, "monthly", 68100, "Premium plan"],
    ["ex-3-rent", "Apartment rent", "housing", 1850, 1, "monthly", 57900, "Home base"],
    ["ex-4-groceries", "Weekly groceries", "food", 168, 1, "weekly", 61700, "Typical basket"],
    ["ex-5-ps5", "PlayStation 5", "games", 499.99, 1, "once", 48400, "Disc edition"],
    ["ex-6-elden-ring", "Elden Ring", "games", 59.99, 1, "once", 43200, "Base game"],
    ["ex-7-iphone", "iPhone 16 Pro", "tech", 999, 1, "once", 59600, "128 GB"],
    ["ex-8-internet", "Home internet", "bills", 79.99, 1, "monthly", 70100, "Fiber plan"],
    ["ex-9-spotify", "Spotify", "bills", 11.99, 1, "monthly", 67300, "Individual plan"],
  ].map(([id, name, category, unitUsd, quantity, recurrence, btcUsdAtCapture, notes], index) => ({
    id,
    name,
    category,
    unitUsd,
    quantity,
    recurrence,
    btcUsdAtCapture,
    notes,
    createdAt: Date.UTC(2026, 8, 1) + index * 86400000,
    updatedAt: Date.UTC(2026, 8, 1) + index * 86400000,
  }));

  const fallbackQuote = {
    usd: 77000,
    change24hPct: null,
    updatedAt: 0,
    source: "reference rate",
    history: null,
  };

  const state = {
    items: EXAMPLE_ITEMS,
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
          unitUsd: finiteNumber(item.unitUsd),
          quantity: finiteNumber(item.quantity, 1),
          btcUsdAtCapture: finiteNumber(item.btcUsdAtCapture, fallbackQuote.usd),
          createdAt: finiteNumber(item.createdAt, Date.now()),
          updatedAt: finiteNumber(item.updatedAt, Date.now()),
          notes: typeof item.notes === "string" ? item.notes : "",
        }));
        state.items = cleaned;
      }
      if (["sats", "btc"].includes(saved.denomination)) state.denomination = saved.denomination;
      if (isLookback(saved.lookback)) state.lookback = saved.lookback;
      if (saved.quote && finiteNumber(saved.quote.usd) > 0) {
        state.quote = {
          ...fallbackQuote,
          ...saved.quote,
          usd: finiteNumber(saved.quote.usd, fallbackQuote.usd),
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
  }

  function formatUsd(value, compact = false) {
    const options = compact && Math.abs(value) >= 10000
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { minimumFractionDigits: value < 100 ? 2 : 0, maximumFractionDigits: value < 100 ? 2 : 0 };
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...options }).format(value);
  }

  function formatBitcoinFromUsd(usd, rate = state.quote.usd) {
    if (!rate || rate <= 0) return "—";
    const btc = usd / rate;
    if (state.denomination === "btc") {
      const digits = btc >= 1 ? 4 : btc >= 0.01 ? 5 : 7;
      return `${btc.toLocaleString("en-US", { maximumFractionDigits: digits })} BTC`;
    }
    const sats = Math.round(btc * 100000000);
    return `${sats.toLocaleString("en-US")} sats`;
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
      if (item.recurrence === "once") result.holdings += total;
      return result;
    }, { listed: 0, monthly: 0, holdings: 0 });
  }

  function renderMarket() {
    els.headerPrice.textContent = formatUsd(state.quote.usd);
    const change = state.quote.change24hPct;
    els.headerChange.classList.remove("is-up", "is-down");
    if (Number.isFinite(change)) {
      els.headerChange.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}% · 24h`;
      els.headerChange.classList.add(change >= 0 ? "is-up" : "is-down");
    } else {
      els.headerChange.textContent = state.quote.updatedAt ? "Live spot" : "Reference rate";
    }
    els.statusDot.classList.toggle("live", Boolean(state.quote.updatedAt));
    els.quoteMeta.textContent = `${state.quote.source} · ${relativeTime(state.quote.updatedAt)}`;
  }


  // Theme preference is shared with the rebuild app so both pages agree.
  const THEME_KEY = "priced-in-theme";
  function currentTheme() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4efe6" : "#0c0b09");
    renderThemeToggle();
  }
  function renderThemeToggle() {
    const toggle = $("#theme-toggle");
    if (!toggle) return;
    const dark = currentTheme() === "dark";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    toggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  const MAX_LOOKBACK_YEARS = 10;
  function isLookback(value) { return value === "live" || /^([1-9]|10)y$/.test(String(value)); }
  function lookbackYears(value = state.lookback) { return value === "live" ? 0 : Number.parseInt(value, 10); }
  function lookbackFromYears(years) { const clamped = Math.min(MAX_LOOKBACK_YEARS, Math.max(0, Math.round(years))); return clamped === 0 ? "live" : `${clamped}y`; }
  function lookbackText(value = state.lookback) { const years = lookbackYears(value); return years === 0 ? "Live prices" : years === 1 ? "1 year ago" : `${years} years ago`; }
  function activeItems() { return state.catalogMode ? state.catalog : state.items; }
  function periods(item) { return selectPrices(item.priceObservations || [], lookbackYears()); }
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
    $("#listed-btc").textContent = formatBitcoinFromUsd(current.listed);
    $("#monthly-usd").textContent = formatUsd(current.monthly);
    $("#monthly-btc").textContent = formatBitcoinFromUsd(current.monthly);
    $("#holdings-usd").textContent = formatUsd(current.holdings);
    $("#holdings-btc").textContent = formatBitcoinFromUsd(current.holdings);
  }

  function renderConverter() {
    const amount = Math.max(0, finiteNumber(els.converterInput.value));
    if (state.converterDirection === "usd") {
      els.converterInputLabel.textContent = "US dollars";
      els.converterInputPrefix.textContent = "$";
      els.converterInputSuffix.textContent = "USD";
      els.converterOutputLabel.textContent = "Bitcoin today";
      els.converterOutput.textContent = formatBitcoinFromUsd(amount);
      els.quickAmounts.hidden = false;
      els.converterNote.textContent = `Spot conversion only · ${state.quote.source} · ${relativeTime(state.quote.updatedAt)}. Historical item conversions use their observation dates.`;
    } else {
      els.converterInputLabel.textContent = state.denomination === "sats" ? "Satoshis" : "Bitcoin";
      els.converterInputPrefix.textContent = "";
      els.converterInputSuffix.textContent = state.denomination === "sats" ? "sats" : "BTC";
      const btc = state.denomination === "sats" ? amount / 100000000 : amount;
      els.converterOutputLabel.textContent = "US dollars today";
      els.converterOutput.textContent = formatUsd(btc * state.quote.usd);
      els.quickAmounts.hidden = true;
      els.converterNote.textContent = `Using ${formatUsd(state.quote.usd)} per bitcoin.`;
    }
  }

  function renderControls() {
    $$('[data-denomination]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.denomination === state.denomination)));
    const dial = $("#lookback-dial");
    if (dial) {
      const years = String(lookbackYears());
      if (dial.value !== years) dial.value = years;
      dial.setAttribute("aria-valuetext", lookbackText());
      dial.style.setProperty("--dial-progress", `${lookbackYears() / MAX_LOOKBACK_YEARS * 100}%`);
    }
    const readout = $("#lookback-value");
    if (readout) readout.textContent = lookbackText();
    renderThemeToggle();
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
        const observation = {period, usd: Number(els.itemPrice.value), source: $("#price-source").value.trim() || "User-entered price"};
        const index = observations.findIndex(p=>p.period===period);
        if(index>=0) observations[index]=observation; else observations.push(observation);
      }
      const latest = selectPrices(observations,0).latest;
      addItem({
        id: existing?.id,
        name: els.itemName.value,
        category: els.itemCategory.value,
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
    const previousHistory = state.quote.history || {};
    try {
      const [spotResult, statsResult, ...historyResults] = await Promise.allSettled([
        fetchJson("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
        fetchJson("https://api.exchange.coinbase.com/products/BTC-USD/stats"),

      ]);

      let usd = spotResult.status === "fulfilled" ? finiteNumber(spotResult.value?.data?.amount) : 0;
      let source = "Coinbase";
      if (usd <= 0) {
        const fallback = await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
        usd = finiteNumber(fallback?.bitcoin?.usd);
        source = "CoinGecko";
        if (usd <= 0) throw new Error("No live quote");
        state.quote.change24hPct = finiteNumber(fallback?.bitcoin?.usd_24h_change, null);
      }

      let change24hPct = state.quote.change24hPct;
      if (statsResult.status === "fulfilled") {
        const open = finiteNumber(statsResult.value?.open);
        const last = finiteNumber(statsResult.value?.last, usd);
        if (open > 0) change24hPct = ((last - open) / open) * 100;
      }

      const history = { ...previousHistory };
      historyResults.forEach((result) => {
        if (result.status === "fulfilled") history[result.value.id] = result.value;
      });

      state.quote = { usd, change24hPct, updatedAt: Date.now(), source, history };
      persist();
      renderAll();
    } catch {
      renderMarket();
      els.quoteMeta.textContent = `${state.quote.source} · live refresh unavailable`;
    }
  }

  function bindEvents() {
    const dial = $("#lookback-dial");
    if (dial) {
      // Re-render on every step so the basket totals track the dial; only fetch BTC history once the user settles.
      dial.addEventListener("input", () => {
        const next = lookbackFromYears(Number(dial.value));
        if (next === state.lookback) return;
        state.lookback = next;
        persist();
        renderAll();
      });
      dial.addEventListener("change", () => { void loadObservedRates(); });
    }

    document.addEventListener("click", (event) => {
      if (event.target.closest("#theme-toggle")) { applyTheme(currentTheme() === "dark" ? "light" : "dark"); return; }
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
