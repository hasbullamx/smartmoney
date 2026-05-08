import React, { useState, useEffect, useCallback, useRef } from 'react';

const POLYGON_API_KEY = process.env.REACT_APP_POLYGON_API_KEY;

const TICKERS = {
  SPX: { symbol: 'I:SPX', optionPrefix: 'SPXW', basePrice: 5930 },
  SPY: { symbol: 'SPY', optionPrefix: 'SPY', basePrice: 585 },
  QQQ: { symbol: 'QQQ', optionPrefix: 'QQQ', basePrice: 425 },
  NVDA: { symbol: 'NVDA', optionPrefix: 'NVDA', basePrice: 135 },
  AAPL: { symbol: 'AAPL', optionPrefix: 'AAPL', basePrice: 234 },
  TSLA: { symbol: 'TSLA', optionPrefix: 'TSLA', basePrice: 310 },
};

const getPremiumColor = (premium, isBullish) => {
  const val = Math.min(Math.abs(premium), 2000000);
  const t = val / 2000000;
  if (isBullish) {
    if (t < 0.2) return '#e8f5e9';
    if (t < 0.4) return '#80cbc4';
    if (t < 0.6) return '#26a69a';
    if (t < 0.8) return '#00838f';
    return '#006064';
  } else {
    if (t < 0.2) return '#f3e5f5';
    if (t < 0.4) return '#ce93d8';
    if (t < 0.6) return '#ab47bc';
    if (t < 0.8) return '#7b1fa2';
    return '#4a148c';
  }
};

const getTextColor = (premium) => {
  const val = Math.min(Math.abs(premium), 2000000);
  const t = val / 2000000;
  return t > 0.4 ? '#ffffff' : '#1a1a2e';
};

const formatPremium = (p) => {
  if (!p) return '$0';
  if (p >= 1000000) return `$${(p / 1000000).toFixed(1)}M`;
  if (p >= 1000) return `$${(p / 1000).toFixed(0)}K`;
  return `$${p.toFixed(0)}`;
};

const getGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  return 'C';
};

