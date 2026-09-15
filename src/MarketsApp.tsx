import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Moon, Search, Sun } from 'lucide-react'
import { getSpot } from './lib/api'

type Timeframe = 'YTD' | '1Y' | '3Y' | '5Y' | '10Y' | 'MAX'
type Category = 'Core' | 'Equities' | 'Bitcoin equities' | 'Fixed income' | 'Commodities' | 'Currencies' | 'Real estate' | 'Digital assets'
type Asset = { name: string; ticker: string; category: Category; price: number; returns: Record<Timeframe, number | null>; color: string }

const timeframes: Timeframe[] = ['YTD', '1Y', '3Y', '5Y', '10Y', 'MAX']
const categories: Array<'All' | Category> = ['All', 'Core', 'Equities', 'Bitcoin equities', 'Fixed income', 'Commodities', 'Currencies', 'Real estate', 'Digital assets']
const assets: Asset[] = [
  { name: 'U.S. Dollar', ticker: 'USD', category: 'Core', price: .00001294, returns: { YTD: 14.87, '1Y': 49.35, '3Y': -65.56, '5Y': -37.64, '10Y': -99.21, MAX: -99.41 }, color: '#8faf88' },
  { name: 'Gold', ticker: 'XAU', category: 'Core', price: .05555651, returns: { YTD: 14.25, '1Y': 74.03, '3Y': -23.15, '5Y': 49.31, '10Y': -97.43, MAX: -97.92 }, color: '#d4a574' },
  { name: 'S&P 500', ticker: 'SPY', category: 'Core', price: .00984490, returns: { YTD: 29.99, '1Y': 73.33, '3Y': -39.04, '5Y': 13.04, '10Y': -96.76, MAX: -97.26 }, color: '#8aa9d4' },
  { name: 'Nasdaq 100', ticker: 'QQQ', category: 'Equities', price: .00917596, returns: { YTD: 34.80, '1Y': 79.60, '3Y': -33.09, '5Y': 20.35, '10Y': -94.94, MAX: -95.38 }, color: '#b398c8' },
  { name: 'Strategy Inc.', ticker: 'MSTR', category: 'Bitcoin equities', price: .00177184, returns: { YTD: 1.42, '1Y': -37.63, '3Y': 38.35, '5Y': 34.85, '10Y': -93.58, MAX: -94.18 }, color: '#c17b6a' },
  { name: 'U.S. Treasuries', ticker: 'TLT', category: 'Fixed income', price: .00104714, returns: { YTD: 9.45, '1Y': 37.50, '3Y': -66.62, '5Y': -60.80, '10Y': -99.38, MAX: -99.42 }, color: '#74aa9b' },
  { name: 'Crude Oil', ticker: 'CL', category: 'Commodities', price: .00133790, returns: { YTD: 106.76, '1Y': 143.95, '3Y': -60.78, '5Y': -11.23, '10Y': -98.15, MAX: -99.35 }, color: '#d98958' },
  { name: 'US Real Estate', ticker: 'VNQ', category: 'Real estate', price: .00122052, returns: { YTD: 25.37, '1Y': 56.51, '3Y': -55.68, '5Y': -34.17, '10Y': -98.72, MAX: -98.80 }, color: '#9d8eb8' },
  { name: 'Ethereum', ticker: 'ETH', category: 'Digital assets', price: .03215379, returns: { YTD: -5.01, '1Y': -17.99, '3Y': -47.87, '5Y': -57.13, '10Y': null, MAX: -55.98 }, color: '#8695c9' },
]

const chartSeries = [
  { month: 'Oct 21', gold: 0, stocks: 0, mstr: 0, usd: 0, bonds: 0 },
  { month: 'Aug 22', gold: 112, stocks: 64, mstr: 210, usd: 12, bonds: 28 },
  { month: 'Jun 23', gold: 61, stocks: 26, mstr: 74, usd: -4, bonds: -21 },
  { month: 'Apr 24', gold: 18, stocks: -8, mstr: 34, usd: -13, bonds: -48 },
  { month: 'Feb 25', gold: 95, stocks: 12, mstr: 186, usd: -22, bonds: -55 },
  { month: 'Dec 25', gold: 75, stocks: 2, mstr: 14, usd: -31, bonds: -61 },
  { month: 'Sep 26', gold: 49.31, stocks: 13.04, mstr: 34.85, usd: -37.64, bonds: -60.80 },
]

const leaders = [
  ['NVIDIA Corp.', '+488.6%'], ['Zcash', '+411.0%'], ['Broadcom Inc.', '+362.5%'], ['Palantir Technologies', '+298.9%'], ['Advanced Micro Devices', '+191.4%'],
]
const laggards = [
  ['Cardano', '-94.9%'], ['MARA Holdings', '-80.7%'], ['Block Inc.', '-80.1%'], ['Dogecoin', '-79.2%'], ['U.S. Treasuries', '-60.8%'],
]
const sectors = [['Energy', 122.9], ['Technology', 56.1], ['Industrials', 11.6], ['Financials', 2.0], ['Utilities', .6], ['Materials', -10.2], ['Healthcare', -15.3], ['Real Estate', -33.3]] as const

