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

const EXPIRATIONS = ['0DTE','1DTE','2DTE','3DTE','4DTE','7DTE','14DTE','21DTE','30DTE','45DTE','60DTE','90DTE'];
const MARKET_TICKERS = ['SPY','QQQ','AAPL','NVDA','TSLA','AMZN','MSFT','META','AMD','GOOGL','NFLX','COIN','MSTR','PLTR','ARM','UBER','SHOP','HOOD','SOFI','BABA'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const formatPremium = (p) => {
  if (!p && p !== 0) return '$0';
  const abs = Math.abs(p);
  const sign = p < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs/1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs/1000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const getGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  return 'C';
};

// GEX bar color based on value
const getGexColor = (gex, maxGex) => {
  const t = Math.abs(gex) / maxGex;
  if (gex > 0) {
    if (t < 0.2) return '#1a3a2a';
    if (t < 0.4) return '#00695c';
    if (t < 0.6) return '#00897b';
    if (t < 0.8) return '#00bcd4';
    return '#f9a825';
  } else {
    if (t < 0.2) return '#2a1a2a';
    if (t < 0.4) return '#6a1b9a';
    if (t < 0.6) return '#8e24aa';
    if (t < 0.8) return '#ab47bc';
    return '#f9a825';
  }
};

// Dealer exposure cell color
const getDexColor = (val) => {
  const abs = Math.abs(val);
  if (abs < 50000) return { bg: '#0d1117', color: '#444' };
  if (val > 0) {
    if (abs < 200000) return { bg: '#003d33', color: '#80cbc4' };
    if (abs < 500000) return { bg: '#00695c', color: '#ffffff' };
    if (abs < 1000000) return { bg: '#00897b', color: '#ffffff' };
    return { bg: '#f9a825', color: '#000000' };
  } else {
    if (abs < 200000) return { bg: '#1a0033', color: '#ce93d8' };
    if (abs < 500000) return { bg: '#4a148c', color: '#ffffff' };
    if (abs < 1000000) return { bg: '#6a1b9a', color: '#ffffff' };
    return { bg: '#f9a825', color: '#000000' };
  }
};

const fetchQuote = async (ticker) => {
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      return { price: r.c, priceChange: ((r.c - r.o) / r.o * 100) };
    }
    return null;
  } catch (e) { return null; }
};

// Generate GEX rows (single bar per strike)
const generateGexRows = (basePrice) => {
  const rows = [];
  const baseStrike = Math.floor(basePrice / 5) * 5;
  for (let i = 10; i >= -10; i--) {
    const strike = baseStrike + i * 5;
    const gex = (Math.random() - 0.45) * 2000000;
    const isGolden = Math.abs(gex) > 1200000 && Math.random() > 0.7;
    const score = Math.floor(Math.random() * 40) + 55;
    rows.push({ strike, gex, isGolden, score });
  }
  return rows;
};

// Generate dealer exposure matrix (strikes x expirations)
const generateDealerExposure = (basePrice) => {
  const rows = [];
  const baseStrike = Math.floor(basePrice / 5) * 5;
  for (let i = 10; i >= -10; i--) {
    const strike = baseStrike + i * 5;
    const cells = {};
    EXPIRATIONS.forEach(exp => {
      const val = (Math.random() - 0.45) * 1500000;
      cells[exp] = Math.abs(val) < 80000 ? 0 : val;
    });
    const rowTotal = Object.values(cells).reduce((s, v) => s + v, 0);
    rows.push({ strike, cells, rowTotal });
  }
  return rows;
};