// Get today and future expiration dates
const getExpirationDates = () => {
  const today = new Date();
  const dates = [];
  for (let i = 0; i <= 45; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  return dates;
};

const getDTE = (expirationDate) => {
  const today = new Date();
  const exp = new Date(expirationDate);
  const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
  return diff;
};

const dteBucket = (dte) => {
  if (dte <= 0) return '0DTE';
  if (dte <= 2) return '2DTE';
  if (dte <= 4) return '4DTE';
  if (dte <= 7) return '7DTE';
  if (dte <= 14) return '14DTE';
  if (dte <= 21) return '21DTE';
  if (dte <= 30) return '30DTE';
  return '45DTE';
};

const QUICK_BUCKETS = ['0DTE', '2DTE', '4DTE', '7DTE'];
const MONTHLY_BUCKETS = ['14DTE', '21DTE', '30DTE', '45DTE'];

// Fetch snapshot for a ticker's options chain
const fetchOptionsChain = async (ticker) => {
  try {
    const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${POLYGON_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results) return data.results;
    return [];
  } catch (e) {
    console.error('Polygon fetch error:', e);
    return [];
  }
};

// Fetch stock quote
const fetchQuote = async (ticker) => {
  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ticker) {
      return {
        price: data.ticker.day?.c || data.ticker.prevDay?.c || 0,
        priceChange: data.ticker.todaysChangePerc || 0,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Transform raw polygon options data into heatmap rows
const buildHeatmapRows = (optionsData, basePrice, buckets) => {
  if (!optionsData || optionsData.length === 0) return [];

  // Group by strike
  const strikeMap = {};

  optionsData.forEach((opt) => {
    const details = opt.details || {};
    const greeks = opt.greeks || {};
    const day = opt.day || {};
    const strike = details.strike_price;
    const expDate = details.expiration_date;
    if (!strike || !expDate) return;

    const dte = getDTE(expDate);
    const bucket = dteBucket(dte);
    if (!buckets.includes(bucket)) return;

    if (!strikeMap[strike]) strikeMap[strike] = {};
    if (!strikeMap[strike][bucket]) {
      strikeMap[strike][bucket] = {
        totalPremium: 0, bullishPremium: 0, bearishPremium: 0,
        volume: 0, openInterest: 0, isGoldenSweep: false,
        isBullish: true, scoreContribution: 50, callOrPut: 'call',
      };
    }

    const cell = strikeMap[strike][bucket];
    const contractType = details.contract_type || 'call';
    const volume = day.volume || 0;
    const oi = opt.open_interest || 0;
    const lastPrice = day.last_price || opt.last_quote?.ask || 0;
    const premium = lastPrice * volume * 100;
    const isAskSide = (opt.last_quote?.ask || 0) >= (opt.last_quote?.bid || 0);
    const isBullish = (contractType === 'call' && isAskSide) || (contractType === 'put' && !isAskSide);
    const isSweep = volume > oi * 0.5 && volume > 500;
    const isGoldenSweep = premium > 500000 && Math.abs(strike - basePrice) / basePrice > 0.005 && dte <= 7 && isSweep && isAskSide;

    let score = 50;
    score += isBullish ? 10 : -10;
    score += (volume / (oi || 1)) > 3 ? 15 : 0;
    score += premium > 500000 ? 15 : premium > 100000 ? 5 : 0;
    score += isSweep ? 10 : 0;
    score += isGoldenSweep ? 25 : 0;

    cell.totalPremium += premium;
    if (isBullish) cell.bullishPremium += premium;
    else cell.bearishPremium += premium;
    cell.volume += volume;
    cell.openInterest += oi;
    if (isGoldenSweep) cell.isGoldenSweep = true;
    cell.scoreContribution = Math.max(cell.scoreContribution, score);
    cell.isBullish = cell.bullishPremium >= cell.bearishPremium;
    cell.callOrPut = contractType;
  });

  // Build sorted rows around base price
  const baseStrike = Math.floor(basePrice / 5) * 5;
  const rows = [];

  for (let i = 10; i >= -10; i--) {
    const strike = baseStrike + i * 5;
    const cells = buckets.map((bucket) => {
      const raw = strikeMap[strike]?.[bucket];
      if (!raw) return {
        strike, expiration: bucket, premium: 0, isBullish: true,
        isGoldenSweep: false, scoreContribution: 50, volume: 0, openInterest: 0,
      };
      return { strike, expiration: bucket, ...raw };
    });

    const totalPremium = cells.reduce((s, c) => s + c.totalPremium, 0);
    const bullishTotal = cells.reduce((s, c) => s + (c.bullishPremium || 0), 0);
    rows.push({ strike, cells, totalPremium, isBullish: bullishTotal >= totalPremium / 2 });
  }

  return rows;
};

const SmartMoneyDashboard = () => {
  const [customTicker, setCustomTicker] = useState('QQQ');
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [heatmapDataAll, setHeatmapDataAll] = useState({});
  const [expandedMonthlyData, setExpandedMonthlyData] = useState([]);
  const [smartMoneyScoreAll, setSmartMoneyScoreAll] = useState({});
  const [goldenSweepsAll, setGoldenSweepsAll] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const calculateSmartMoneyScore = useCallback((rows) => {
    if (!rows || rows.length === 0) return 0;
    const all = rows.flatMap(r => r.cells);
    if (all.length === 0) return 0;
    const avg = all.reduce((s, d) => s + (d.scoreContribution || 50), 0) / all.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const allData = {};
    const allScores = {};
    const allGoldenSweeps = [];
    const newQuotes = {};

    const tickers = ['SPX', 'SPY', customTicker];

    await Promise.all(tickers.map(async (name) => {
      const tickerInfo = TICKERS[name];
      if (!tickerInfo) return;

      // Fetch quote (skip SPX as it's an index)
      if (name !== 'SPX') {
        const quote = await fetchQuote(tickerInfo.symbol);
        if (quote) newQuotes[name] = quote;
      }

      // Fetch options chain
      const optionsData = await fetchOptionsChain(tickerInfo.symbol === 'I:SPX' ? 'SPX' : tickerInfo.symbol);
      const basePrice = newQuotes[name]?.price || tickerInfo.basePrice;

      const quickRows = buildHeatmapRows(optionsData, basePrice, QUICK_BUCKETS);
      const monthlyRows = buildHeatmapRows(optionsData, basePrice, MONTHLY_BUCKETS);

      allData[name] = quickRows;
      allScores[name] = calculateSmartMoneyScore(quickRows);

      if (name === customTicker) {
        setExpandedMonthlyData(monthlyRows);
      }

      // Collect golden sweeps
      [...quickRows, ...monthlyRows].forEach(row => {
        row.cells.forEach(cell => {
          if (cell.isGoldenSweep) {
            allGoldenSweeps.push({
              ticker: name,
              strike: cell.strike,
              type: (cell.callOrPut || 'call').toUpperCase(),
              expiration: cell.expiration,
              premium: cell.totalPremium,
              score: cell.scoreContribution,
              grade: getGrade(cell.scoreContribution),
              isBullish: cell.isBullish,
            });
          }
        });
      });
    }));

    allGoldenSweeps.sort((a, b) => b.premium - a.premium);

    setHeatmapDataAll(allData);
    setSmartMoneyScoreAll(allScores);
    setGoldenSweepsAll(allGoldenSweeps.slice(0, 15));
    setQuotes(newQuotes);
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, [customTicker, calculateSmartMoneyScore]);

  useEffect(() => {
    fetchAllData();
    intervalRef.current = setInterval(fetchAllData, 30000); // refresh every 30s
    return () => clearInterval(intervalRef.current);
  }, [fetchAllData]);

  const handleTickerSearch = (e) => {
    const value = e.target.value.toUpperCase();
    setCustomTickerInput(value);
    if (value && TICKERS[value]) {
      setCustomTicker(value);
      setCustomTickerInput('');
    }
  };

  const getPrice = (ticker) => {
    if (quotes[ticker]) return quotes[ticker].price;
    return TICKERS[ticker]?.basePrice || 0;
  };

  const getPriceChange = (ticker) => {
    if (quotes[ticker]) return quotes[ticker].priceChange;
    return 0;
  };

  const score = (k) => smartMoneyScoreAll[k] || 0;

  const renderHeatmap = (ticker, rows, buckets) => {
    const price = getPrice(ticker);
    const priceChange = getPriceChange(ticker);
    const maxPremium = rows.length > 0 ? Math.max(...rows.map(r => r.totalPremium), 1) : 1;

    return (
      <div style={styles.heatmapBox}>
        <div style={styles.heatmapHeader}>
          <span style={styles.heatmapTicker}>{ticker}</span>
          <span style={styles.heatmapPrice}>
            {price ? `$${Number(price).toFixed(2)}` : '—'}
            {priceChange !== 0 && (
              <span style={{ color: priceChange >= 0 ? '#00897b' : '#e53935', marginLeft: 4 }}>
                {priceChange >= 0 ? '+' : ''}{Number(priceChange).toFixed(2)}%
              </span>
            )}
          </span>
        </div>

        <div style={styles.heatmapTableWrap}>
          <div style={styles.expRow}>
            <div style={styles.strikeLabel}></div>
            {buckets.map(e => (
              <div key={e} style={styles.expLabel}>{e}</div>
            ))}
            <div style={styles.premiumLabel}>NET PREM</div>
          </div>

          {rows.map((row) => {
            const barWidth = maxPremium > 0 ? Math.round((row.totalPremium / maxPremium) * 100) : 0;
            const netColor = row.isBullish ? '#00897b' : '#8e24aa';
            return (
              <div key={row.strike} style={styles.heatmapRow}>
                <div style={styles.strikeLabel}>{row.strike}</div>
                {row.cells.map((cell, idx) => {
                  const bg = getPremiumColor(cell.totalPremium || cell.premium || 0, cell.isBullish);
                  const tc = getTextColor(cell.totalPremium || cell.premium || 0);
                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.cell,
                        backgroundColor: bg,
                        color: tc,
                        border: cell.isGoldenSweep ? '2px solid #f9a825' : '1px solid rgba(0,0,0,0.06)',
                      }}
                      title={`${cell.strike} ${cell.expiration} | ${formatPremium(cell.totalPremium || 0)} | Vol: ${cell.volume || 0}`}
                    >
                      {cell.isGoldenSweep ? '⭐' : formatPremium(cell.totalPremium || cell.premium || 0)}
                    </div>
                  );
                })}
                <div style={styles.premiumBar}>
                  <div style={{ ...styles.barFill, width: `${barWidth}%`, backgroundColor: netColor }} />
                  <span style={{ ...styles.barText, color: netColor }}>{formatPremium(row.totalPremium)}</span>
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div style={styles.noData}>
              {loading ? 'Loading real data…' : 'No options data available'}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>
        <span style={styles.logo}>⚡ SmartMoney Flow</span>
        <span style={styles.topBarSub}>
          Options Flow Dashboard · {loading ? '🔄 Fetching data…' : `✅ Live · Updated ${lastUpdated}`}
        </span>
        <button onClick={fetchAllData} style={styles.refreshBtn}>↻ Refresh</button>
      </div>

      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <div style={styles.heatmapCol}>{renderHeatmap('SPX', heatmapDataAll['SPX'] || [], QUICK_BUCKETS)}</div>
          <div style={styles.heatmapCol}>{renderHeatmap('SPY', heatmapDataAll['SPY'] || [], QUICK_BUCKETS)}</div>
          <div style={styles.heatmapCol}>
            <div style={styles.searchWrap}>
              <input
                type="text"
                placeholder="Search ticker… (QQQ, NVDA, AAPL, TSLA)"
                value={customTickerInput}
                onChange={handleTickerSearch}
                style={styles.searchInput}
              />
            </div>
            {renderHeatmap(customTicker, heatmapDataAll[customTicker] || [], QUICK_BUCKETS)}
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>📅 Expanded Monthly Heatmap — {customTicker}</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {renderHeatmap(`${customTicker}`, expandedMonthlyData, MONTHLY_BUCKETS)}
            </div>
          </div>

          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>📊 Real-Time Flow Scorecard</div>
            <div style={styles.scoreRow}>
              {['SPX', 'SPY', customTicker].map(k => (
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
                { label: 'Sweep Activity', val: goldenSweepsAll.length },
                { label: 'Golden Sweeps (A+)', val: goldenSweepsAll.filter(g => g.grade === 'A+').length },
                { label: 'A-Grade Activity', val: goldenSweepsAll.filter(g => g.grade === 'A').length },
              ].map(({ label, val }) => (
                <div key={label} style={styles.alertRow}>
                  <span style={styles.alertLabel}>{label}</span>
                  <span style={styles.alertVal}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>📈 SPX Live Chart</div>
            <div style={styles.chartPlaceholder}>
              <div style={styles.chartText}>SPX Candlestick Chart</div>
              <div style={styles.chartSub}>Connect TradingView widget or Polygon WebSocket for live candles</div>
            </div>
          </div>

          <div style={styles.rightCell}>
            <div style={styles.cellTitle}>🔥 Golden Sweeps Detected</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {goldenSweepsAll.length === 0 ? (
                <div style={styles.noSweeps}>{loading ? 'Scanning for sweeps…' : 'No golden sweeps detected yet'}</div>
              ) : (
                goldenSweepsAll.slice(0, 10).map((sweep, idx) => (
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
  topBarSub: { fontSize: 12, color: '#90a4ae', letterSpacing: '0.5px', flex: 1 },
  refreshBtn: { padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e0e0e0', backgroundColor: '#fff', fontSize: 12, fontWeight: 700, color: '#1a237e', cursor: 'pointer' },
  main: { display: 'flex', flex: 1, gap: 10, padding: 10, overflow: 'hidden', height: 'calc(100vh - 48px)' },
  leftPanel: { display: 'flex', gap: 8, width: '42%', minWidth: 0 },
  heatmapCol: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' },
  heatmapBox: { backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e8eaf0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flex: 1 },
  heatmapHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fafbfc' },
  heatmapTicker: { fontWeight: 700, fontSize: 14, color: '#1a237e', letterSpacing: '0.5px' },
  heatmapPrice: { fontSize: 12, fontWeight: 600, color: '#424242' },
  heatmapTableWrap: { padding: '4px 8px 8px' },
  expRow: { display: 'flex', alignItems: 'center', marginBottom: 2 },
  strikeLabel: { width: 46, fontSize: 10, fontWeight: 700, color: '#78909c', flexShrink: 0, textAlign: 'right', paddingRight: 6 },
  expLabel: { flex: 1, fontSize: 9, color: '#90a4ae', fontWeight: 600, textAlign: 'center', letterSpacing: '0.3px' },
  premiumLabel: { width: 72, fontSize: 9, color: '#90a4ae', fontWeight: 600, textAlign: 'right', paddingRight: 4, flexShrink: 0 },
  heatmapRow: { display: 'flex', alignItems: 'center', marginBottom: 2 },
  cell: { flex: 1, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s', marginRight: 2, letterSpacing: '0.2px', overflow: 'hidden' },
  premiumBar: { width: 72, height: 22, flexShrink: 0, backgroundColor: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', border: '1px solid #eeeeee' },
  barFill: { height: '100%', borderRadius: 4, opacity: 0.25, position: 'absolute', left: 0, top: 0 },
  barText: { fontSize: 9, fontWeight: 700, position: 'absolute', right: 4, letterSpacing: '0.2px' },
  searchWrap: { marginBottom: 6 },
  searchInput: { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1.5px solid #e0e0e0', fontSize: 12, backgroundColor: '#ffffff', color: '#1a237e', fontWeight: 600, outline: 'none', boxSizing: 'border-box' },
  rightPanel: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8, minWidth: 0 },
  rightCell: { backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e8eaf0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  cellTitle: { fontSize: 11, fontWeight: 700, color: '#37474f', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 },
  scoreRow: { display: 'flex', gap: 10, marginBottom: 14 },
  scoreCard: { flex: 1, backgroundColor: '#f8f9fc', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid #eeeeee' },
  scoreTicker: { fontSize: 11, fontWeight: 700, color: '#78909c', letterSpacing: '1px', marginBottom: 4 },
  scoreNum: { fontSize: 28, fontWeight: 800, lineHeight: 1, marginBottom: 4 },
  scoreGrade: { fontSize: 11, fontWeight: 700, color: '#90a4ae', letterSpacing: '0.5px' },
  alertsBox: { backgroundColor: '#f8f9fc', borderRadius: 8, padding: '8px 12px', border: '1px solid #eeeeee' },
  alertTitle: { fontSize: 10, fontWeight: 700, color: '#90a4ae', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 },
  alertRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eeeeee' },
  alertLabel: { fontSize: 12, color: '#546e7a', fontWeight: 500 },
  alertVal: { fontSize: 13, fontWeight: 800, color: '#1a237e' },
  chartPlaceholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fc', borderRadius: 8, border: '2px dashed #e0e0e0' },
  chartText: { fontSize: 14, fontWeight: 700, color: '#90a4ae', marginBottom: 6 },
  chartSub: { fontSize: 11, color: '#b0bec5', textAlign: 'center', padding: '0 20px' },
  noSweeps: { textAlign: 'center', color: '#b0bec5', fontSize: 13, padding: 20 },
  noData: { textAlign: 'center', color: '#b0bec5', fontSize: 12, padding: 16 },
  sweepRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f5f5' },
  sweepBar: { width: 4, height: 32, borderRadius: 4, flexShrink: 0 },
  sweepInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  sweepTicker: { fontSize: 12, fontWeight: 800, color: '#1a237e' },
  sweepDetail: { fontSize: 11, color: '#78909c' },
  sweepRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 },
  sweepPrem: { fontSize: 12, fontWeight: 700, color: '#37474f' },
  sweepGrade: { fontSize: 10, fontWeight: 800, color: '#ffffff', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.5px' },
};

export default SmartMoneyDashboard;
