import React, { useState, useEffect, useCallback, useRef } from 'react';

const EXPIRATIONS = ['0DTE','1DTE','2DTE','3DTE','7DTE','14DTE','21DTE','30DTE','45DTE','60DTE','90DTE'];
const MARKET_TICKERS = ['SPY','QQQ','AAPL','NVDA','TSLA','AMZN','MSFT','META','AMD','GOOGL','NFLX','COIN','MSTR','PLTR','ARM','UBER','SOFI','BABA','HOOD','SHOP'];
const COMPANY_NAMES = { SPX:'S&P 500 Index', SPY:'SPDR S&P 500 ETF', QQQ:'Invesco QQQ Trust', NVDA:'NVIDIA Corporation', AAPL:'Apple Inc.', TSLA:'Tesla Inc.', AMZN:'Amazon.com', MSFT:'Microsoft Corp.', META:'Meta Platforms', AMD:'Advanced Micro Devices', GOOGL:'Alphabet Inc.' };
const DEFAULT_BASE = { SPX:5930, SPY:526, QQQ:458, NVDA:1224, AAPL:234, TSLA:310, AMZN:185, MSFT:415, META:520, AMD:155, GOOGL:175 };
const FLOW_LABELS = ['Institutional','Opening','Hedge','High Conv.','Lotto','Closing'];
const CONDITIONS = ['SWEEP','BLOCK','SPLIT'];
const SENTIMENTS = ['ASK','BID','MID'];
const MOCK_NEWS = [
  { time:'09:42', src:'@unusual_whales', text:'MASSIVE $SPY call sweep — $4.2M premium, ask-side, 0DTE. Dealers scrambling.', bull:true },
  { time:'09:38', src:'@optionsflow', text:'$NVDA 1300C Jan — $2.1M block. Betting big on breakout before earnings.', bull:true },
  { time:'09:35', src:'@marketmaker', text:'SPX gamma flip at 5880. Break that, dealers start selling hard.', bull:false },
  { time:'09:31', src:'@zerohedge', text:'Fed minutes — no rate cuts expected Q1. Bond market pricing higher for longer.', bull:false },
  { time:'09:28', src:'@unusual_whales', text:'$TSLA put wall at 280 getting crushed with call volume. 3:1 call/put ratio.', bull:true },
  { time:'09:22', src:'@tradealert', text:'$QQQ 460C sweep — 500 contracts, $890K premium. Smart money positioning.', bull:true },
  { time:'09:18', src:'@optionsflow', text:'$META 600P block — $1.3M. Large hedge ahead of earnings next week.', bull:false },
  { time:'09:15', src:'@marketopen', text:'Market open: ES +0.3%, VIX 16.2, Put/Call 0.82 — moderately bullish.', bull:true },
  { time:'09:10', src:'@tradealert', text:'$AMZN unusual call activity — 10x normal volume on 200C. Watch this.', bull:true },
  { time:'09:05', src:'@unusual_whales', text:'$AMD dark pool print $180M at 155. Institutions accumulating.', bull:true },
];

const clamp = (v,mn,mx) => Math.min(mx,Math.max(mn,v));
const fmt = (p) => {
  if (!p && p!==0) return '$0';
  const a=Math.abs(p), s=p<0?'-':'';
  if (a>=1000000) return `${s}$${(a/1e6).toFixed(1)}M`;
  if (a>=1000) return `${s}$${(a/1000).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const getGrade = s => s>=90?'A+':s>=80?'A':s>=70?'B+':s>=60?'B':'C';

// GEX bar color — ONLY color changes based on net exposure
// Positive (king node) = yellow/gold
// Negative = purple/dark purple
const getBarColor = (gex, netExp) => {
  const intensity = Math.min(Math.abs(gex) / 2000000, 1);
  if (netExp >= 0) {
    // positive — gold scale
    const r = Math.round(50 + intensity * 205);
    const g = Math.round(80 + intensity * 88);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  } else {
    // negative — purple scale
    const r = Math.round(30 + intensity * 140);
    const g = 0;
    const b = Math.round(80 + intensity * 140);
    return `rgb(${r},${g},${b})`;
  }
};

const dexCellStyle = (val) => {
  const a = Math.abs(val);
  if (a < 60000) return { bg:'transparent', color:'transparent' };
  if (val > 0) {
    if (a < 200000) return { bg:'#2a1a00', color:'#c87800' };
    if (a < 500000) return { bg:'#7f5000', color:'#ffe082' };
    if (a < 1000000) return { bg:'#f9a825', color:'#000' };
    return { bg:'#ffe57f', color:'#000' };
  } else {
    if (a < 200000) return { bg:'#1a0033', color:'#9c27b0' };
    if (a < 500000) return { bg:'#38006b', color:'#e1bee7' };
    if (a < 1000000) return { bg:'#6a1b9a', color:'#fff' };
    return { bg:'#ab47bc', color:'#fff' };
  }
};

const Sparkline = ({ positive, width=80, height=20 }) => {
  const pts = useRef(Array.from({length:20}, () => Math.random())).current;
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const d = pts.map((p,i) => `${i===0?'M':'L'}${(i/(pts.length-1)*width).toFixed(1)},${((1-(p-mn)/rng)*height).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={positive?'#00e676':'#ff5252'} strokeWidth={1.5} strokeLinejoin="round"/>
    </svg>
  );
};