// Generate live options flow
const generateOptionsFlow = () => {
  const flows = [];
  const now = new Date();
  const types = ['CALL', 'PUT'];
  const sentiments = ['ASK', 'BID', 'MID'];
  const conditions = ['SWEEP', 'BLOCK', 'SPLIT'];

  for (let i = 0; i < 50; i++) {
    const ticker = MARKET_TICKERS[Math.floor(Math.random() * MARKET_TICKERS.length)];
    const base = DEFAULT_TICKERS[ticker]?.basePrice || 100;
    const strike = Math.floor(base / 5) * 5 + (Math.floor(Math.random() * 10) - 5) * 5;
    const type = types[Math.floor(Math.random() * 2)];
    const sentiment = sentiments[Math.floor(Math.random() * 3)];
    const condition = conditions[Math.floor(Math.random() * 3)];
    const dte = Math.floor(Math.random() * 90);
    const price = (Math.random() * 5 + 0.1).toFixed(2);
    const spread = (Math.random() * 0.5).toFixed(2);
    const size = Math.floor(Math.random() * 900 + 100);
    const prem = (price * size * 100);
    const otm = ((Math.random() - 0.5) * 10).toFixed(1);
    const isSweet = prem > 300000 && condition === 'SWEEP';

    const t = new Date(now.getTime() - i * 12000);
    const timeStr = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = `${t.getMonth()+1}/${t.getDate()} ${timeStr}`;

    const expDate = new Date(now.getTime() + dte * 86400000);
    const expStr = `${(expDate.getMonth()+1).toString().padStart(2,'0')}/${expDate.getDate().toString().padStart(2,'0')}/${expDate.getFullYear().toString().slice(2)}`;

    flows.push({ ticker, strike, type, otm, expStr, dte, price, spread, size, sentiment, condition, prem, dateStr, isSweet, isBullish: (type === 'CALL' && sentiment === 'ASK') || (type === 'PUT' && sentiment === 'BID') });
  }
  return flows;
};

// Generate market sweeps
const generateMarketSweeps = () => {
  const sweeps = [];
  for (let i = 0; i < 15; i++) {
    const ticker = MARKET_TICKERS[Math.floor(Math.random() * MARKET_TICKERS.length)];
    const base = DEFAULT_TICKERS[ticker]?.basePrice || 100;
    const strike = Math.floor(base / 5) * 5 + (Math.floor(Math.random() * 10) - 5) * 5;
    const isBullish = Math.random() > 0.45;
    const score = Math.floor(Math.random() * 35) + 65;
    const exps = ['0DTE','2DTE','4DTE','7DTE','14DTE'];
    const prem = Math.random() * 1500000 + 400000;
    sweeps.push({ ticker, strike, type: isBullish ? 'CALL' : 'PUT', expiration: exps[Math.floor(Math.random() * exps.length)], premium: prem, score, grade: getGrade(score), isBullish });
  }
  return sweeps.sort((a, b) => b.premium - a.premium);
};

