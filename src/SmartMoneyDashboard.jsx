import React, { useState, useEffect, useCallback, useRef } from 'react';

const POLYGON_API_KEY = process.env.REACT_APP_POLYGON_API_KEY;

const DEFAULT_TICKERS = {
  SPY: { basePrice: 585 },
  QQQ: { basePrice: 425 },
  NVDA: { basePrice: 135 },
  AAPL: { basePrice: 234 },
  TSLA: { basePrice: 310 },
  AMZN: { basePrice: 185 },
  MSFT: { basePrice: 415 },
  META: { basePrice: 520 },
  AMD: { basePrice: 155 },
  GOOGL: { basePrice: 175 },
};

// Colors like image 2: purple → teal → yellow based on premium size
const getPremiumColor = (premium, isBullish) => {
  const val = Math.min(Math.abs(premium), 2000000);
  const t = val / 2000000;
  if (isBullish) {
    if (t < 0.15) return '#1a0533';
    if (t < 0.30) return '#2d1b69';
    if (t < 0.45) return '#4a2080';
    if (t < 0.60) return '#00897b';
    if (t < 0.75) return '#00bcd4';
    if (t < 0.90) return '#26c6da';
    return '#f9a825';
  } else {
    if (t < 0.15) return '#1a0533';
    if (t < 0.30) return '#2d1b69';
    if (t < 0.45) return '#6a1b9a';
    if (t < 0.60) return '#8e24aa';
    if (t < 0.75) return '#ab47bc';
    if (t < 0.90) return '#ce93d8';
    return '#f9a825';
  }
};

const getTextColor = (premium) => {
  const val = Math.min(Math.abs(premium), 2000000);
  const t = val / 2000000;
  return t > 0.25 ? '#ffffff' : '#aaaaaa';
};

const formatPremium = (p) => {
  if (!p || p === 0) return '$0';
  if (p >= 1000000) return `$${(p / 1000000).toFixed(1)}M`;
  if (p >= 1000) return `$${(p / 1000).toFixed(0)}K`;
  return `$${Math.round(p)}`;
};

const getGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  return 'C';
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch real price using free tier previous close
const fetchQuote = async (ticker) => {
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      return {
        price: r.c,
        priceChange: ((r.c - r.o) / r.o * 100),
      };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Generate mock daily heatmap rows (single column like image 2)
const generateDailyRows = (basePrice) => {
  const rows = [];
  const baseStrike = Math.floor(basePrice / 5) * 5;
  for (let i = 10; i >= -10; i--) {
    const strike = baseStrike + i * 5;
    const isOTM = i !== 0;
    const volume = Math.floor(Math.random() * 8000 + 500);
    const oi = Math.floor(Math.random() * 15000 + 1000);
    const premium = Math.random() * 2000000 + 50000;
    const netPremium = (Math.random() - 0.4) * premium;
    const isAskSide = Math.random() > 0.35;
    const isSweep = volume > oi * 0.4 && Math.random() > 0.65;
    const isGoldenSweep = Math.abs(premium) > 500000 && isOTM && isSweep && isAskSide;
    const callOrPut = Math.random() > 0.5 ? 'call' : 'put';
    const isBullish = netPremium > 0;
    let score = 50;
    score += isBullish ? 10 : -10;
    score += (volume / oi) > 3 ? 15 : 0;
    score += Math.abs(premium) > 500000 ? 15 : Math.abs(premium) > 100000 ? 5 : 0;
    score += isSweep ? 10 : 0;
    score += isGoldenSweep ? 25 : 0;
    rows.push({
      strike,
      premium: Math.abs(premium),
      netPremium,
      isBullish,
      isGoldenSweep,
      scoreContribution: score,
      volume,
      openInterest: oi,
      callOrPut,
    });
  }
  return rows;
};

// Generate mock golden sweeps across broader market
const generateMarketSweeps = () => {
  const marketTickers = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'META', 'AMD', 'GOOGL', 'NFLX', 'COIN', 'MSTR', 'PLTR', 'ARM'];
  const sweeps = [];
  for (let i = 0; i < 20; i++) {
    const ticker = marketTickers[Math.floor(Math.random() * marketTickers.length)];
    const base = DEFAULT_TICKERS[ticker]?.basePrice || 100;
    const strike = Math.floor(base / 5) * 5 + (Math.floor(Math.random() * 10) - 5) * 5;
    const premium = Math.random() * 1500000 + 500000;
    const isBullish = Math.random() > 0.45;
    const score = Math.floor(Math.random() * 40) + 60;
    const exps = ['0DTE', '2DTE', '4DTE', '7DTE', '14DTE'];
    sweeps.push({
      ticker,
      strike,
      type: isBullish ? 'CALL' : 'PUT',
      expiration: exps[Math.floor(Math.random() * exps.length)],
      premium,
      score,
      grade: getGrade(score),
      isBullish,
    });
  }
  return sweeps.sort((a, b) => b.premium - a.premium);
};