const pct = (value: number | null) => value === null ? 'N/A' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
const btcPrice = (value: number, unit: 'BTC' | 'sats') => unit === 'BTC' ? `₿${value.toFixed(value >= .01 ? 6 : 8)}` : `${Math.round(value * 100_000_000).toLocaleString()} sats`

function Return({ value }: { value: number | null }) {
  return <span className={value === null ? 'market-na' : value >= 0 ? 'market-up' : 'market-down'}>{pct(value)}</span>
}

function MarketsApp() {
  const [timeframe, setTimeframe] = useState<Timeframe>('5Y')
  const [category, setCategory] = useState<'All' | Category>('All')
  const [query, setQuery] = useState('')
  const [unit, setUnit] = useState<'BTC' | 'sats'>('BTC')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('priced-in-theme') === 'light' ? 'light' : 'dark')
  const spot = useQuery({ queryKey: ['spot'], queryFn: getSpot, refetchInterval: 60_000 })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('priced-in-theme', theme)
  }, [theme])

  const filtered = useMemo(() => assets
    .filter((asset) => (category === 'All' || asset.category === category) && `${asset.name} ${asset.ticker}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.returns[timeframe] ?? -Infinity) - (a.returns[timeframe] ?? -Infinity)), [category, query, timeframe])

  const exportCsv = () => {
    const rows = [['Asset', 'Ticker', 'Category', 'Price in BTC', ...timeframes], ...filtered.map((asset) => [asset.name, asset.ticker, asset.category, String(asset.price), ...timeframes.map((period) => asset.returns[period] === null ? '' : String(asset.returns[period]))])]
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `priced-in-${timeframe.toLowerCase()}-returns.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <div className="markets-shell">
    <header className="markets-topbar">
      <a className="markets-brand" href="#top" aria-label="Priced In home">
        <span className="markets-mark">₿</span>
        <span><strong>Priced In</strong><small>Bitcoin is the benchmark</small></span>
      </a>
      <nav className="markets-nav" aria-label="Priced In views">
        <a className="active" href="/">Markets</a>
        <a href="/rebuild.html">Everyday prices</a>
        <a href="/ledger.html">My ledger</a>
      </nav>
      <div className="markets-quote" aria-live="polite">
        <span><i className={spot.data?.data.price ? 'live-dot' : ''} />BTC / USD</span>
        <strong>{spot.data?.data.price ? `$${Math.round(spot.data.data.price).toLocaleString()}` : 'Connecting…'}</strong>
      </div>
      <button className="markets-theme" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>

    <main id="top" className="markets-main">
      <section className="markets-hero">
        <div className="markets-hero-copy">
          <p className="markets-eyebrow">The hurdle rate</p>
          <h1>What is winning<br />when priced in <em>bitcoin?</em></h1>
          <p className="markets-intro">Dollar gains only tell half the story. Compare stocks, commodities, currencies, and real estate against the hardest money.</p>
          <div className="source-note"><span>Source snapshot</span><strong>PricedInBitcoin21 · Sep 15, 2026</strong></div>
        </div>

        <div className="markets-chart-card">
          <div className="markets-chart-head">
            <div><span>Core asset returns</span><strong>{timeframe} · priced in bitcoin</strong></div>
            <div className="timeframe-pills" aria-label="Return timeframe">{timeframes.map((period) => <button key={period} className={timeframe === period ? 'active' : ''} onClick={() => setTimeframe(period)}>{period}</button>)}</div>
          </div>
          <div className="markets-chart">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartSeries} margin={{ top: 18, right: 4, bottom: 0, left: -18 }}>
              <defs>{[['gold', '#d4a574'], ['stocks', '#8aa9d4'], ['mstr', '#c17b6a'], ['usd', '#8faf88'], ['bonds', '#74aa9b']].map(([key, color]) => <linearGradient key={key} id={`market-${key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".24" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>)}</defs>
              <CartesianGrid stroke="var(--markets-line)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--markets-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--markets-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`} />
              <Tooltip contentStyle={{ background: 'var(--markets-raised)', border: '1px solid var(--markets-line-strong)', borderRadius: 12, color: 'var(--markets-text)' }} formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 'Return']} />
              <Area type="monotone" dataKey="gold" stroke="#d4a574" fill="url(#market-gold)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="stocks" stroke="#8aa9d4" fill="url(#market-stocks)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="mstr" stroke="#c17b6a" fill="url(#market-mstr)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="usd" stroke="#8faf88" fill="url(#market-usd)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="bonds" stroke="#74aa9b" fill="url(#market-bonds)" strokeWidth={2} dot={false} />
            </AreaChart></ResponsiveContainer>
          </div>
          <div className="markets-legend">{[['Gold', '#d4a574', '+49.3%'], ['MSTR', '#c17b6a', '+34.9%'], ['S&P 500', '#8aa9d4', '+13.0%'], ['USD', '#8faf88', '-37.6%'], ['Treasuries', '#74aa9b', '-60.8%']].map(([name, color, value]) => <div key={name}><i style={{ background: color }} /><span>{name}</span><strong className={value.startsWith('-') ? 'market-down' : 'market-up'}>{value}</strong></div>)}</div>
        </div>
      </section>

      <section className="markets-score-row" aria-label="Bitcoin benchmark summary">
        <article className="benchmark-card">
          <p className="markets-eyebrow">Assets losing to bitcoin · 5Y</p>
          <div className="benchmark-number"><strong>70%</strong><span><b>72</b> of 103 assets</span></div>
          <div className="benchmark-details"><span>Median return <b className="market-down">−17.6%</b></span><span>Average return <b className="market-up">+1.6%</b></span></div>
        </article>
        <article className="distribution-card">
          <p className="markets-eyebrow">Return distribution</p>
          <div className="distribution-bars">{([['Below −75%', 4, 'down'], ['−50 to −75%', 10, 'down'], ['−25 to −50%', 31, 'down'], ['0 to −25%', 27, 'down'], ['0 to +25%', 15, 'up'], ['Above +25%', 16, 'up']] as const).map(([label, count, tone]) => <div key={label}><span>{label}</span><i><b className={tone} style={{ width: `${count / 31 * 100}%` }} /></i><strong>{count}</strong></div>)}</div>
        </article>
      </section>

      <section className="markets-editorial-grid">
        <article className="ranking-card">
          <div className="section-heading"><div><p className="markets-eyebrow">Leaders and laggards</p><h2>Who cleared the hurdle?</h2></div><span>5-year return</span></div>
          <div className="ranking-columns"><div><h3>Outperformed</h3>{leaders.map(([name, value], index) => <div className="ranking-row" key={name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><b className="market-up">{value}</b></div>)}</div><div><h3>Underperformed</h3>{laggards.map(([name, value], index) => <div className="ranking-row" key={name}><span>{String(99 + index).padStart(2, '0')}</span><strong>{name}</strong><b className="market-down">{value}</b></div>)}</div></div>
        </article>
        <article className="sector-card-warm">
          <div className="section-heading"><div><p className="markets-eyebrow">Equity sectors</p><h2>Return in bitcoin</h2></div><span>5 years</span></div>
          <div className="sector-list-warm">{sectors.map(([name, value]) => <div key={name}><span>{name}</span><Return value={value} /></div>)}</div>
        </article>
      </section>

      <section className="markets-table-section">
        <div className="table-section-heading">
          <div><p className="markets-eyebrow">Asset returns</p><h2>Everything, measured in bitcoin.</h2></div>
          <div className="table-actions">
            <div className="unit-toggle" aria-label="Bitcoin display unit"><button aria-pressed={unit === 'BTC'} onClick={() => setUnit('BTC')}>BTC</button><button aria-pressed={unit === 'sats'} onClick={() => setUnit('sats')}>sats</button></div>
            <button className="download-button" onClick={exportCsv}><Download size={16} />Export CSV</button>
          </div>
        </div>
        <div className="markets-filters">
          <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" aria-label="Search assets" /></label>
          <div>{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        </div>
        <div className="markets-table-wrap"><table><thead><tr><th>#</th><th>Asset</th><th>Price</th>{timeframes.map((period) => <th key={period}><button className={timeframe === period ? 'active' : ''} onClick={() => setTimeframe(period)}>{period}</button></th>)}</tr></thead><tbody>{filtered.map((asset, index) => <tr key={asset.ticker}><td>{String(index + 1).padStart(2, '0')}</td><td><i style={{ background: asset.color }} /><span><strong>{asset.name}</strong><small>{asset.ticker} · {asset.category}</small></span></td><td>{btcPrice(asset.price, unit)}</td>{timeframes.map((period) => <td key={period}><Return value={asset.returns[period]} /></td>)}</tr>)}</tbody></table>{filtered.length === 0 && <p className="markets-empty">No assets match “{query}”.</p>}</div>
        <footer><span>Market returns are a sourced snapshot. BTC/USD in the header is live from Coinbase when available.</span><a href="https://pricedinbitcoin21.com/" target="_blank" rel="noreferrer">View source methodology ↗</a></footer>
      </section>
    </main>
  </div>
}

export default MarketsApp
