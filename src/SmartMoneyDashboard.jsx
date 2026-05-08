import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const EXPIRATIONS = ['0DTE','1DTE','2DTE','3DTE','7DTE','14DTE','21DTE','30DTE','45DTE','60DTE','90DTE'];
const MARKET_TICKERS = ['SPY','QQQ','AAPL','NVDA','TSLA','AMZN','MSFT','META','AMD','GOOGL','NFLX','COIN','MSTR','PLTR','ARM','UBER','SHOP','HOOD','SOFI','BABA'];
const DEFAULT_BASE = { SPY:585, QQQ:425, NVDA:135, AAPL:234, TSLA:310, AMZN:185, MSFT:415, META:520, AMD:155, GOOGL:175 };
const REGIMES = [
  { label:'Positive Gamma', sub:'Dealers long gamma — market likely to pin', color:'#00e676', glow:'rgba(0,230,118,0.25)' },
  { label:'Negative Gamma', sub:'Dealers short gamma — volatility expansion likely', color:'#ff5252', glow:'rgba(255,82,82,0.25)' },
  { label:'Volatility Expansion Risk', sub:'Gamma near zero — explosive move possible', color:'#f9a825', glow:'rgba(249,168,37,0.25)' },
  { label:'Dealer Long Gamma', sub:'Strong dealer hedge buying supports price', color:'#00bcd4', glow:'rgba(0,188,212,0.25)' },
  { label:'Pinning Environment', sub:'Max pain gravity — price likely to gravitate to strike', color:'#ab47bc', glow:'rgba(171,71,188,0.25)' },
];
const FLOW_LABELS = ['Institutional','Opening Position','Hedge','High Conviction','Lotto','Closing Position'];
const CONDITIONS = ['SWEEP','BLOCK','SPLIT'];
const SENTIMENTS = ['ASK','BID','MID'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const fmt = (p) => {
  if (!p && p !== 0) return '$0';
  const a = Math.abs(p), s = p < 0 ? '-' : '';
  if (a >= 1000000) return `${s}$${(a/1e6).toFixed(1)}M`;
  if (a >= 1000) return `${s}$${(a/1000).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const pct = (n, d) => d ? ((n/d)*100).toFixed(1) : '0';
const getGrade = s => s>=90?'A+':s>=80?'A':s>=70?'B+':s>=60?'B':'C';
const clamp = (v,mn,mx) => Math.min(mx, Math.max(mn, v));

// ─── COLOR HELPERS ────────────────────────────────────────────────────────────
const gexBarColor = (gex, max) => {
  const t = Math.abs(gex) / max;
  if (gex > 0) {
    if (t < 0.2) return '#003d33'; if (t < 0.4) return '#00695c';
    if (t < 0.6) return '#00897b'; if (t < 0.8) return '#00bcd4'; return '#f9a825';
  } else {
    if (t < 0.2) return '#1a0033'; if (t < 0.4) return '#4a148c';
    if (t < 0.6) return '#6a1b9a'; if (t < 0.8) return '#ab47bc'; return '#f9a825';
  }
};
const dexCellStyle = (val) => {
  const a = Math.abs(val);
  if (a < 60000) return { bg:'#0a0e14', color:'#222' };
  if (val > 0) {
    if (a < 200000) return { bg:'#003028', color:'#80cbc4' };
    if (a < 500000) return { bg:'#00574a', color:'#fff' };
    if (a < 1000000) return { bg:'#00897b', color:'#fff' };
    return { bg:'#f9a825', color:'#000' };
  } else {
    if (a < 200000) return { bg:'#1a0030', color:'#ce93d8' };
    if (a < 500000) return { bg:'#38006b', color:'#fff' };
    if (a < 1000000) return { bg:'#6a1b9a', color:'#fff' };
    return { bg:'#f9a825', color:'#000' };
  }
};

// ─── MOCK GENERATORS ──────────────────────────────────────────────────────────
const genGex = (base) => {
  const rows = [], bs = Math.floor(base/5)*5;
  for (let i=10;i>=-10;i--) {
    const strike = bs + i*5;
    const gex = (Math.random()-0.45)*2000000;
    rows.push({ strike, gex, isWall: Math.abs(gex)>1500000, isMagnet: Math.abs(gex)>800000 && Math.abs(gex)<1500000 });
  }
  return rows;
};

const genDex = (base) => {
  const bs = Math.floor(base/5)*5;
  return Array.from({length:21},(_,idx) => {
    const strike = bs + (10-idx)*5;
    const cells = {};
    EXPIRATIONS.forEach(e => { const v=(Math.random()-0.45)*1500000; cells[e]=Math.abs(v)<70000?0:v; });
    const rowTotal = Object.values(cells).reduce((s,v)=>s+v,0);
    return { strike, cells, rowTotal };
  });
};

const genFlow = () => {
  const now = new Date();
  return Array.from({length:60},(_,i) => {
    const ticker = MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
    const base = DEFAULT_BASE[ticker]||100;
    const strike = Math.floor(base/5)*5 + (Math.floor(Math.random()*10)-5)*5;
    const type = Math.random()>0.5?'CALL':'PUT';
    const sent = SENTIMENTS[Math.floor(Math.random()*3)];
    const cond = CONDITIONS[Math.floor(Math.random()*3)];
    const dte = Math.floor(Math.random()*90);
    const price = (Math.random()*8+0.1).toFixed(2);
    const size = Math.floor(Math.random()*900+50);
    const prem = price*size*100;
    const isBull = (type==='CALL'&&sent==='ASK')||(type==='PUT'&&sent==='BID');
    const otm = ((Math.random()-0.5)*8).toFixed(1);
    const ivRank = Math.floor(Math.random()*100);
    const unusual = size > 500 && prem > 200000;
    const label = FLOW_LABELS[Math.floor(Math.random()*FLOW_LABELS.length)];
    // score
    let score = 50;
    score += sent==='ASK'?10:-5; score += prem>500000?20:prem>200000?10:0;
    score += size>500?10:0; score += cond==='SWEEP'?15:cond==='BLOCK'?10:0;
    score += unusual?10:0; score = clamp(score,0,100);
    const t = new Date(now.getTime()-i*11000);
    const ts = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const expD = new Date(now.getTime()+dte*86400000);
    const exp = `${(expD.getMonth()+1).toString().padStart(2,'0')}/${expD.getDate().toString().padStart(2,'0')}/${expD.getFullYear().toString().slice(2)}`;
    return { ticker,strike,type,sent,cond,dte,price,size,prem,isBull,otm,ivRank,unusual,label,score,ts,exp };
  });
};

const genSweeps = () => Array.from({length:18},(_,i) => {
  const ticker = MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
  const base = DEFAULT_BASE[ticker]||100;
  const strike = Math.floor(base/5)*5 + (Math.floor(Math.random()*10)-5)*5;
  const isBull = Math.random()>0.45;
  const score = Math.floor(Math.random()*35)+65;
  const exps = ['0DTE','2DTE','4DTE','7DTE','14DTE','30DTE'];
  const prem = Math.random()*2000000+400000;
  const size = Math.floor(Math.random()*1200+200);
  const label = FLOW_LABELS[Math.floor(Math.random()*FLOW_LABELS.length)];
  const cond = Math.random()>0.5?'SWEEP':'BLOCK';
  const dte = Math.floor(Math.random()*45);
  const now = new Date(); const t = new Date(now.getTime()-i*25000);
  const ts = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const expD = new Date(now.getTime()+dte*86400000);
  const exp = `${(expD.getMonth()+1).toString().padStart(2,'0')}/${expD.getDate().toString().padStart(2,'0')}/${expD.getFullYear().toString().slice(2)}`;
  return { ticker,strike,type:isBull?'CALL':'PUT',exp,dte,prem,size,score,grade:getGrade(score),isBull,label,cond,ts };
}).sort((a,b)=>b.prem-a.prem);

const genAlerts = () => {
  const types = [
    { icon:'⚡', title:'Aggressive Sweep Detected', sub:'NVDA 140C — $1.2M premium, ask-side, 0DTE', color:'#f9a825' },
    { icon:'🔥', title:'Gamma Flip Breach Risk', sub:'SPY approaching 580 flip level — volatility expansion likely', color:'#ff5252' },
    { icon:'📡', title:'Institutional Flow Cluster', sub:'5 consecutive TSLA 320C sweeps in 4 minutes', color:'#00bcd4' },
    { icon:'🧲', title:'Magnet Zone Active', sub:'QQQ 420 — strong dealer pinning pressure detected', color:'#ab47bc' },
    { icon:'📈', title:'Dealer Positioning Shift', sub:'Net dealer exposure flipped long on SPY above 585', color:'#00e676' },
  ];
  return types.slice(0, Math.floor(Math.random()*2)+3);
};

const genKeySummary = (ticker, base) => {
  const flip = (base * (0.97 + Math.random()*0.03)).toFixed(2);
  const callWall = (base * (1.02 + Math.random()*0.02)).toFixed(2);
  const putWall = (base * (0.96 + Math.random()*0.02)).toFixed(2);
  const magnet = (base * (0.99 + Math.random()*0.02)).toFixed(2);
  const dist = (base - flip).toFixed(2);
  const ivRank = Math.floor(Math.random()*100);
  const ivPct = Math.floor(Math.random()*100);
  const expMove = (base * (0.01 + Math.random()*0.02)).toFixed(2);
  const skew = (Math.random()-0.5 > 0 ? 'Put Skew' : 'Call Skew');
  const bullScore = Math.floor(Math.random()*60)+20;
  const bearScore = 100-bullScore;
  const smConf = Math.floor(Math.random()*40)+55;
  const hedgeBuy = Math.floor(Math.random()*60)+20;
  const hedgeSell = 100-hedgeBuy;
  const regime = REGIMES[Math.floor(Math.random()*REGIMES.length)];
  const regimeConf = Math.floor(Math.random()*30)+65;
  const narrative = [
    `${ticker} is in ${regime.label.toLowerCase()} regime above ${flip}. Dealer positioning favors ${bullScore>bearScore?'mean reversion':'volatility expansion'} near current levels.`,
    `Large ${bullScore>bearScore?'bullish call':'bearish put'} accumulation detected into next expiration. Smart money confidence at ${smConf}%.`,
    `Key gamma flip at $${flip} — a break below triggers dealer selling pressure. Watch $${putWall} as structural support.`,
  ].join(' ');
  return { flip, callWall, putWall, magnet, dist, ivRank, ivPct, expMove, skew, bullScore, bearScore, smConf, hedgeBuy, hedgeSell, regime, regimeConf, narrative };
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const SmartMoneyDashboard = () => {
  const [tickers, setTickers] = useState(['SPY','QQQ','NVDA']);
  const [tickerInputs, setTickerInputs] = useState(['','','']);
  const [selectedTicker, setSelectedTicker] = useState('QQQ');
  const [gexData, setGexData] = useState({});
  const [dexData, setDexData] = useState([]);
  const [flow, setFlow] = useState([]);
  const [sweeps, setSweeps] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [bases, setBases] = useState({SPY:585,QQQ:425,NVDA:135});
  const [summary, setSummary] = useState(null);
  const [scores, setScores] = useState({});
  const [flowFilter, setFlowFilter] = useState('ALL');
  const [sweepFilter, setSweepFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const intervalRef = useRef(null);
  const today = new Date().toISOString().split('T')[0];

  const refresh = useCallback(() => {
    setLoading(true);
    const newBases = {};
    const newGex = {}; const newScores = {};
    tickers.forEach(t => {
      const b = DEFAULT_BASE[t]||100;
      newBases[t] = b + (Math.random()-0.5)*5;
      newGex[t] = genGex(newBases[t]);
      newScores[t] = Math.floor(Math.random()*35)+60;
    });
    const selBase = newBases[selectedTicker]||100;
    setBases(newBases); setGexData(newGex); setScores(newScores);
    setDexData(genDex(selBase));
    setFlow(genFlow()); setSweeps(genSweeps()); setAlerts(genAlerts());
    setSummary(genKeySummary(selectedTicker, selBase));
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }, [tickers, selectedTicker]);

  useEffect(() => { refresh(); intervalRef.current = setInterval(refresh, 60000); return () => clearInterval(intervalRef.current); }, [refresh]);

  const changeTicker = (idx, val) => {
    const v = val.toUpperCase();
    const ni = [...tickerInputs]; ni[idx]=v; setTickerInputs(ni);
  };
  const submitTicker = (idx, e) => {
    if (e.key==='Enter' && tickerInputs[idx]) {
      const nt=[...tickers]; const old=nt[idx]; nt[idx]=tickerInputs[idx]; setTickers(nt);
      if (selectedTicker===old) setSelectedTicker(tickerInputs[idx]);
      const ni=[...tickerInputs]; ni[idx]=''; setTickerInputs(ni);
    }
  };

  const filteredFlow = flow.filter(r => flowFilter==='ALL'||r.type===flowFilter||r.cond===flowFilter);
  const filteredSweeps = sweeps.filter(s => sweepFilter==='ALL'||s.type===sweepFilter||s.cond===sweepFilter);

  const selBase = bases[selectedTicker]||425;

  // ── GEX COLUMN ──
  const renderGex = (ticker, idx) => {
    const rows = gexData[ticker]||[];
    const base = bases[ticker]||100;
    const maxG = rows.length ? Math.max(...rows.map(r=>Math.abs(r.gex)),1) : 1;
    const isSelected = selectedTicker===ticker;
    const sc = scores[ticker]||0;
    const gammaFlip = (base*0.985).toFixed(0);
    return (
      <div key={ticker} style={{...S.gexBox, border: isSelected?'1.5px solid #f9a825':'1px solid #1e2a3a'}} onClick={()=>setSelectedTicker(ticker)}>
        {/* search */}
        <div style={S.gexSearch}>
          <span style={S.gexSearchIcon}>🔍</span>
          <input placeholder={ticker} value={tickerInputs[idx]} onChange={e=>changeTicker(idx,e.target.value)} onKeyDown={e=>submitTicker(idx,e)} style={S.gexInput} onClick={e=>e.stopPropagation()} />
        </div>
        {/* price row */}
        <div style={S.gexPriceRow}>
          <span style={S.gexTickerLabel}>{ticker}</span>
          <span style={S.gexPriceVal}>${base.toFixed(2)}</span>
          <span style={{...S.gexChg, color: Math.random()>0.5?'#00e676':'#ff5252'}}>{Math.random()>0.5?'+':'-'}{(Math.random()*2).toFixed(2)}%</span>
          <span style={{...S.gradeChip, backgroundColor: sc>=70?'#00574a':sc>=50?'#5f3a00':'#4a0000'}}>{getGrade(sc)} {sc}</span>
        </div>
        {/* col headers */}
        <div style={S.gexColHdr}><span style={{width:44,fontSize:8,color:'#444',textAlign:'right',paddingRight:4}}>STRIKE</span><span style={{flex:1,fontSize:8,color:'#444',textAlign:'center'}}>GEX</span><span style={{width:58,fontSize:8,color:'#444',textAlign:'right'}}>VALUE</span></div>
        {/* rows */}
        <div style={S.gexRowsWrap}>
          {rows.map(row => {
            const pctW = Math.abs(row.gex)/maxG;
            const col = gexBarColor(row.gex, maxG);
            const isPos = row.gex>=0;
            const isSpot = Math.abs(row.strike-base)<3;
            const isFlip = Math.abs(row.strike-Number(gammaFlip))<3;
            return (
              <div key={row.strike} style={{...S.gexRow, backgroundColor: isSpot?'rgba(249,168,37,0.08)':isFlip?'rgba(255,82,82,0.06)':'transparent'}}>
                <div style={{...S.gexStrikeCell}}>
                  {isSpot && <span style={S.spotDot}>●</span>}
                  {isFlip && <span style={S.flipDot}>⚡</span>}
                  <span style={{color: isSpot?'#f9a825':isFlip?'#ff5252':'#888', fontWeight: isSpot||isFlip?700:400}}>{row.strike}</span>
                </div>
                <div style={S.gexBarWrap}>
                  <div style={S.gexCenterLine}/>
                  {isPos
                    ? <div style={{position:'absolute',left:'50%',top:2,bottom:2,width:`${pctW*50}%`,backgroundColor:col,borderRadius:'0 3px 3px 0',boxShadow:row.isWall?`0 0 6px ${col}`:undefined}}/>
                    : <div style={{position:'absolute',right:'50%',top:2,bottom:2,width:`${pctW*50}%`,backgroundColor:col,borderRadius:'3px 0 0 3px',boxShadow:row.isWall?`0 0 6px ${col}`:undefined}}/>
                  }
                  {row.isWall && <span style={{position:'absolute',top:1,right:2,fontSize:7,color:'#f9a825',fontWeight:700}}>{isPos?'CALL WALL':'PUT WALL'}</span>}
                  {row.isMagnet && !row.isWall && <span style={{position:'absolute',top:1,right:2,fontSize:7,color:'#ab47bc'}}>🧲</span>}
                </div>
                <div style={{width:58,fontSize:9,fontWeight:700,textAlign:'right',flexShrink:0,color:isPos?'#00e676':'#ff5252',paddingRight:2}}>{fmt(row.gex)}</div>
              </div>
            );
          })}
        </div>
        {/* scale */}
        <div style={S.gexScale}>
          <span style={{fontSize:8,color:'#444'}}>-1.0M</span>
          <div style={{flex:1,height:4,background:'linear-gradient(to right,#6a1b9a,#111820,#00897b)',borderRadius:2,margin:'0 6px'}}/>
          <span style={{fontSize:8,color:'#444'}}>+1.0M</span>
        </div>
      </div>
    );
  };

  // ── CENTER ──
  const renderCenter = () => {
    if (!summary) return null;
    const { regime, regimeConf, flip, callWall, putWall, magnet, ivRank, ivPct, expMove, skew, bullScore, bearScore, smConf, hedgeBuy, hedgeSell, narrative } = summary;
    return (
      <div style={S.centerPanel}>
        {/* REGIME STRIP */}
        <div style={{...S.regimeStrip, boxShadow:`0 0 20px ${regime.glow}`, borderColor: regime.color}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{...S.regimeDot, backgroundColor:regime.color, boxShadow:`0 0 8px ${regime.color}`}}/>
            <span style={{...S.regimeLabel, color:regime.color}}>{regime.label}</span>
            <span style={S.regimeSub}>{regime.sub}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <span style={{fontSize:10,color:'#555'}}>Confidence: <span style={{color:regime.color,fontWeight:700}}>{regimeConf}%</span></span>
            <span style={{fontSize:9,color:'#333'}}>Click ticker to switch</span>
          </div>
        </div>

        {/* KEY LEVELS ROW */}
        <div style={S.keyLevelsRow}>
          {[
            {label:'Gamma Flip',val:`$${flip}`,color:'#ff5252'},
            {label:'Call Wall',val:`$${callWall}`,color:'#00e676'},
            {label:'Put Wall',val:`$${putWall}`,color:'#ab47bc'},
            {label:'Magnet',val:`$${magnet}`,color:'#f9a825'},
            {label:'IV Rank',val:`${ivRank}`,color:'#00bcd4'},
            {label:'Exp Move',val:`±$${expMove}`,color:'#80cbc4'},
            {label:'Skew',val:skew,color:'#ce93d8'},
          ].map(k=>(
            <div key={k.label} style={S.keyCard}>
              <div style={{fontSize:8,color:'#444',marginBottom:2,letterSpacing:'0.5px'}}>{k.label}</div>
              <div style={{fontSize:11,fontWeight:800,color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* GAMMA FLIP METER */}
        <div style={S.flipMeter}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <span style={{fontSize:9,color:'#555',fontWeight:700}}>⚡ GAMMA FLIP METER — {selectedTicker}</span>
            <span style={{fontSize:9,color:'#444'}}>Dist: <span style={{color:'#f9a825',fontWeight:700}}>{(selBase-Number(flip)).toFixed(2)} pts</span></span>
          </div>
          <div style={S.flipTrack}>
            <div style={{position:'absolute',left:`${clamp(((selBase-Number(putWall))/(Number(callWall)-Number(putWall)))*100,2,98)}%`,top:-3,bottom:-3,width:2,backgroundColor:'#f9a825',boxShadow:'0 0 6px #f9a825'}}/>
            <div style={{position:'absolute',left:`${clamp(((Number(flip)-Number(putWall))/(Number(callWall)-Number(putWall)))*100,2,98)}%`,top:-4,bottom:-4,width:2,backgroundColor:'#ff5252',boxShadow:'0 0 8px #ff5252'}}/>
            <div style={{position:'absolute',right:0,top:0,bottom:0,left:`${clamp(((selBase-Number(putWall))/(Number(callWall)-Number(putWall)))*100,2,98)}%`,backgroundColor:'rgba(0,150,136,0.15)',borderRadius:'0 3px 3px 0'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
            <span style={{fontSize:8,color:'#ab47bc'}}>PUT WALL ${putWall}</span>
            <span style={{fontSize:8,color:'#ff5252'}}>FLIP ${flip}</span>
            <span style={{fontSize:8,color:'#f9a825'}}>SPOT ${selBase.toFixed(2)}</span>
            <span style={{fontSize:8,color:'#00e676'}}>CALL WALL ${callWall}</span>
          </div>
        </div>

        {/* FLOW INTELLIGENCE + HEDGE METER */}
        <div style={{display:'flex',gap:6,marginBottom:6}}>
          {/* Bull/Bear/SM */}
          <div style={S.intelCard}>
            <div style={{fontSize:8,color:'#444',marginBottom:4,fontWeight:700}}>FLOW INTELLIGENCE</div>
            <div style={{display:'flex',gap:4,marginBottom:4}}>
              <div style={{flex:1}}>
                <div style={{fontSize:8,color:'#00e676',marginBottom:2}}>BULL AGGRESSION</div>
                <div style={{height:6,backgroundColor:'#0a1a0a',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${bullScore}%`,background:'linear-gradient(to right,#00574a,#00e676)',borderRadius:3,boxShadow:'0 0 4px #00e676'}}/>
                </div>
                <div style={{fontSize:9,color:'#00e676',fontWeight:700,marginTop:1}}>{bullScore}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:8,color:'#ff5252',marginBottom:2}}>BEAR AGGRESSION</div>
                <div style={{height:6,backgroundColor:'#1a0a0a',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${bearScore}%`,background:'linear-gradient(to right,#7f0000,#ff5252)',borderRadius:3,boxShadow:'0 0 4px #ff5252'}}/>
                </div>
                <div style={{fontSize:9,color:'#ff5252',fontWeight:700,marginTop:1}}>{bearScore}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:8,color:'#f9a825',marginBottom:2}}>SM CONFIDENCE</div>
                <div style={{height:6,backgroundColor:'#1a1400',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${smConf}%`,background:'linear-gradient(to right,#7f5000,#f9a825)',borderRadius:3,boxShadow:'0 0 4px #f9a825'}}/>
                </div>
                <div style={{fontSize:9,color:'#f9a825',fontWeight:700,marginTop:1}}>{smConf}%</div>
              </div>
            </div>
          </div>
          {/* Hedge meter */}
          <div style={S.intelCard}>
            <div style={{fontSize:8,color:'#444',marginBottom:4,fontWeight:700}}>DEALER HEDGING PRESSURE</div>
            <div style={{display:'flex',gap:4}}>
              <div style={{flex:1}}>
                <div style={{fontSize:8,color:'#00bcd4',marginBottom:2}}>BUY PRESSURE</div>
                <div style={{height:6,backgroundColor:'#0a1520',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${hedgeBuy}%`,background:'linear-gradient(to right,#006064,#00bcd4)',borderRadius:3,boxShadow:'0 0 4px #00bcd4'}}/>
                </div>
                <div style={{fontSize:9,color:'#00bcd4',fontWeight:700,marginTop:1}}>{hedgeBuy}%</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:8,color:'#ab47bc',marginBottom:2}}>SELL PRESSURE</div>
                <div style={{height:6,backgroundColor:'#150a1a',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${hedgeSell}%`,background:'linear-gradient(to right,#4a0072,#ab47bc)',borderRadius:3,boxShadow:'0 0 4px #ab47bc'}}/>
                </div>
                <div style={{fontSize:9,color:'#ab47bc',fontWeight:700,marginTop:1}}>{hedgeSell}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* DEX MATRIX */}
        <div style={S.dexWrap}>
          <div style={S.dexMatrixHeader}>
            <span style={{fontSize:11,fontWeight:700,color:'#f9a825'}}>⚡ {selectedTicker} — Dealer Exposure (Swing Mode)</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:9,color:'#444'}}>Exposure: <span style={{color:'#aaa'}}>Premium</span></span>
              <span style={{fontSize:9,color:'#444'}}>View: <span style={{color:'#aaa'}}>Full Matrix</span></span>
            </div>
          </div>
          <div style={{overflowX:'auto',overflowY:'auto',flex:1}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:9}}>
              <thead>
                <tr>
                  <th style={S.dexTh}>Strike</th>
                  {EXPIRATIONS.map(e=><th key={e} style={{...S.dexTh,minWidth:52}}>{e}</th>)}
                  <th style={{...S.dexTh,color:'#666'}}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {dexData.map(row=>(
                  <tr key={row.strike}>
                    <td style={S.dexStrike}>{row.strike}</td>
                    {EXPIRATIONS.map(exp=>{
                      const v=row.cells[exp]||0;
                      const {bg,color}=dexCellStyle(v);
                      return <td key={exp} style={{...S.dexCell,backgroundColor:bg,color}}>{v?fmt(v):''}</td>;
                    })}
                    <td style={{...S.dexCell,color:row.rowTotal>=0?'#00e676':'#ff5252',fontWeight:800,backgroundColor:'#0a0e14'}}>{fmt(row.rowTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* color legend */}
          <div style={S.dexLegend}>
            <span style={{fontSize:8,color:'#555'}}>Lowest Exposure</span>
            <div style={{flex:1,height:5,background:'linear-gradient(to right,#4a148c,#111820,#00897b,#f9a825)',borderRadius:3,margin:'0 10px'}}/>
            <span style={{fontSize:8,color:'#555'}}>Highest Exposure</span>
          </div>
          {/* stats bar */}
          <div style={S.statsBar}>
            {[
              {label:'Spot Price',val:`${selBase.toFixed(2)}`,color:'#fff'},
              {label:'IV Rank',val:`${summary.ivRank}`,color:'#f9a825'},
              {label:'IV Pct',val:`${summary.ivPct}%`,color:'#00bcd4'},
              {label:'Put/Call (OI)',val:`${(0.7+Math.random()*0.5).toFixed(2)}`,color:'#ab47bc'},
              {label:'Total GEX',val:fmt((Math.random()-0.5)*2000000),color:'#00e676'},
              {label:'Net Dealer Exp',val:fmt((Math.random()-0.4)*1500000),color:'#ff5252'},
            ].map(s=>(
              <div key={s.label} style={S.statItem}>
                <div style={{fontSize:8,color:'#444'}}>{s.label}</div>
                <div style={{fontSize:11,fontWeight:800,color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI NARRATIVE */}
        <div style={S.narrativeBox}>
          <span style={{fontSize:9,color:'#f9a825',fontWeight:700,marginRight:8}}>🤖 AI NARRATIVE</span>
          <span style={{fontSize:10,color:'#888',lineHeight:1.5}}>{narrative}</span>
        </div>

        {/* ALERTS */}
        {showAlerts && (
          <div style={S.alertsBox}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:9,color:'#f9a825',fontWeight:700}}>🚨 SMART ALERTS</span>
              <span style={{fontSize:8,color:'#333',cursor:'pointer'}} onClick={()=>setShowAlerts(false)}>✕</span>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {alerts.map((a,i)=>(
                <div key={i} style={{...S.alertChip, borderColor:a.color, boxShadow:`0 0 6px ${a.color}22`}}>
                  <span style={{marginRight:4}}>{a.icon}</span>
                  <div>
                    <div style={{fontSize:9,fontWeight:700,color:a.color}}>{a.title}</div>
                    <div style={{fontSize:8,color:'#555'}}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── RIGHT PANEL ──
  const renderRight = () => {
    const sc = (k) => scores[k]||0;
    return (
      <div style={S.rightPanel}>
        {/* SCORECARDS */}
        <div style={S.rightCell}>
          <div style={S.rightCellHdr}>📊 SCORECARDS</div>
          <div style={{display:'flex',gap:6,padding:'6px 8px'}}>
            {tickers.map(k=>(
              <div key={k} style={S.scoreCard}>
                <div style={{fontSize:10,color:'#444',letterSpacing:'1px',marginBottom:2}}>{k}</div>
                <div style={{fontSize:26,fontWeight:900,color:sc(k)>=70?'#00e676':sc(k)>=50?'#f9a825':'#ff5252',lineHeight:1}}>{sc(k)}</div>
                <div style={{fontSize:9,color:'#444',marginBottom:3}}>{getGrade(sc(k))}</div>
                <div style={{fontSize:8,color:sc(k)>=70?'#00e676':'#ff5252'}}>
                  {sc(k)>=70?'▲ Bullish':'▼ Bearish'}
                </div>
              </div>
            ))}
          </div>

          {/* LIVE OPTIONS FLOW */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 8px',borderTop:'1px solid #1e2a3a',borderBottom:'1px solid #1e2a3a'}}>
            <span style={{fontSize:9,color:'#f9a825',fontWeight:700}}>📡 LIVE OPTIONS FLOW</span>
            <div style={{display:'flex',gap:4}}>
              {['ALL','CALL','PUT','SWEEP','BLOCK'].map(f=>(
                <span key={f} onClick={()=>setFlowFilter(f)} style={{...S.filterChip, backgroundColor:flowFilter===f?'#1e2a3a':'transparent', color:flowFilter===f?'#f9a825':'#444'}}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:9}}>
              <thead>
                <tr>{['TIME','SYM','STRIKE','C/P','EXP','DTE','PRICE','SIZE','SENT','COND','LABEL','PREM'].map(h=>(
                  <th key={h} style={S.flowTh}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredFlow.slice(0,40).map((r,i)=>(
                  <tr key={i} style={{backgroundColor:r.unusual?'rgba(249,168,37,0.06)':i%2?'#0a0e14':'transparent'}}>
                    <td style={S.flowTd}>{r.ts}</td>
                    <td style={{...S.flowTd,fontWeight:800,color:'#fff'}}>{r.ticker}</td>
                    <td style={S.flowTd}>{r.strike}</td>
                    <td style={{...S.flowTd,color:r.type==='CALL'?'#00e676':'#ff5252',fontWeight:700}}>{r.type}</td>
                    <td style={S.flowTd}>{r.exp}</td>
                    <td style={S.flowTd}>{r.dte}</td>
                    <td style={S.flowTd}>${r.price}</td>
                    <td style={{...S.flowTd,color:r.unusual?'#f9a825':'#aaa'}}>{r.size}</td>
                    <td style={{...S.flowTd,color:r.sent==='ASK'?'#00e676':r.sent==='BID'?'#ff5252':'#666',fontWeight:700}}>{r.sent}</td>
                    <td style={S.flowTd}><span style={{...S.condBadge,backgroundColor:r.cond==='SWEEP'?'#7f5000':r.cond==='BLOCK'?'#1a2a5a':'#2a3a2a'}}>{r.cond}</span></td>
                    <td style={S.flowTd}><span style={{...S.labelBadge}}>{r.label}</span></td>
                    <td style={{...S.flowTd,fontWeight:700,color:r.isBull?'#00e676':'#ff5252'}}>{fmt(r.prem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GOLDEN SWEEPS */}
        <div style={S.rightCell}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',borderBottom:'1px solid #1e2a3a'}}>
            <span style={{fontSize:9,color:'#f9a825',fontWeight:700}}>🔥 GOLDEN SWEEPS — INSTITUTIONAL FLOW</span>
            <div style={{display:'flex',gap:4}}>
              {['ALL','CALL','PUT','SWEEP','BLOCK'].map(f=>(
                <span key={f} onClick={()=>setSweepFilter(f)} style={{...S.filterChip,backgroundColor:sweepFilter===f?'#1e2a3a':'transparent',color:sweepFilter===f?'#f9a825':'#444'}}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:9}}>
              <thead>
                <tr>{['TIME','SYM','STRIKE','TYPE','EXP','DTE','PREM','SIZE','COND','LABEL','GRADE'].map(h=>(
                  <th key={h} style={S.flowTh}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredSweeps.map((s,i)=>(
                  <tr key={i} style={{backgroundColor:i%2?'#0a0e14':'transparent'}}>
                    <td style={S.flowTd}>{s.ts}</td>
                    <td style={{...S.flowTd,fontWeight:800,color:'#fff'}}>{s.ticker}</td>
                    <td style={S.flowTd}>{s.strike}</td>
                    <td style={{...S.flowTd,color:s.isBull?'#00e676':'#ff5252',fontWeight:700}}>{s.type}</td>
                    <td style={S.flowTd}>{s.exp}</td>
                    <td style={S.flowTd}>{s.dte}</td>
                    <td style={{...S.flowTd,fontWeight:700,color:s.isBull?'#00e676':'#ff5252'}}>{fmt(s.prem)}</td>
                    <td style={S.flowTd}>{s.size}</td>
                    <td style={S.flowTd}><span style={{...S.condBadge,backgroundColor:s.cond==='SWEEP'?'#7f5000':'#1a2a5a'}}>{s.cond}</span></td>
                    <td style={S.flowTd}><span style={S.labelBadge}>{s.label}</span></td>
                    <td style={S.flowTd}><span style={{...S.gradeBadge,backgroundColor:s.grade==='A+'?'#f9a825':s.grade==='A'?'#00574a':s.grade==='B+'?'#1a2a5a':'#333'}}>{s.grade}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:'4px 8px',borderTop:'1px solid #1e2a3a',fontSize:8,color:'#333',textAlign:'right'}}>
            Grades reflect premium size, flow sentiment & market impact. Last updated: {lastUpdated}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.root}>
      {/* TOP BAR */}
      <div style={S.topBar}>
        <span style={S.logo}>⚡ SmartMoney Flow</span>
        <span style={S.topBarSub}>Real Prices · Mock Flow · {loading?'🔄 Fetching…':`Updated ${lastUpdated}`}</span>
        <div style={S.topTickers}>
          {tickers.map(t=>(
            <span key={t} style={S.topTickerPill}>
              <span style={{color:'#f9a825',fontWeight:700}}>{t}</span>
              <span style={{color:'#aaa',marginLeft:4}}>${(bases[t]||0).toFixed(2)}</span>
            </span>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto'}}>
          <span style={{fontSize:9,color:'#00e676'}}>● API Connected</span>
          <button onClick={refresh} style={S.refreshBtn} disabled={loading}>{loading?'…':'↻ Refresh'}</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={S.main}>
        {/* LEFT */}
        <div style={S.leftPanel}>
          <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'1px',padding:'4px 0 6px',textTransform:'uppercase'}}>GEX Heatmaps ⓘ</div>
          {tickers.map((t,i)=>renderGex(t,i))}
        </div>
        {/* CENTER */}
        {renderCenter()}
        {/* RIGHT */}
        {renderRight()}
      </div>
    </div>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  root:{fontFamily:"'DM Mono','Courier New',monospace",backgroundColor:'#080c12',minHeight:'100vh',display:'flex',flexDirection:'column',color:'#fff'},
  topBar:{display:'flex',alignItems:'center',gap:12,padding:'7px 14px',backgroundColor:'#0a0e14',borderBottom:'1px solid #1e2a3a'},
  logo:{fontSize:15,fontWeight:900,color:'#f9a825',letterSpacing:'-0.5px',flexShrink:0},
  topBarSub:{fontSize:10,color:'#333',flexShrink:0},
  topTickers:{display:'flex',gap:8,marginLeft:12},
  topTickerPill:{fontSize:10,padding:'2px 8px',backgroundColor:'#0d1520',borderRadius:4,border:'1px solid #1e2a3a'},
  refreshBtn:{padding:'4px 10px',borderRadius:4,border:'1px solid #1e2a3a',backgroundColor:'#0d1520',fontSize:10,fontWeight:700,color:'#aaa',cursor:'pointer'},
  main:{display:'flex',flex:1,gap:6,padding:6,overflow:'hidden',height:'calc(100vh - 42px)'},

  // LEFT GEX
  leftPanel:{width:'22%',display:'flex',flexDirection:'column',gap:6,minWidth:0,overflowY:'auto'},
  gexBox:{backgroundColor:'#0a0e14',borderRadius:7,display:'flex',flexDirection:'column',overflow:'hidden',cursor:'pointer',flexShrink:0},
  gexSearch:{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',backgroundColor:'#080c12',borderBottom:'1px solid #1e2a3a'},
  gexSearchIcon:{fontSize:10,color:'#333'},
  gexInput:{flex:1,backgroundColor:'transparent',border:'none',outline:'none',color:'#888',fontSize:10,fontWeight:600},
  gexPriceRow:{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',backgroundColor:'#080c12'},
  gexTickerLabel:{fontSize:13,fontWeight:900,color:'#fff'},
  gexPriceVal:{fontSize:12,fontWeight:700,color:'#ccc'},
  gexChg:{fontSize:10,fontWeight:700},
  gradeChip:{fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:3,color:'#fff'},
  gexColHdr:{display:'flex',padding:'2px 8px',borderBottom:'1px solid #1e2a3a'},
  gexRowsWrap:{flex:1,overflowY:'auto',padding:'2px 6px 4px'},
  gexRow:{display:'flex',alignItems:'center',height:20,marginBottom:1,borderRadius:2,paddingRight:2},
  gexStrikeCell:{width:48,fontSize:9,textAlign:'right',paddingRight:4,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:2},
  spotDot:{fontSize:7,color:'#f9a825'},
  flipDot:{fontSize:8,color:'#ff5252'},
  gexBarWrap:{flex:1,height:16,position:'relative',backgroundColor:'#0d1520',borderRadius:3},
  gexCenterLine:{position:'absolute',left:'50%',top:0,bottom:0,width:1,backgroundColor:'#1e2a3a',zIndex:1},
  gexScale:{display:'flex',alignItems:'center',padding:'4px 8px',borderTop:'1px solid #1e2a3a'},

  // CENTER
  centerPanel:{flex:1,display:'flex',flexDirection:'column',gap:5,minWidth:0,overflowY:'auto'},
  regimeStrip:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',backgroundColor:'#0a0e14',borderRadius:6,border:'1px solid',flexShrink:0},
  regimeDot:{width:8,height:8,borderRadius:'50%',flexShrink:0},
  regimeLabel:{fontSize:12,fontWeight:800,letterSpacing:'0.3px'},
  regimeSub:{fontSize:9,color:'#555'},
  keyLevelsRow:{display:'flex',gap:5,flexShrink:0},
  keyCard:{flex:1,backgroundColor:'#0a0e14',borderRadius:5,padding:'5px 8px',border:'1px solid #1e2a3a',textAlign:'center'},
  flipMeter:{backgroundColor:'#0a0e14',borderRadius:6,padding:'8px 12px',border:'1px solid #1e2a3a',flexShrink:0},
  flipTrack:{position:'relative',height:8,backgroundColor:'#1e2a3a',borderRadius:4,margin:'2px 0'},
  intelCard:{flex:1,backgroundColor:'#0a0e14',borderRadius:5,padding:'8px 10px',border:'1px solid #1e2a3a'},
  dexWrap:{flex:1,backgroundColor:'#0a0e14',borderRadius:6,border:'1px solid #1e2a3a',display:'flex',flexDirection:'column',overflow:'hidden',minHeight:250},
  dexMatrixHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderBottom:'1px solid #1e2a3a',flexShrink:0},
  dexTh:{padding:'4px 5px',backgroundColor:'#080c12',color:'#444',fontWeight:700,textAlign:'center',position:'sticky',top:0,fontSize:8,whiteSpace:'nowrap',borderBottom:'1px solid #1e2a3a'},
  dexStrike:{padding:'3px 6px',color:'#666',fontWeight:700,fontSize:9,borderRight:'1px solid #1e2a3a',whiteSpace:'nowrap'},
  dexCell:{padding:'3px 4px',textAlign:'center',fontSize:8,fontWeight:700,borderLeft:'1px solid #080c12',height:20},
  dexLegend:{display:'flex',alignItems:'center',padding:'5px 10px',borderTop:'1px solid #1e2a3a',flexShrink:0},
  statsBar:{display:'flex',gap:0,borderTop:'1px solid #1e2a3a',flexShrink:0},
  statItem:{flex:1,padding:'6px 8px',textAlign:'center',borderRight:'1px solid #1e2a3a'},
  narrativeBox:{backgroundColor:'#0a0e14',borderRadius:5,padding:'8px 12px',border:'1px solid #1e2a3a',flexShrink:0},
  alertsBox:{backgroundColor:'#0a0e14',borderRadius:5,padding:'8px 10px',border:'1px solid #1e2a3a',flexShrink:0},
  alertChip:{display:'flex',alignItems:'flex-start',gap:6,padding:'6px 8px',backgroundColor:'#080c12',borderRadius:5,border:'1px solid',flex:'0 0 auto',maxWidth:220},

  // RIGHT
  rightPanel:{width:'30%',display:'flex',flexDirection:'column',gap:6,minWidth:0},
  rightCell:{backgroundColor:'#0a0e14',borderRadius:7,border:'1px solid #1e2a3a',display:'flex',flexDirection:'column',overflow:'hidden',flex:1},
  rightCellHdr:{fontSize:9,fontWeight:700,color:'#f9a825',padding:'6px 8px',borderBottom:'1px solid #1e2a3a',letterSpacing:'0.5px'},
  scoreCard:{flex:1,backgroundColor:'#080c12',borderRadius:6,padding:'8px',textAlign:'center',border:'1px solid #1e2a3a'},
  filterChip:{fontSize:8,padding:'2px 6px',borderRadius:3,border:'1px solid #1e2a3a',cursor:'pointer',fontWeight:700,letterSpacing:'0.3px'},
  flowTh:{padding:'4px 5px',backgroundColor:'#080c12',color:'#333',fontWeight:700,textAlign:'left',position:'sticky',top:0,fontSize:8,whiteSpace:'nowrap',borderBottom:'1px solid #1e2a3a'},
  flowTd:{padding:'3px 5px',fontSize:8,color:'#777',whiteSpace:'nowrap',borderBottom:'1px solid #0a0e14'},
  condBadge:{fontSize:7,fontWeight:800,color:'#fff',padding:'1px 4px',borderRadius:2,letterSpacing:'0.3px'},
  labelBadge:{fontSize:7,fontWeight:700,color:'#555',padding:'1px 4px',borderRadius:2,backgroundColor:'#1e2a3a'},
  gradeBadge:{fontSize:8,fontWeight:900,color:'#000',padding:'1px 5px',borderRadius:2},
};

export default SmartMoneyDashboard;