const SmartMoneyDashboard = () => {
  const [tickers, setTickers] = useState(['SPY', 'QQQ', 'NVDA']);
  const [tickerInputs, setTickerInputs] = useState(['', '', '']);
  const [selectedTicker, setSelectedTicker] = useState('QQQ');
  const [gexData, setGexData] = useState({});
  const [dealerExposure, setDealerExposure] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [optionsFlow, setOptionsFlow] = useState([]);
  const [goldenSweeps, setGoldenSweeps] = useState([]);
  const [smartMoneyScores, setSmartMoneyScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const newQuotes = {};
    const newGex = {};
    const newScores = {};

    for (const ticker of tickers) {
      const quote = await fetchQuote(ticker);
      if (quote) newQuotes[ticker] = quote;
      await sleep(400);
    }

    for (const ticker of tickers) {
      const basePrice = newQuotes[ticker]?.price || DEFAULT_TICKERS[ticker]?.basePrice || 100;
      const rows = generateGexRows(basePrice);
      newGex[ticker] = rows;
      newScores[ticker] = Math.floor(Math.random() * 30) + 60;
    }

    const selBase = newQuotes[selectedTicker]?.price || DEFAULT_TICKERS[selectedTicker]?.basePrice || 100;
    const exposure = generateDealerExposure(selBase);
    const flow = generateOptionsFlow();
    const sweeps = generateMarketSweeps();

    setQuotes(newQuotes);
    setGexData(newGex);
    setSmartMoneyScores(newScores);
    setDealerExposure(exposure);
    setOptionsFlow(flow);
    setGoldenSweeps(sweeps);
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, [tickers, selectedTicker]);

  useEffect(() => {
    fetchAllData();
    intervalRef.current = setInterval(fetchAllData, 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchAllData]);

  const handleTickerChange = (index, value) => {
    const newInputs = [...tickerInputs];
    newInputs[index] = value.toUpperCase();
    setTickerInputs(newInputs);
  };

  const handleTickerSubmit = (index, e) => {
    if (e.key === 'Enter' && tickerInputs[index].length > 0) {
      const newTickers = [...tickers];
      const old = newTickers[index];
      newTickers[index] = tickerInputs[index];
      setTickers(newTickers);
      if (selectedTicker === old) setSelectedTicker(tickerInputs[index]);
      const newInputs = [...tickerInputs];
      newInputs[index] = '';
      setTickerInputs(newInputs);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // Render GEX heatmap (left columns)
  const renderGex = (ticker, index) => {
    const rows = gexData[ticker] || [];
    const quote = quotes[ticker];
    const maxGex = rows.length > 0 ? Math.max(...rows.map(r => Math.abs(r.gex)), 1) : 1;
    const isSelected = selectedTicker === ticker;

    return (
      <div
        style={{ ...styles.gexBox, border: isSelected ? '2px solid #f9a825' : '1px solid #2d1b69' }}
        onClick={() => setSelectedTicker(ticker)}
      >
        {/* Search */}
        <div style={styles.tickerSearchRow}>
          <input
            type="text"
            placeholder={`${ticker} ↵`}
            value={tickerInputs[index]}
            onChange={e => handleTickerChange(index, e.target.value)}
            onKeyDown={e => handleTickerSubmit(index, e)}
            style={styles.tickerInput}
            onClick={e => e.stopPropagation()}
          />
        </div>

        {/* Header */}
        <div style={styles.gexHeader}>
          <span style={styles.gexTicker}>{ticker}</span>
          <span style={styles.gexDate}>{today}</span>
          <span style={styles.gexPrice}>
            {quote ? `$${quote.price.toFixed(2)}` : '—'}
            {quote && <span style={{ color: quote.priceChange >= 0 ? '#00e676' : '#ff5252', marginLeft: 4 }}>
              {quote.priceChange >= 0 ? '+' : ''}{quote.priceChange.toFixed(2)}%
            </span>}
          </span>
        </div>

        {/* Col labels */}
        <div style={styles.gexColRow}>
          <div style={{ width: 44, fontSize: 8, color: '#555', flexShrink: 0, textAlign: 'right', paddingRight: 4 }}>Strike</div>
          <div style={{ flex: 1, fontSize: 8, color: '#555', textAlign: 'center' }}>GEX</div>
          <div style={{ width: 60, fontSize: 8, color: '#555', textAlign: 'right', flexShrink: 0 }}>Value</div>
        </div>

        {/* Rows */}
        <div style={styles.gexRows}>
          {rows.map((row) => {
            const pct = Math.abs(row.gex) / maxGex;
            const color = getGexColor(row.gex, maxGex);
            const isPos = row.gex >= 0;
            return (
              <div key={row.strike} style={styles.gexRow}>
                <div style={styles.gexStrike}>{row.strike}</div>
                <div style={styles.gexBarWrap}>
                  {/* center line */}
                  <div style={styles.gexCenterLine} />
                  {isPos ? (
                    <div style={{ position: 'absolute', left: '50%', top: 2, bottom: 2, width: `${pct * 50}%`, backgroundColor: color, borderRadius: '0 3px 3px 0' }} />
                  ) : (
                    <div style={{ position: 'absolute', right: '50%', top: 2, bottom: 2, width: `${pct * 50}%`, backgroundColor: color, borderRadius: '3px 0 0 3px' }} />
                  )}
                  {row.isGolden && <span style={styles.gexStar}>⭐</span>}
                </div>
                <div style={{ width: 60, fontSize: 9, fontWeight: 700, textAlign: 'right', flexShrink: 0, color: isPos ? '#00e676' : '#ff5252' }}>
                  {formatPremium(row.gex)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timestamp */}
        <div style={styles.gexTimestamp}>{ticker} GEX · {today} {lastUpdated || ''}</div>
      </div>
    );
  };

  // Render dealer exposure matrix
  const renderDealerExposure = () => {
    const quote = quotes[selectedTicker];

    return (
      <div style={styles.dexBox}>
        <div style={styles.dexHeader}>
          <span style={styles.dexTitle}>⚡ {selectedTicker} — Dealer Exposure (Swing Mode)</span>
          <span style={styles.dexPrice}>
            {quote ? `$${quote.price.toFixed(2)}` : ''}
            {quote && <span style={{ color: quote.priceChange >= 0 ? '#00e676' : '#ff5252', marginLeft: 4 }}>
              {quote.priceChange >= 0 ? '+' : ''}{quote.priceChange.toFixed(2)}%
            </span>}
          </span>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={styles.dexTable}>
            <thead>
              <tr>
                <th style={styles.dexStrikeHead}>Strike</th>
                {EXPIRATIONS.map(exp => (
                  <th key={exp} style={styles.dexExpHead}>{exp}</th>
                ))}
                <th style={styles.dexTotalHead}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {dealerExposure.map(row => (
                <tr key={row.strike}>
                  <td style={styles.dexStrikeCell}>{row.strike}</td>
                  {EXPIRATIONS.map(exp => {
                    const val = row.cells[exp] || 0;
                    const { bg, color } = getDexColor(val);
                    return (
                      <td key={exp} style={{ ...styles.dexCell, backgroundColor: bg, color }}>
                        {val !== 0 ? formatPremium(val) : ''}
                      </td>
                    );
                  })}
                  <td style={{ ...styles.dexCell, color: row.rowTotal >= 0 ? '#00e676' : '#ff5252', fontWeight: 700, backgroundColor: '#0d1117' }}>
                    {formatPremium(row.rowTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render live options flow table + scorecards
  const renderRightPanel = () => {
    const score = (k) => smartMoneyScores[k] || 0;

    return (
      <div style={styles.rightPanel}>

        {/* Scorecards + Flow table */}
        <div style={styles.rightCell}>
          {/* Mini scorecards */}
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

          <div style={styles.flowTableTitle}>📊 Live Options Flow</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={styles.flowTable}>
              <thead>
                <tr>
                  {['TIME','SYM','STRIKE','C/P','EXP','DTE','PRICE','SIZE','SENT','COND','PREM'].map(h => (
                    <th key={h} style={styles.flowTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {optionsFlow.slice(0, 30).map((row, i) => (
                  <tr key={i} style={{ backgroundColor: row.isSweet ? 'rgba(249,168,37,0.08)' : i % 2 === 0 ? '#fafbfc' : '#ffffff' }}>
                    <td style={styles.flowTd}>{row.dateStr.split(' ')[1]}</td>
                    <td style={{ ...styles.flowTd, fontWeight: 800, color: '#1a237e' }}>{row.ticker}</td>
                    <td style={styles.flowTd}>{row.strike}</td>
                    <td style={{ ...styles.flowTd, color: row.type === 'CALL' ? '#00897b' : '#e53935', fontWeight: 700 }}>{row.type}</td>
                    <td style={styles.flowTd}>{row.expStr}</td>
                    <td style={styles.flowTd}>{row.dte}</td>
                    <td style={styles.flowTd}>${row.price}</td>
                    <td style={styles.flowTd}>{row.size}</td>
                    <td style={{ ...styles.flowTd, color: row.sentiment === 'ASK' ? '#00897b' : row.sentiment === 'BID' ? '#e53935' : '#78909c', fontWeight: 700 }}>{row.sentiment}</td>
                    <td style={{ ...styles.flowTd }}>
                      <span style={{ ...styles.condBadge, backgroundColor: row.condition === 'SWEEP' ? '#f9a825' : row.condition === 'BLOCK' ? '#1a237e' : '#546e7a' }}>
                        {row.condition}
                      </span>
                    </td>
                    <td style={{ ...styles.flowTd, fontWeight: 700, color: row.isBullish ? '#00897b' : '#e53935' }}>{formatPremium(row.prem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Golden Sweeps */}
        <div style={styles.rightCell}>
          <div style={styles.flowTableTitle}>🔥 Golden Sweeps — Institutional Flow</div>
          <div style={styles.sweepFilter}>
            <span style={styles.filterLabel}>Filter: </span>
            {['ALL','CALL','PUT','SWEEP','BLOCK'].map(f => (
              <span key={f} style={styles.filterChip}>{f}</span>
            ))}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {goldenSweeps.map((sweep, idx) => (
              <div key={idx} style={styles.sweepRow}>
                <div style={{ ...styles.sweepBar, backgroundColor: sweep.isBullish ? '#00897b' : '#8e24aa' }} />
                <div style={styles.sweepInfo}>
                  <div style={styles.sweepTop}>
                    <span style={styles.sweepTicker}>{sweep.ticker}</span>
                    <span style={{ ...styles.sweepType, color: sweep.isBullish ? '#00897b' : '#e53935' }}>{sweep.type}</span>
                    <span style={styles.sweepStrike}>${sweep.strike}</span>
                    <span style={styles.sweepExp}>{sweep.expiration}</span>
                  </div>
                  <div style={styles.sweepBot}>
                    <span style={styles.sweepCond}>SWEEP · INSTITUTIONAL</span>
                  </div>
                </div>
                <div style={styles.sweepRight}>
                  <span style={styles.sweepPrem}>{formatPremium(sweep.premium)}</span>
                  <span style={{ ...styles.sweepGrade, backgroundColor: sweep.grade === 'A+' ? '#f9a825' : sweep.grade === 'A' ? '#00897b' : '#546e7a' }}>
                    {sweep.grade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  };

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
        {/* LEFT: 3 GEX heatmaps */}
        <div style={styles.leftPanel}>
          {tickers.map((ticker, i) => (
            <div key={ticker} style={styles.gexCol}>
              {renderGex(ticker, i)}
            </div>
          ))}
        </div>

        {/* CENTER: Dealer Exposure matrix */}
        <div style={styles.centerPanel}>
          {renderDealerExposure()}
        </div>

        {/* RIGHT: Flow table + sweeps */}
        {renderRightPanel()}
      </div>
    </div>
  );
};

const styles = {
  root: { fontFamily: "'DM Sans','Segoe UI',sans-serif", backgroundColor: '#0d1117', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#ffffff' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', backgroundColor: '#0d1117', borderBottom: '1px solid #1e2a3a', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  logo: { fontSize: 16, fontWeight: 700, color: '#f9a825', letterSpacing: '-0.5px' },
  topBarSub: { fontSize: 11, color: '#555', flex: 1 },
  refreshBtn: { padding: '4px 10px', borderRadius: 5, border: '1px solid #333', backgroundColor: '#1a2030', fontSize: 11, fontWeight: 700, color: '#aaa', cursor: 'pointer' },
  main: { display: 'flex', flex: 1, gap: 6, padding: 6, overflow: 'hidden', height: 'calc(100vh - 44px)' },

  // LEFT GEX
  leftPanel: { display: 'flex', gap: 6, width: '30%', minWidth: 0 },
  gexCol: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  gexBox: { backgroundColor: '#0d1117', borderRadius: 8, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', cursor: 'pointer' },
  tickerSearchRow: { padding: '4px 6px', backgroundColor: '#080c12', borderBottom: '1px solid #1e2a3a' },
  tickerInput: { width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid #1e2a3a', backgroundColor: '#0d1117', color: '#ffffff', fontSize: 10, fontWeight: 600, outline: 'none', boxSizing: 'border-box' },
  gexHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', backgroundColor: '#080c12', flexWrap: 'wrap' },
  gexTicker: { fontWeight: 800, fontSize: 13, color: '#ffffff' },
  gexDate: { fontSize: 9, color: '#555', flex: 1 },
  gexPrice: { fontSize: 10, fontWeight: 600, color: '#cccccc' },
  gexColRow: { display: 'flex', padding: '2px 8px', borderBottom: '1px solid #1e2a3a' },
  gexRows: { flex: 1, overflowY: 'auto', padding: '2px 6px' },
  gexRow: { display: 'flex', alignItems: 'center', height: 22, marginBottom: 1 },
  gexStrike: { width: 44, fontSize: 10, fontWeight: 700, color: '#888', textAlign: 'right', paddingRight: 4, flexShrink: 0 },
  gexBarWrap: { flex: 1, height: 18, position: 'relative', backgroundColor: '#111820', borderRadius: 3 },
  gexCenterLine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#333', zIndex: 1 },
  gexStar: { position: 'absolute', right: 2, top: 2, fontSize: 8, zIndex: 2 },
  gexTimestamp: { fontSize: 8, color: '#333', padding: '4px 8px', borderTop: '1px solid #1e2a3a', textAlign: 'center' },

  // CENTER dealer exposure
  centerPanel: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  dexBox: { backgroundColor: '#0d1117', borderRadius: 8, border: '1px solid #1e2a3a', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  dexHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #1e2a3a', backgroundColor: '#080c12' },
  dexTitle: { fontSize: 12, fontWeight: 700, color: '#f9a825', letterSpacing: '0.3px' },
  dexPrice: { fontSize: 11, color: '#ccc' },
  dexTable: { width: '100%', borderCollapse: 'collapse', fontSize: 9 },
  dexStrikeHead: { padding: '4px 6px', backgroundColor: '#080c12', color: '#666', fontWeight: 700, textAlign: 'left', position: 'sticky', top: 0, zIndex: 1, borderRight: '1px solid #1e2a3a', minWidth: 48 },
  dexExpHead: { padding: '4px 4px', backgroundColor: '#080c12', color: '#555', fontWeight: 600, textAlign: 'center', position: 'sticky', top: 0, zIndex: 1, minWidth: 56, borderLeft: '1px solid #111' },
  dexTotalHead: { padding: '4px 6px', backgroundColor: '#080c12', color: '#666', fontWeight: 700, textAlign: 'right', position: 'sticky', top: 0, zIndex: 1, minWidth: 60 },
  dexStrikeCell: { padding: '3px 6px', color: '#888', fontWeight: 700, fontSize: 10, borderRight: '1px solid #1e2a3a', whiteSpace: 'nowrap' },
  dexCell: { padding: '3px 4px', textAlign: 'center', fontSize: 9, fontWeight: 600, borderLeft: '1px solid #0a0e14', height: 22 },

  // RIGHT panel
  rightPanel: { width: '28%', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  rightCell: { backgroundColor: '#0d1117', borderRadius: 8, border: '1px solid #1e2a3a', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 },
  scoreRow: { display: 'flex', gap: 6, padding: '8px 8px 0' },
  scoreCard: { flex: 1, backgroundColor: '#080c12', borderRadius: 6, padding: '6px', textAlign: 'center', border: '1px solid #1e2a3a' },
  scoreTicker: { fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '1px', marginBottom: 2 },
  scoreNum: { fontSize: 22, fontWeight: 800, lineHeight: 1, marginBottom: 2 },
  scoreGrade: { fontSize: 10, fontWeight: 700, color: '#444' },
  flowTableTitle: { fontSize: 10, fontWeight: 700, color: '#f9a825', letterSpacing: '0.5px', padding: '6px 10px', borderBottom: '1px solid #1e2a3a' },
  flowTable: { width: '100%', borderCollapse: 'collapse', fontSize: 10 },
  flowTh: { padding: '4px 5px', backgroundColor: '#080c12', color: '#555', fontWeight: 700, textAlign: 'left', position: 'sticky', top: 0, fontSize: 9, whiteSpace: 'nowrap', borderBottom: '1px solid #1e2a3a' },
  flowTd: { padding: '3px 5px', fontSize: 9, color: '#aaa', whiteSpace: 'nowrap', borderBottom: '1px solid #0e1520' },
  condBadge: { fontSize: 8, fontWeight: 800, color: '#fff', padding: '1px 4px', borderRadius: 3, letterSpacing: '0.3px' },

  // Sweeps
  sweepFilter: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderBottom: '1px solid #1e2a3a' },
  filterLabel: { fontSize: 9, color: '#555', fontWeight: 700 },
  filterChip: { fontSize: 8, color: '#888', padding: '1px 6px', borderRadius: 10, border: '1px solid #2a3a4a', cursor: 'pointer', fontWeight: 600 },
  sweepRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #0e1520' },
  sweepBar: { width: 3, height: 30, borderRadius: 2, flexShrink: 0 },
  sweepInfo: { flex: 1 },
  sweepTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  sweepTicker: { fontSize: 12, fontWeight: 800, color: '#ffffff' },
  sweepType: { fontSize: 10, fontWeight: 700 },
  sweepStrike: { fontSize: 10, color: '#888' },
  sweepExp: { fontSize: 9, color: '#555' },
  sweepBot: {},
  sweepCond: { fontSize: 8, color: '#f9a825', fontWeight: 600, letterSpacing: '0.5px' },
  sweepRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 },
  sweepPrem: { fontSize: 12, fontWeight: 700, color: '#ffffff' },
  sweepGrade: { fontSize: 9, fontWeight: 800, color: '#000', padding: '1px 5px', borderRadius: 3 },
};

export default SmartMoneyDashboard;