const genGex = (base) => {
  const netExp = (Math.random() - 0.4) * 4000000;
  const bs = Math.floor(base/5)*5;
  const rows = [];
  for (let i=10; i>=-10; i--) {
    const strike = bs + i*5;
    const gex = (Math.random()-0.45)*2000000;
    rows.push({ strike, gex, isKing: Math.abs(gex) > 1500000 });
  }
  return { rows, netExp };
};

const genDex = (base) => {
  const bs = Math.floor(base/5)*5;
  return Array.from({length:21}, (_,idx) => {
    const strike = bs + (10-idx)*5;
    const cells = {};
    EXPIRATIONS.forEach(e => { const v=(Math.random()-0.45)*1500000; cells[e]=Math.abs(v)<70000?0:v; });
    const rowTotal = Object.values(cells).reduce((s,v)=>s+v,0);
    return { strike, cells, rowTotal };
  });
};

const genFlow = () => {
  const now = new Date();
  return Array.from({length:60}, (_,i) => {
    const ticker = MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
    const base = DEFAULT_BASE[ticker]||100;
    const strike = Math.floor(base/5)*5+(Math.floor(Math.random()*10)-5)*5;
    const type = Math.random()>0.5?'CALL':'PUT';
    const sent = SENTIMENTS[Math.floor(Math.random()*3)];
    const cond = CONDITIONS[Math.floor(Math.random()*3)];
    const dte = Math.floor(Math.random()*90);
    const price = (Math.random()*8+0.1).toFixed(2);
    const size = Math.floor(Math.random()*900+50);
    const prem = price*size*100;
    const isBull = (type==='CALL'&&sent==='ASK')||(type==='PUT'&&sent==='BID');
    const unusual = size>500&&prem>200000;
    const label = FLOW_LABELS[Math.floor(Math.random()*FLOW_LABELS.length)];
    const t = new Date(now.getTime()-i*11000);
    const ts = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const expD = new Date(now.getTime()+dte*86400000);
    const exp = `${(expD.getMonth()+1).toString().padStart(2,'0')}/${expD.getDate().toString().padStart(2,'0')}/${expD.getFullYear().toString().slice(2)}`;
    return { ticker,strike,type,sent,cond,dte,price,size,prem,isBull,unusual,label,ts,exp };
  });
};

const genSweeps = () => Array.from({length:20}, (_,i) => {
  const ticker = MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
  const base = DEFAULT_BASE[ticker]||100;
  const strike = Math.floor(base/5)*5+(Math.floor(Math.random()*10)-5)*5;
  const isBull = Math.random()>0.45;
  const score = Math.floor(Math.random()*35)+65;
  const dte = Math.floor(Math.random()*45);
  const prem = Math.random()*2000000+400000;
  const size = Math.floor(Math.random()*1200+200);
  const cond = Math.random()>0.5?'SWEEP':'BLOCK';
  const now = new Date();
  const t = new Date(now.getTime()-i*25000);
  const ts = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const expD = new Date(now.getTime()+dte*86400000);
  const exp = `${(expD.getMonth()+1).toString().padStart(2,'0')}/${expD.getDate().toString().padStart(2,'0')}/${expD.getFullYear().toString().slice(2)}`;
  return { ticker,strike,type:isBull?'CALL':'PUT',exp,dte,prem,size,score,grade:getGrade(score),isBull,cond,ts };
}).sort((a,b)=>b.prem-a.prem);

const genNarrative = (ticker, base, netExp) => {
  const flip = (base*0.985).toFixed(2);
  const callWall = (base*1.025).toFixed(2);
  const putWall = (base*0.965).toFixed(2);
  const smConf = Math.floor(Math.random()*40)+55;
  return `${ticker} is in ${netExp>0?'positive':'negative'} gamma regime. Gamma flip at $${flip} — ${netExp>0?'dealers net long, supporting mean reversion':'dealers net short, accelerating moves'}. Call wall $${callWall}, put wall $${putWall}. Smart money confidence ${smConf}%. ${netExp>0?'Expect price to gravitate toward $'+(Math.round(base/5)*5)+' into expiration.':'Watch for vol expansion on a break of $'+flip+'.'}`;
};