const SmartMoneyDashboard = () => {
  const [tickers, setTickers] = useState(['SPY', 'QQQ', 'NVDA']);
  const [tickerInputs, setTickerInputs] = useState(['', '', '']);
  const [selectedTicker, setSelectedTicker] = useState('QQQ'); // for expanded monthly
  const [heatmapData, setHeatmapData] = useState({});
  const [quotes, setQuotes] = useState({});
  const [goldenSweeps, setGoldenSweeps] = useState([]);
  const [smartMoneyScores, setSmartMoneyScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const calculateScore = (rows) => {
    if (!rows || rows.length === 0) return 0;
    const avg = rows.reduce((s, r) => s + r.scoreContribution, 0) / rows.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const newQuotes = {};
    const newHeatmap = {};
    const newScores = {};

    // Fetch real prices one at a time with delay to avoid 429
    for (const ticker of tickers) {
      const quote = await fetchQuote(ticker);
      if (quote) newQuotes[ticker] = quote;
      await sleep(400);
    }

    // Generate mock daily heatmap rows using real base prices
    for (const ticker of tickers) {
      const basePrice = newQuotes[ticker]?.price || DEFAULT_TICKERS[ticker]?.basePrice || 100;
      const rows = generateDailyRows(basePrice);
      newHeatmap[ticker] = rows;
      newScores[ticker] = calculateScore(rows);
    }

    // Generate broader market sweeps
    const sweeps = generateMarketSweeps();

    setQuotes(newQuotes);
    setHeatmapData(newHeatmap);
    setSmartMoneyScores(newScores);
    setGoldenSweeps(sweeps);
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, [tickers]);

  useEffect(() => {
    fetchAllData();
    intervalRef.current = setInterval(fetchAllData, 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAllData]);

  const handleTickerChange = (index, value) => {
    const v = value.toUpperCase();
    const newInputs = [...tickerInputs];
    newInputs[index] = v;
    setTickerInputs(newInputs);
  };

  const handleTickerSubmit = (index, e) => {
    if (e.key === 'Enter' && tickerInputs[index].length > 0) {
      const newTickers = [...tickers];
      newTickers[index] = tickerInputs[index];
      setTickers(newTickers);
      const newInputs = [...tickerInputs];
      newInputs[index] = '';
      setTickerInputs(newInputs);
      if (selectedTicker === tickers[index]) setSelectedTicker(tickerInputs[index]);
    }
  };

  const renderHeatmap = (ticker, index) => {
    const rows = heatmapData[ticker] || [];
    const quote = quotes[ticker];
    const price = quote?.price;
    const priceChange = quote?.priceChange;
    const maxPremium = rows.length > 0 ? Math.max(...rows.map(r => r.premium)) : 1;
    const isSelected = selectedTicker === ticker;

    return (
      <div
        style={{ ...styles.heatmapBox, border: isSelected ? '2px solid #f9a825' : '1px solid #e8eaf0' }}
        onClick={() => setSelectedTicker(ticker)}
      >
        {/* Ticker search input */}
        <div style={styles.tickerSearchRow}>
          <input
            type="text"
            placeholder={ticker}
            value={tickerInputs[index]}
            onChange={(e) => handleTickerChange(index, e.target.value)}
            onKeyDown={(e) => handleTickerSubmit(index, e)}
            style={styles.tickerInput}
          />
        </div>

        <div style={styles.heatmapHeader}>
          <span style={styles.heatmapTicker}>{ticker}</span>
          <span style={styles.heatmapPrice}>
            {price ? `$${Number(price).toFixed(2)}` : '—'}
            {priceChange !== undefined && (
              <span style={{ color: priceChange >= 0 ? '#00897b' : '#e53935', marginLeft: 4 }}>
                {priceChange >= 0 ? '+' : ''}{Number(priceChange).toFixed(2)}%
              </span>
            )}
          </span>
        </div>

        {/* Column headers */}
        <div style={styles.colHeaderRow}>
          <div style={styles.strikeLabelHeader}>STRIKE</div>
          <div style={styles.barHeader}>NET PREMIUM FLOW</div>
          <div style={styles.netPremHeader}>NET PREM</div>
        </div>

        {/* Rows */}
        <div style={styles.rowsContainer}>
          {rows.map((row) => {
            const bg = getPremiumColor(row.premium, row.isBullish);
            const tc = getTextColor(row.premium);
            const barPct = Math.round((row.premium / maxPremium) * 100);
            const barColor = row.isBullish ? '#00897b' : '#8e24aa';

            return (
              <div key={row.strike} style={styles.heatmapRow}>
                <div style={styles.strikeLabel}>{row.strike}</div>
                <div style={{ ...styles.flowBar, backgroundColor: bg, position: 'relative', overflow: 'hidden' }}>
                  {row.isGoldenSweep && <span style={styles.starIcon}>⭐</span>}
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barPct}%`, backgroundColor: barColor, opacity: 0.15 }} />
                  <span style={{ ...styles.flowText, color: tc }}>{formatPremium(row.premium)}</span>
                </div>
                <div style={{ ...styles.netPremCell, color: row.isBullish ? '#00897b' : '#e53935' }}>
                  {row.isBullish ? '+' : ''}{formatPremium(row.netPremium)}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div style={styles.noData}>{loading ? 'Loading…' : 'No data'}</div>
          )}
        </div>
      </div>
    );
  };

  const renderExpandedHeatmap = () => {
    const rows = heatmapData[selectedTicker] || [];
    const quote = quotes[selectedTicker];
    const price = quote?.price;
    const priceChange = quote?.priceChange;
    const maxPremium = rows.length > 0 ? Math.max(...rows.map(r => r.premium)) : 1;

    return (
      <div style={styles.heatmapBox}>
        <div style={styles.heatmapHeader}>
          <span style={styles.heatmapTicker}>{selectedTicker} — Daily Flow</span>
          <span style={styles.heatmapPrice}>
            {price ? `$${Number(price).toFixed(2)}` : '—'}
            {priceChange !== undefined && (
              <span style={{ color: priceChange >= 0 ? '#00897b' : '#e53935', marginLeft: 4 }}>
                {priceChange >= 0 ? '+' : ''}{Number(priceChange).toFixed(2)}%
              </span>
            )}
          </span>
        </div>
        <div style={styles.colHeaderRow}>
          <div style={styles.strikeLabelHeader}>STRIKE</div>
          <div style={styles.barHeader}>NET PREMIUM FLOW</div>
          <div style={styles.netPremHeader}>NET PREM</div>
        </div>
        <div style={styles.rowsContainer}>
          {rows.map((row) => {
            const bg = getPremiumColor(row.premium, row.isBullish);
            const tc = getTextColor(row.premium);
            const barPct = Math.round((row.premium / maxPremium) * 100);
            const barColor = row.isBullish ? '#00897b' : '#8e24aa';
            return (
              <div key={row.strike} style={styles.heatmapRow}>
                <div style={styles.strikeLabel}>{row.strike}</div>
                <div style={{ ...styles.flowBar, backgroundColor: bg, position: 'relative', overflow: 'hidden' }}>
                  {row.isGoldenSweep && <span style={styles.starIcon}>⭐</span>}
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barPct}%`, backgroundColor: barColor, opacity: 0.15 }} />
                  <span style={{ ...styles.flowText, color: tc }}>{formatPremium(row.premium)}</span>
                </div>
                <div style={{ ...styles.netPremCell, color: row.isBullish ? '#00897b' : '#e53935' }}>
                  {row.isBullish ? '+' : ''}{formatPremium(row.netPremium)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const score = (k) => smartMoneyScores[k] || 0;

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>
        <span style={styles.logo}>⚡ SmartMoney Flow</span>
        <span style={styles.topBarSub}>
          Real Prices · Mock Flow · {loading ? '🔄 Fetching…' : `Updated ${lastUpdated}`}
        </span>
        <button onClick={fetchAllData} style={styles.refreshBtn} disabled={loading}>
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      <div style={styles.main}>
        {/* LEFT: 3 searchable heatmaps */}
        <div style={styles.leftPanel}>
          {tickers.map((ticker, i) => (
            <div key={ticker} style={styles.heatmapCol}>
              {renderHeatmap(ticker, i)}
            </div>
          ))}
        </div>

        {/* RIGHT: 2x2 grid */}
        <div style={styles.rightPanel}>

          {/* TOP LEFT: Expanded flow for selected ticker */}
          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>
              📅 Daily Flow — click a ticker to switch
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {renderExpandedHeatmap()}
            </div>
          </div>

          {/* TOP RIGHT: Scorecard */}
          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>📊 Real-Time Flow Scorecard</div>
            <div style={styles.scoreRow}>
              {tickers.map(k => (
                <div key={k} style={styles.scoreCard}>
                  <div style={styles.scoreTicker}>{k}</div>
                  <div style={{ ...styles.scoreNum, color: score(k) >= 70 ? '#00897b' : score(k) >= 50 ? '#f9a825' : '#e53935' }}>
                    {score(k)}
                  </div>
                  <div style={styles.scoreGrade}>{getGrade(score(k))}</div>
                </div>
              ))}
            </div>
            <div style={styles.alertsBox}>
              <div style={styles.alertTitle}>Flow Alerts</div>
              {[
                { label: 'Market Sweeps', val: goldenSweeps.length },
                { label: 'A+ Grade Sweeps', val: goldenSweeps.filter(g => g.grade === 'A+').length },
                { label: 'A-Grade Activity', val: goldenSweeps.filter(g => g.grade === 'A').length },
              ].map(({ label, val }) => (
                <div key={label} style={styles.alertRow}>
                  <span style={styles.alertLabel}>{label}</span>
                  <span style={styles.alertVal}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM LEFT: SPX Live Chart */}
          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>📈 SPX Live Chart</div>
            <div style={styles.chartPlaceholder}>
              <div style={styles.chartText}>SPX Candlestick Chart</div>
              <div style={styles.chartSub}>Connect TradingView widget for live candles</div>
            </div>
          </div>

          {/* BOTTOM RIGHT: Golden Sweeps — entire market */}
          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>🔥 Golden Sweeps — Entire Market</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {goldenSweeps.length === 0 ? (
                <div style={styles.noSweeps}>{loading ? 'Scanning market…' : 'No sweeps detected'}</div>
              ) : (
                goldenSweeps.slice(0, 12).map((sweep, idx) => (
                  <div key={idx} style={styles.sweepRow}>
                    <div style={{ ...styles.sweepBar, backgroundColor: sweep.isBullish ? '#00897b' : '#8e24aa' }} />
                    <div style={styles.sweepInfo}>
                      <span style={styles.sweepTicker}>{sweep.ticker}</span>
                      <span style={styles.sweepDetail}>{sweep.strike} {sweep.type} · {sweep.expiration}</span>
                    </div>
                    <div style={styles.sweepRight}>
                      <span style={styles.sweepPrem}>{formatPremium(sweep.premium)}</span>
                      <span style={{ ...styles.sweepGrade, backgroundColor: sweep.grade === 'A+' ? '#f9a825' : sweep.grade === 'A' ? '#00897b' : '#90a4ae' }}>
                        {sweep.grade}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const styles = {
  root: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", backgroundColor: '#f0f2f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  logo: { fontSize: 18, fontWeight: 700, color: '#1a237e', letterSpacing: '-0.5px' },
  topBarSub: { fontSize: 12, color: '#90a4ae', flex: 1 },
  refreshBtn: { padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e0e0e0', backgroundColor: '#fff', fontSize: 12, fontWeight: 700, color: '#1a237e', cursor: 'pointer' },
  main: { display: 'flex', flex: 1, gap: 10, padding: 10, overflow: 'hidden', height: 'calc(100vh - 48px)' },
  leftPanel: { display: 'flex', gap: 8, width: '38%', minWidth: 0 },
  heatmapCol: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' },
  heatmapBox: { backgroundColor: '#1a0533', borderRadius: 10, overflow: 'hidden', flex: 1, cursor: 'pointer' },
  tickerSearchRow: { padding: '6px 8px', backgroundColor: '#0f0220', borderBottom: '1px solid #2d1b69' },
  tickerInput: { width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid #2d1b69', backgroundColor: '#1a0533', color: '#ffffff', fontSize: 11, fontWeight: 600, outline: 'none', boxSizing: 'border-box', letterSpacing: '0.5px' },
  heatmapHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#0f0220' },
  heatmapTicker: { fontWeight: 700, fontSize: 13, color: '#ffffff', letterSpacing: '0.5px' },
  heatmapPrice: { fontSize: 11, fontWeight: 600, color: '#cccccc' },
  colHeaderRow: { display: 'flex', alignItems: 'center', padding: '3px 8px', backgroundColor: '#0f0220', borderBottom: '1px solid #2d1b69' },
  strikeLabelHeader: { width: 48, fontSize: 8, fontWeight: 700, color: '#666', flexShrink: 0 },
  barHeader: { flex: 1, fontSize: 8, color: '#666', fontWeight: 600, paddingLeft: 4 },
  netPremHeader: { width: 64, fontSize: 8, color: '#666', fontWeight: 600, textAlign: 'right', flexShrink: 0 },
  rowsContainer: { padding: '4px 8px 8px' },
  heatmapRow: { display: 'flex', alignItems: 'center', marginBottom: 2, height: 24 },
  strikeLabel: { width: 44, fontSize: 10, fontWeight: 700, color: '#aaaaaa', flexShrink: 0, textAlign: 'right', paddingRight: 6 },
  flowBar: { flex: 1, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 6, marginRight: 4 },
  starIcon: { fontSize: 10, marginRight: 4, zIndex: 1 },
  flowText: { fontSize: 9, fontWeight: 700, letterSpacing: '0.2px', zIndex: 1, position: 'relative' },
  netPremCell: { width: 64, fontSize: 9, fontWeight: 700, textAlign: 'right', flexShrink: 0 },
  noData: { textAlign: 'center', color: '#555', fontSize: 12, padding: 16 },
  rightPanel: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8, minWidth: 0 },
  rightCell: { backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e8eaf0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  cellTitle: { fontSize: 11, fontWeight: 700, color: '#37474f', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 },
  scoreRow: { display: 'flex', gap: 10, marginBottom: 14 },
  scoreCard: { flex: 1, backgroundColor: '#f8f9fc', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid #eeeeee' },
  scoreTicker: { fontSize: 11, fontWeight: 700, color: '#78909c', letterSpacing: '1px', marginBottom: 4 },
  scoreNum: { fontSize: 28, fontWeight: 800, lineHeight: 1, marginBottom: 4 },
  scoreGrade: { fontSize: 11, fontWeight: 700, color: '#90a4ae' },
  alertsBox: { backgroundColor: '#f8f9fc', borderRadius: 8, padding: '8px 12px', border: '1px solid #eeeeee' },
  alertTitle: { fontSize: 10, fontWeight: 700, color: '#90a4ae', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 },
  alertRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eeeeee' },
  alertLabel: { fontSize: 12, color: '#546e7a', fontWeight: 500 },
  alertVal: { fontSize: 13, fontWeight: 800, color: '#1a237e' },
  chartPlaceholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fc', borderRadius: 8, border: '2px dashed #e0e0e0' },
  chartText: { fontSize: 14, fontWeight: 700, color: '#90a4ae', marginBottom: 6 },
  chartSub: { fontSize: 11, color: '#b0bec5', textAlign: 'center', padding: '0 20px' },
  noSweeps: { textAlign: 'center', color: '#b0bec5', fontSize: 13, padding: 20 },
  sweepRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f5f5' },
  sweepBar: { width: 4, height: 32, borderRadius: 4, flexShrink: 0 },
  sweepInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  sweepTicker: { fontSize: 12, fontWeight: 800, color: '#1a237e' },
  sweepDetail: { fontSize: 11, color: '#78909c' },
  sweepRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 },
  sweepPrem: { fontSize: 12, fontWeight: 700, color: '#37474f' },
  sweepGrade: { fontSize: 10, fontWeight: 800, color: '#ffffff', padding: '1px 6px', borderRadius: 4 },
};

export default SmartMoneyDashboard;