const SmartMoneyDashboard = () => {
  const [tickers, setTickers] = useState(['SPX','SPY','QQQ']);
  const [inputs, setInputs] = useState(['','','']);
  const [selectedDex, setSelectedDex] = useState('SPX');
  const [gexData, setGexData] = useState({});
  const [bases, setBases] = useState({SPX:5930,SPY:526,QQQ:458});
  const [changes, setChanges] = useState({SPX:{v:'0',p:'0'},SPY:{v:'0',p:'0'},QQQ:{v:'0',p:'0'}});
  const [dexData, setDexData] = useState([]);
  const [flow, setFlow] = useState([]);
  const [sweeps, setSweeps] = useState([]);
  const [scores, setScores] = useState({SPX:72,SPY:66,QQQ:77});
  const [narrative, setNarrative] = useState('');
  const [flowFilter, setFlowFilter] = useState('ALL');
  const [sweepFilter, setSweepFilter] = useState('ALL');
  const [darkMode, setDarkMode] = useState(true);
  const [dexExposure, setDexExposure] = useState('Premium');
  const [dexView, setDexView] = useState('Full Matrix');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    setLoading(true);
    const nb={}, nc={}, ng={}, ns={};
    tickers.forEach(t => {
      const b = (DEFAULT_BASE[t]||100) + (Math.random()-0.5)*8;
      nb[t] = b;
      const chg = (Math.random()-0.5)*25;
      nc[t] = { v:chg.toFixed(2), p:((chg/b)*100).toFixed(2) };
      ng[t] = genGex(b);
      ns[t] = Math.floor(Math.random()*35)+60;
    });
    const sel = selectedDex || tickers[0];
    const selBase = nb[sel]||100;
    const selNetExp = ng[sel]?.netExp||0;
    setBases(nb); setChanges(nc); setGexData(ng); setScores(ns);
    setDexData(genDex(selBase));
    setFlow(genFlow());
    setSweeps(genSweeps());
    setNarrative(genNarrative(sel, selBase, selNetExp));
    setLastUpdated(new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
    setLoading(false);
  }, [tickers, selectedDex]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 60000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  const handleInput = (idx, val) => { const n=[...inputs]; n[idx]=val.toUpperCase(); setInputs(n); };
  const handleSubmit = (idx) => {
    if (!inputs[idx]) return;
    const n=[...tickers]; n[idx]=inputs[idx]; setTickers(n);
    const ni=[...inputs]; ni[idx]=''; setInputs(ni);
  };

  const D = darkMode ? {
    bg:'#060a10', bg2:'#0a0e18', bg3:'#0d1520',
    text:'#dde6f0', muted:'#6a7a8a', muted2:'#2a3a4a',
    border:'#162030', accent:'#f9a825',
  } : {
    bg:'#f0f4f8', bg2:'#ffffff', bg3:'#f4f6f9',
    text:'#1a2332', muted:'#546e7a', muted2:'#90a4ae',
    border:'#dde6f0', accent:'#1565c0',
  };

  const filteredFlow = flow.filter(r => flowFilter==='ALL'||r.type===flowFilter||r.cond===flowFilter);
  const filteredSweeps = sweeps.filter(s => sweepFilter==='ALL'||s.type===sweepFilter||s.cond===sweepFilter);

  // ── GEX BOX ──
  const GexBox = ({ tickerKey, idx }) => {
    const data = gexData[tickerKey];
    const rows = data?.rows || [];
    const netExp = data?.netExp || 0;
    const base = bases[tickerKey] || 100;
    const chg = changes[tickerKey] || {v:'0',p:'0'};
    const isPos = Number(chg.p) >= 0;
    const isSelected = selectedDex === tickerKey;
    const accentColor = netExp >= 0 ? '#f9a825' : '#ab47bc';
    const gammaFlip = Math.round(base * 0.985 / 5) * 5;

    return (
      <div style={{
        backgroundColor:D.bg2, borderRadius:6,
        border: isSelected ? `1.5px solid ${accentColor}` : `1px solid ${D.border}`,
        boxShadow: isSelected ? `0 0 14px ${netExp>=0?'rgba(249,168,37,0.15)':'rgba(171,71,188,0.15)'}` : 'none',
        display:'flex', flexDirection:'column', overflow:'hidden', cursor:'pointer',
        height:'100%', minHeight:0,
      }} onClick={() => setSelectedDex(tickerKey)}>

        {/* Search bar */}
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',backgroundColor:D.bg3,borderBottom:`1px solid ${D.border}`}}>
          <span style={{fontSize:10,color:D.muted}}>🔍</span>
          <input
            value={inputs[idx]} placeholder={tickerKey}
            onChange={e=>handleInput(idx,e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleSubmit(idx)}
            onClick={e=>e.stopPropagation()}
            style={{backgroundColor:'transparent',border:'none',outline:'none',color:D.text,fontSize:11,fontWeight:700,width:50,flexShrink:0}}
          />
          <span style={{fontSize:10,color:D.muted2,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{COMPANY_NAMES[tickerKey]||tickerKey}</span>
          <span style={{fontSize:10,color:D.muted2,cursor:'pointer'}} onClick={e=>{e.stopPropagation();handleInput(idx,'');}}>✕</span>
        </div>

        {/* Price + sparkline */}
        <div style={{display:'flex',alignItems:'center',padding:'7px 10px 5px',gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:20,fontWeight:900,color:D.text,letterSpacing:'-0.5px',lineHeight:1}}>{base.toFixed(2)}</div>
            <div style={{fontSize:11,fontWeight:600,color:isPos?'#00e676':'#ff5252',marginTop:2}}>
              {isPos?'+':''}{chg.v} ({isPos?'+':''}{chg.p}%)
            </div>
          </div>
          <Sparkline positive={isPos} width={80} height={22}/>
        </div>

        {/* Net exposure color bar */}
        <div style={{padding:'0 10px 6px'}}>
          <div style={{height:5,borderRadius:3,overflow:'hidden',backgroundColor:D.bg3}}>
            <div style={{
              height:'100%',
              width:`${Math.min(Math.abs(netExp)/4000000*100,100)}%`,
              backgroundColor:accentColor,
              borderRadius:3,
              boxShadow:`0 0 6px ${accentColor}`,
            }}/>
          </div>
        </div>

        {/* Column headers */}
        <div style={{display:'flex',padding:'2px 8px',borderTop:`1px solid ${D.border}`,borderBottom:`1px solid ${D.border}`}}>
          <span style={{width:46,fontSize:9,color:D.muted,textAlign:'right',paddingRight:6,fontWeight:700,flexShrink:0}}>STRIKE</span>
          <span style={{flex:1,fontSize:9,color:D.muted,textAlign:'center',fontWeight:700}}>GEX</span>
          <span style={{width:58,fontSize:9,color:D.muted,textAlign:'right',fontWeight:700,paddingRight:2,flexShrink:0}}></span>
        </div>

        {/* GEX rows */}
        <div style={{flex:1,overflowY:'hidden',padding:'2px 8px 4px',display:'flex',flexDirection:'column'}}>
          {rows.map(row => {
            const pW = Math.min(Math.abs(row.gex)/2000000, 1);
            const col = getBarColor(row.gex, netExp);
            const isBarPos = row.gex >= 0;
            const isSpot = Math.abs(row.strike - base) < 3;
            const isFlip = Math.abs(row.strike - gammaFlip) < 3;

            return (
              <div key={row.strike} style={{
                display:'flex', alignItems:'center', flex:1, minHeight:0,
                borderRadius:2,
                backgroundColor: isSpot ? `${accentColor}14` : isFlip ? 'rgba(255,82,82,0.05)' : 'transparent',
              }}>
                <div style={{width:46,fontSize:10,textAlign:'right',paddingRight:6,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:2}}>
                  {isSpot && <span style={{fontSize:7,color:accentColor}}>●</span>}
                  {isFlip && !isSpot && <span style={{fontSize:7,color:'#ff5252'}}>⚡</span>}
                  <span style={{
                    color: isSpot ? accentColor : isFlip ? '#ff5252' : D.muted,
                    fontWeight: isSpot||isFlip ? 700 : 400,
                    fontSize:10,
                  }}>{row.strike}</span>
                </div>
                <div style={{flex:1,height:14,position:'relative',backgroundColor:D.bg3,borderRadius:3}}>
                  <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,backgroundColor:D.border,zIndex:1}}/>
                  {isBarPos
                    ? <div style={{position:'absolute',left:'50%',top:2,bottom:2,width:`${pW*50}%`,backgroundColor:col,borderRadius:'0 2px 2px 0',boxShadow:row.isKing?`0 0 6px ${col}`:undefined}}/>
                    : <div style={{position:'absolute',right:'50%',top:2,bottom:2,width:`${pW*50}%`,backgroundColor:col,borderRadius:'2px 0 0 2px',boxShadow:row.isKing?`0 0 6px ${col}`:undefined}}/>
                  }
                  {row.isKing && <span style={{position:'absolute',top:1,right:2,fontSize:6,color:accentColor,fontWeight:800}}>★</span>}
                </div>
                <div style={{width:58,fontSize:10,fontWeight:600,textAlign:'right',flexShrink:0,color:isBarPos?'#00e676':'#ff5252',paddingRight:2}}>
                  {fmt(row.gex)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scale bar */}
        <div style={{display:'flex',alignItems:'center',padding:'4px 8px',borderTop:`1px solid ${D.border}`,gap:4}}>
          <span style={{fontSize:8,color:D.muted2}}>-1.0M</span>
          <div style={{flex:1,height:4,background:netExp>=0
            ?'linear-gradient(to right,#2a1a00,#7f5000,#f9a825,#ffe57f)'
            :'linear-gradient(to right,#1a0033,#4a148c,#7b1fa2,#ce93d8)',
            borderRadius:2}}/>
          <span style={{fontSize:8,color:D.muted2}}>+1.0M</span>
        </div>
      </div>
    );
  };

  // ── DEX MATRIX ──
  const DexMatrix = () => {
    const selBase = bases[selectedDex]||100;
    const selData = gexData[selectedDex];
    const netExp = selData?.netExp||0;
    const accentColor = netExp>=0?'#f9a825':'#ab47bc';
    const flip = (selBase*0.985).toFixed(2);
    const callWall = (selBase*1.025).toFixed(2);
    const putWall = (selBase*0.965).toFixed(2);
    const ivRank = Math.floor(Math.random()*100);
    const expMove = (selBase*0.015).toFixed(2);
    const chg = changes[selectedDex]||{v:'0',p:'0'};
    const chgIsPos = Number(chg.p)>=0;

    return (
      <div style={{backgroundColor:D.bg2,borderRadius:6,border:`1px solid ${D.border}`,display:'flex',flexDirection:'column',overflow:'hidden',height:'100%',minHeight:0,width:'100%'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 12px',borderBottom:`1px solid ${D.border}`,flexShrink:0,backgroundColor:D.bg3}}>
          <span style={{fontSize:12,fontWeight:800,color:accentColor}}>⚡ {selectedDex} — Dealer Exposure (Swing Mode)</span>
          <div style={{display:'flex',gap:6}}>
            <select value={dexExposure} onChange={e=>setDexExposure(e.target.value)} style={{backgroundColor:D.bg2,border:`1px solid ${D.border}`,borderRadius:4,color:D.muted,fontSize:9,padding:'3px 8px',outline:'none',cursor:'pointer'}}>
              {['Premium','Delta','Gamma','Vega'].map(o=><option key={o}>{o}</option>)}
            </select>
            <select value={dexView} onChange={e=>setDexView(e.target.value)} style={{backgroundColor:D.bg2,border:`1px solid ${D.border}`,borderRadius:4,color:D.muted,fontSize:9,padding:'3px 8px',outline:'none',cursor:'pointer'}}>
              {['Full Matrix','Calls Only','Puts Only','Net Only'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Key levels */}
        <div style={{display:'flex',gap:0,borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
          {[
            {l:'Gamma Flip',v:`$${flip}`,c:'#ff5252'},
            {l:'Call Wall',v:`$${callWall}`,c:'#00e676'},
            {l:'Put Wall',v:`$${putWall}`,c:'#ab47bc'},
            {l:'IV Rank',v:ivRank,c:'#f9a825'},
            {l:'Exp Move',v:`±$${expMove}`,c:'#00bcd4'},
          ].map((k,i)=>(
            <div key={k.l} style={{flex:1,padding:'5px 8px',textAlign:'center',borderRight:i<4?`1px solid ${D.border}`:'none'}}>
              <div style={{fontSize:8,color:D.muted2,marginBottom:2,textTransform:'uppercase',letterSpacing:'0.4px'}}>{k.l}</div>
              <div style={{fontSize:11,fontWeight:800,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Matrix */}
        <div style={{overflowX:'auto',overflowY:'auto',flex:1}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
            <thead>
              <tr style={{backgroundColor:D.bg3,position:'sticky',top:0,zIndex:1}}>
                <th style={{padding:'5px 10px',color:D.muted,fontWeight:700,textAlign:'left',fontSize:9,borderBottom:`1px solid ${D.border}`,minWidth:55}}>STRIKE</th>
                {EXPIRATIONS.map(e=><th key={e} style={{padding:'5px 4px',color:D.muted,fontWeight:700,textAlign:'center',fontSize:9,borderBottom:`1px solid ${D.border}`,minWidth:55}}>{e}</th>)}
                <th style={{padding:'5px 6px',color:D.muted2,fontWeight:700,textAlign:'right',fontSize:9,borderBottom:`1px solid ${D.border}`,minWidth:60}}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {dexData.map((row,ri)=>(
                <tr key={row.strike} style={{backgroundColor:ri%2===0?'transparent':D.bg3+'44'}}>
                  <td style={{padding:'3px 10px',color:D.muted,fontWeight:700,fontSize:10,borderRight:`1px solid ${D.border}`,whiteSpace:'nowrap'}}>{row.strike}</td>
                  {EXPIRATIONS.map(exp=>{
                    const v = row.cells[exp]||0;
                    const {bg,color} = dexCellStyle(v);
                    return <td key={exp} style={{padding:'3px 4px',textAlign:'center',fontSize:9,fontWeight:700,borderLeft:`1px solid ${D.border}22`,height:21,backgroundColor:bg,color}}>{v?fmt(v):''}</td>;
                  })}
                  <td style={{padding:'3px 8px',textAlign:'right',fontSize:10,fontWeight:800,color:row.rowTotal>=0?'#f9a825':'#ab47bc'}}>{fmt(row.rowTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{display:'flex',alignItems:'center',padding:'5px 10px',borderTop:`1px solid ${D.border}`,flexShrink:0}}>
          <span style={{fontSize:8,color:D.muted2}}>Lowest Exposure</span>
          <div style={{flex:1,height:5,background:'linear-gradient(to right,#1a0033,#6a1b9a,#2a1a00,#f9a825,#ffe57f)',borderRadius:3,margin:'0 10px'}}/>
          <span style={{fontSize:8,color:D.muted2}}>Highest Exposure</span>
        </div>

        {/* Stats bar */}
        <div style={{display:'flex',borderTop:`1px solid ${D.border}`,flexShrink:0}}>
          {[
            {l:'Spot Price',v:selBase.toFixed(2),c:D.text},
            {l:'Change',v:`${chgIsPos?'+':''}${chg.v} (${chgIsPos?'+':''}${chg.p}%)`,c:chgIsPos?'#00e676':'#ff5252'},
            {l:'IV Rank',v:ivRank,c:'#f9a825'},
            {l:'Put/Call OI',v:(0.7+Math.random()*0.5).toFixed(2),c:'#ab47bc'},
            {l:'Total GEX',v:fmt(netExp),c:netExp>=0?'#f9a825':'#ab47bc'},
            {l:'Net Dealer Exp',v:fmt(netExp*0.7),c:netExp>=0?'#00e676':'#ff5252'},
          ].map((s,i)=>(
            <div key={s.l} style={{flex:1,padding:'6px 6px',textAlign:'center',borderRight:i<5?`1px solid ${D.border}`:'none'}}>
              <div style={{fontSize:8,color:D.muted2,marginBottom:2}}>{s.l}</div>
              <div style={{fontSize:12,fontWeight:900,color:s.c,letterSpacing:'-0.3px'}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── SCORECARDS + FLOW ──
  const ScorecardsFlow = () => (
    <div style={{backgroundColor:D.bg2,borderRadius:6,border:`1px solid ${D.border}`,display:'flex',flexDirection:'column',overflow:'hidden',height:'100%',minHeight:0,width:'100%'}}>
      {/* Scorecards */}
      <div style={{display:'flex',gap:5,padding:'8px',flexShrink:0}}>
        {tickers.map(k=>{
          const sc=scores[k]||0;
          const scColor=sc>=75?'#00e676':sc>=60?'#f9a825':'#ff5252';
          const netExp=gexData[k]?.netExp||0;
          const tr=netExp>=0;
          return (
            <div key={k} style={{flex:1,backgroundColor:D.bg3,borderRadius:5,padding:'6px 8px',border:`1px solid ${D.border}`}}>
              <div style={{fontSize:10,color:D.muted,letterSpacing:'1px',fontWeight:700,marginBottom:4}}>{k}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:3}}>
                <span style={{fontSize:22,fontWeight:900,color:scColor,lineHeight:1,letterSpacing:'-1px'}}>{sc}</span>
                <span style={{fontSize:15,fontWeight:700,color:D.muted,lineHeight:1}}>{getGrade(sc)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:D.muted2}}>
                <span>Score</span>
                <span style={{color:tr?'#00e676':'#ff5252',fontWeight:700}}>{tr?'▲ Bullish':'▼ Bearish'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Flow header + filters */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',borderTop:`1px solid ${D.border}`,borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,color:D.accent}}>LIVE OPTIONS FLOW</span>
        <div style={{display:'flex',gap:3}}>
          {['ALL','CALL','PUT','SWEEP','BLOCK'].map(f=>(
            <span key={f} onClick={()=>setFlowFilter(f)} style={{fontSize:9,padding:'2px 6px',borderRadius:3,border:`1px solid ${flowFilter===f?D.accent:D.border}`,cursor:'pointer',fontWeight:700,backgroundColor:flowFilter===f?D.bg3:'transparent',color:flowFilter===f?D.accent:D.muted2}}>{f}</span>
          ))}
        </div>
      </div>

      {/* Flow table */}
      <div style={{overflowY:'auto',flex:1}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead>
            <tr style={{backgroundColor:D.bg3}}>
              {['TIME','SYM','STRIKE','C/P','EXP','DTE','PRICE','SIZE','SENT','COND','PREM'].map(h=>(
                <th key={h} style={{padding:'4px 5px',color:D.muted2,fontWeight:700,textAlign:'left',position:'sticky',top:0,fontSize:9,whiteSpace:'nowrap',borderBottom:`1px solid ${D.border}`,backgroundColor:D.bg3}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredFlow.slice(0,40).map((r,i)=>(
              <tr key={i} style={{backgroundColor:r.unusual?`${D.accent}08`:i%2?D.bg3+'44':'transparent'}}>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted2,whiteSpace:'nowrap'}}>{r.ts}</td>
                <td style={{padding:'3px 5px',fontSize:10,fontWeight:800,color:D.text,whiteSpace:'nowrap'}}>{r.ticker}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{r.strike}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:r.type==='CALL'?'#00e676':'#ff5252',fontWeight:700,whiteSpace:'nowrap'}}>{r.type}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{r.exp}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{r.dte}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>${r.price}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:r.unusual?D.accent:D.muted,whiteSpace:'nowrap'}}>{r.size}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:r.sent==='ASK'?'#00e676':r.sent==='BID'?'#ff5252':D.muted2,fontWeight:700,whiteSpace:'nowrap'}}>{r.sent}</td>
                <td style={{padding:'3px 5px',whiteSpace:'nowrap'}}>
                  <span style={{fontSize:8,fontWeight:800,padding:'1px 4px',borderRadius:2,
                    backgroundColor:r.cond==='SWEEP'?'#7f5000':r.cond==='BLOCK'?'#0d2050':'#1a3020',
                    color:r.cond==='SWEEP'?'#ffcc02':r.cond==='BLOCK'?'#6699ff':'#66cc88',
                    border:`1px solid ${r.cond==='SWEEP'?'#a06000':r.cond==='BLOCK'?'#1a3a7a':'#1a4a2a'}`
                  }}>{r.cond}</span>
                </td>
                <td style={{padding:'3px 5px',fontSize:10,fontWeight:700,color:r.isBull?'#00e676':'#ff5252',whiteSpace:'nowrap'}}>{fmt(r.prem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── GOLDEN SWEEPS ──
  const GoldenSweeps = () => (
    <div style={{backgroundColor:D.bg2,borderRadius:6,border:`1px solid ${D.border}`,display:'flex',flexDirection:'column',overflow:'hidden',height:'100%',minHeight:0,width:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,color:D.accent}}>🔥 GOLDEN SWEEPS — INSTITUTIONAL FLOW</span>
        <span style={{fontSize:12,color:D.muted2,cursor:'pointer'}}>⬇</span>
      </div>
      <div style={{display:'flex',gap:4,padding:'5px 8px',borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
        {['ALL','CALL','PUT','SWEEP','BLOCK'].map(f=>(
          <span key={f} onClick={()=>setSweepFilter(f)} style={{fontSize:9,padding:'2px 8px',borderRadius:3,border:`1px solid ${sweepFilter===f?D.accent:D.border}`,cursor:'pointer',fontWeight:700,backgroundColor:sweepFilter===f?D.bg3:'transparent',color:sweepFilter===f?D.accent:D.muted2}}>{f}</span>
        ))}
      </div>
      <div style={{overflowY:'auto',flex:1}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead>
            <tr style={{backgroundColor:D.bg3}}>
              {['TIME','SYM','STRIKE','TYPE','EXP','DTE','PREM','SIZE','COND','GRADE'].map(h=>(
                <th key={h} style={{padding:'4px 5px',color:D.muted2,fontWeight:700,textAlign:'left',position:'sticky',top:0,fontSize:9,whiteSpace:'nowrap',borderBottom:`1px solid ${D.border}`,backgroundColor:D.bg3}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSweeps.map((s,i)=>(
              <tr key={i} style={{backgroundColor:i%2?D.bg3+'44':'transparent'}}>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted2,whiteSpace:'nowrap'}}>{s.ts}</td>
                <td style={{padding:'3px 5px',fontSize:10,fontWeight:800,color:D.text,whiteSpace:'nowrap'}}>{s.ticker}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{s.strike}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:s.isBull?'#00e676':'#ff5252',fontWeight:700,whiteSpace:'nowrap'}}>{s.type}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{s.exp}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{s.dte}</td>
                <td style={{padding:'3px 5px',fontSize:10,fontWeight:700,color:s.isBull?'#00e676':'#ff5252',whiteSpace:'nowrap'}}>{fmt(s.prem)}</td>
                <td style={{padding:'3px 5px',fontSize:10,color:D.muted,whiteSpace:'nowrap'}}>{s.size}</td>
                <td style={{padding:'3px 5px',whiteSpace:'nowrap'}}>
                  <span style={{fontSize:8,fontWeight:800,padding:'1px 4px',borderRadius:2,
                    backgroundColor:s.cond==='SWEEP'?'#7f5000':'#0d2050',
                    color:s.cond==='SWEEP'?'#ffcc02':'#6699ff',
                    border:`1px solid ${s.cond==='SWEEP'?'#a06000':'#1a3a7a'}`
                  }}>{s.cond}</span>
                </td>
                <td style={{padding:'3px 5px',whiteSpace:'nowrap'}}>
                  <span style={{fontSize:9,fontWeight:900,padding:'1px 5px',borderRadius:3,
                    backgroundColor:s.grade==='A+'?'#f9a825':s.grade==='A'?'#005a3a':s.grade==='B+'?'#0a2050':'#1a2332',
                    color:s.grade==='A+'?'#000':'#fff'
                  }}>{s.grade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{padding:'4px 8px',borderTop:`1px solid ${D.border}`,fontSize:8,color:D.muted2,display:'flex',justifyContent:'space-between',flexShrink:0}}>
        <span>Grades reflect premium size, sentiment & market impact.</span>
        <span>Updated: {lastUpdated}</span>
      </div>
    </div>
  );

  // ── AI NARRATIVE ──
  const Narrative = () => (
    <div style={{backgroundColor:D.bg2,borderRadius:6,border:`1px solid ${D.border}`,padding:'10px 14px',display:'flex',alignItems:'flex-start',gap:10,height:'100%',boxSizing:'border-box'}}>
      <span style={{fontSize:16,flexShrink:0}}>🤖</span>
      <div>
        <div style={{fontSize:10,fontWeight:700,color:D.accent,marginBottom:5,letterSpacing:'0.5px'}}>AI NARRATIVE — {selectedDex}</div>
        <div style={{fontSize:11,color:D.muted,lineHeight:1.7}}>{narrative||'Generating analysis…'}</div>
      </div>
    </div>
  );

  // ── NEWS FEED ──
  const NewsFeed = () => (
    <div style={{backgroundColor:D.bg2,borderRadius:6,border:`1px solid ${D.border}`,display:'flex',flexDirection:'column',overflow:'hidden',height:'100%',minHeight:0,width:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:700,color:D.accent}}>🐦 MARKET NEWS</span>
        <span style={{fontSize:8,color:D.muted2}}>Mock · Wire X API for live</span>
      </div>
      <div style={{overflowY:'auto',flex:1}}>
        {MOCK_NEWS.map((n,i)=>(
          <div key={i} style={{display:'flex',gap:8,padding:'7px 10px',borderBottom:`1px solid ${D.border}33`,alignItems:'flex-start'}}>
            <div style={{width:3,borderRadius:2,alignSelf:'stretch',backgroundColor:n.bull?'#00e676':'#ff5252',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:8,marginBottom:2,alignItems:'center'}}>
                <span style={{fontSize:10,fontWeight:700,color:D.accent}}>{n.src}</span>
                <span style={{fontSize:9,color:D.muted2}}>{n.time}</span>
              </div>
              <div style={{fontSize:11,color:D.text,lineHeight:1.5}}>{n.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'IBM Plex Mono','Courier New',monospace",backgroundColor:D.bg,minHeight:'100vh',display:'flex',flexDirection:'column',color:D.text}}>

      {/* TOP BAR */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px',backgroundColor:D.bg2,borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
        <span style={{fontSize:16,color:'#f9a825'}}>⚡</span>
        <span style={{fontSize:14,fontWeight:900,color:D.text,letterSpacing:'-0.5px'}}>SmartMoney Flow</span>
        <span style={{fontSize:9,color:D.muted2,marginLeft:4}}>Mock Data · {loading?'Fetching…':`Updated: ${lastUpdated}`}</span>
        <div style={{display:'flex',gap:5,marginLeft:14}}>
          {tickers.map(t=>{
            const b=bases[t]||0; const c=changes[t]||{v:'0',p:'0'}; const isP=Number(c.p)>=0;
            return (
              <span key={t} style={{fontSize:10,padding:'3px 10px',backgroundColor:D.bg3,borderRadius:4,border:`1px solid ${D.border}`,display:'flex',alignItems:'center',gap:5}}>
                <span style={{color:D.muted,fontWeight:600}}>{t}</span>
                <span style={{color:D.text,fontWeight:800}}>{b.toFixed(2)}</span>
                <span style={{color:isP?'#00e676':'#ff5252',fontSize:9}}>{isP?'+':''}{c.p}%</span>
              </span>
            );
          })}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto'}}>
          <span style={{fontSize:9,color:'#00e676',display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:6,height:6,borderRadius:'50%',backgroundColor:'#00e676',boxShadow:'0 0 5px #00e676',display:'inline-block'}}/>
            API Connected
          </span>
          <span onClick={()=>setDarkMode(!darkMode)} style={{fontSize:9,padding:'3px 10px',border:`1px solid ${D.border}`,borderRadius:4,backgroundColor:D.bg3,cursor:'pointer',color:D.muted}}>{darkMode?'☀ Light':'🌙 Dark'}</span>
          <button onClick={refresh} disabled={loading} style={{padding:'4px 12px',borderRadius:4,border:`1px solid ${D.border}`,backgroundColor:D.bg3,fontSize:10,fontWeight:700,color:D.muted,cursor:'pointer'}}>↻ Refresh</button>
        </div>
      </div>

      {/* GRID */}
      <div style={{
        flex:1,
        display:'grid',
        gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) minmax(0,2.2fr)',
        gridTemplateRows:'45vh 45vh 10vh',
        gap:5,
        padding:5,
        height:'calc(100vh - 44px)',
        width:'100%',
        boxSizing:'border-box',
        overflow:'hidden',
      }}>
        <GexBox tickerKey={tickers[0]} idx={0}/>
        <GexBox tickerKey={tickers[1]} idx={1}/>
        <DexMatrix/>
        <GexBox tickerKey={tickers[2]} idx={2}/>
        <ScorecardsFlow/>
        <GoldenSweeps/>
        <Narrative/>
        <div style={{gridColumn:'2/4',overflow:'hidden'}}><NewsFeed/></div>
      </div>
    </div>
  );
};

export default SmartMoneyDashboard;
