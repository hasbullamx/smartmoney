import React, { useState, useEffect, useCallback, useRef } from 'react';

const EXPIRATIONS = ['0DTE','1DTE','2DTE','3DTE','7DTE','14DTE','21DTE','30DTE','45DTE','60DTE','90DTE'];
const MARKET_TICKERS = ['SPY','QQQ','AAPL','NVDA','TSLA','AMZN','MSFT','META','AMD','GOOGL','NFLX','COIN','MSTR','PLTR','ARM','UBER','SOFI','HOOD','SHOP','BABA'];
const COMPANY_NAMES = { SPX:'S&P 500 Index', SPY:'SPDR S&P 500 ETF', QQQ:'Invesco QQQ Trust', NVDA:'NVIDIA Corporation', AAPL:'Apple Inc.', TSLA:'Tesla Inc.', AMZN:'Amazon.com', MSFT:'Microsoft Corp.', META:'Meta Platforms', AMD:'Advanced Micro Devices', GOOGL:'Alphabet Inc.' };
const DEFAULT_BASE = { SPX:5797, SPY:523, QQQ:458, NVDA:1224, AAPL:234, TSLA:310, AMZN:185, MSFT:415, META:520, AMD:155, GOOGL:175 };
const CONDITIONS = ['SWEEP','BLOCK','SPLIT'];
const SENTIMENTS = ['ASK','BID','MID'];
const REGIMES = [
  { label:'Negative Gamma', sub:'Dealers short gamma — vol expansion likely', color:'#f44336' },
  { label:'Positive Gamma', sub:'Dealers long gamma — market likely to pin', color:'#4caf50' },
  { label:'Volatility Expansion Risk', sub:'Gamma near zero — explosive move possible', color:'#ff9800' },
  { label:'Dealer Long Gamma', sub:'Strong hedge buying supports price', color:'#00bcd4' },
  { label:'Pinning Environment', sub:'Max pain gravity active', color:'#9c27b0' },
];

const fmt = (p) => {
  if (!p && p!==0) return '$0';
  const a=Math.abs(p), s=p<0?'-':'';
  if (a>=1000000) return `${s}$${(a/1e6).toFixed(1)}M`;
  if (a>=1000) return `${s}$${(a/1000).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const getGrade = s => s>=90?'A+':s>=80?'A':s>=70?'B+':s>=60?'B':'C';

const getGexRowColor = (gex) => {
  const a = Math.abs(gex);
  if (gex > 0) {
    if (a > 800000) return '#f9a825';
    if (a > 400000) return '#66bb6a';
    return '#2e7d32';
  } else {
    if (a > 800000) return '#e91e63';
    if (a > 400000) return '#7b1fa2';
    return '#4a148c';
  }
};

const dexCellStyle = (val) => {
  const a = Math.abs(val);
  if (a < 60000) return { bg:'transparent', color:'#444' };
  if (val > 0) {
    if (a < 300000) return { bg:'#1b5e20', color:'#a5d6a7' };
    if (a < 700000) return { bg:'#2e7d32', color:'#c8e6c9' };
    if (a < 1200000) return { bg:'#388e3c', color:'#fff' };
    return { bg:'#f9a825', color:'#000' };
  } else {
    if (a < 300000) return { bg:'#1a0033', color:'#9c27b0' };
    if (a < 700000) return { bg:'#38006b', color:'#e1bee7' };
    if (a < 1200000) return { bg:'#6a1b9a', color:'#fff' };
    return { bg:'#e91e63', color:'#fff' };
  }
};

const genGexRows = (base) => {
  const bs = Math.floor(base/5)*5;
  return Array.from({length:21}, (_,i) => {
    const strike = bs + (10-i)*5;
    const gex = (Math.random()-0.45)*1500000;
    const pctChg = Math.round((Math.random()-0.4)*500);
    return { strike, gex, pctChg };
  });
};

const genDex = (base) => {
  const bs = Math.floor(base/5)*5;
  return Array.from({length:21}, (_,idx) => {
    const strike = bs + (10-idx)*5;
    const cells = {};
    EXPIRATIONS.forEach(e => { const v=(Math.random()-0.45)*1500000; cells[e]=Math.abs(v)<80000?0:v; });
    return { strike, cells, rowTotal: Object.values(cells).reduce((s,v)=>s+v,0) };
  });
};

const genFlow = () => {
  const now = new Date();
  return Array.from({length:80}, (_,i) => {
    const ticker = MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
    const base = DEFAULT_BASE[ticker]||100;
    const strike = Math.floor(base/5)*5+(Math.floor(Math.random()*10)-5)*5;
    const type = Math.random()>0.5?'CALL':'PUT';
    const sent = SENTIMENTS[Math.floor(Math.random()*3)];
    const cond = CONDITIONS[Math.floor(Math.random()*3)];
    const size = Math.floor(Math.random()*900+50);
    const price = (Math.random()*8+0.1).toFixed(2);
    const prem = price*size*100;
    const isBull = (type==='CALL'&&sent==='ASK')||(type==='PUT'&&sent==='BID');
    const t = new Date(now.getTime()-i*11000);
    const ts = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    return { ticker,strike,type,sent,cond,size,price,prem,isBull,ts };
  });
};

const genSweeps = () => Array.from({length:25}, (_,i) => {
  const ticker = MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
  const base = DEFAULT_BASE[ticker]||100;
  const strike = Math.floor(base/5)*5+(Math.floor(Math.random()*10)-5)*5;
  const isBull = Math.random()>0.45;
  const score = Math.floor(Math.random()*35)+65;
  const prem = Math.random()*2000000+400000;
  const size = Math.floor(Math.random()*1200+200);
  const cond = Math.random()>0.5?'SWEEP':'BLOCK';
  const now = new Date();
  const t = new Date(now.getTime()-i*20000);
  const ts = t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  return { ticker,strike,type:isBull?'CALL':'PUT',prem,size,score,grade:getGrade(score),isBull,cond,ts };
}).sort((a,b)=>b.prem-a.prem);

const SmartMoneyDashboard = () => {
  const [ticker1, setTicker1] = useState('SPX');
  const [ticker2, setTicker2] = useState('SPY');
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');
  const [bases, setBases] = useState({SPX:5797,SPY:523});
  const [changes, setChanges] = useState({SPX:{v:'-8.17',p:'-0.14',pos:false},SPY:{v:'+11.29',p:'+2.16',pos:true}});
  const [gex1, setGex1] = useState([]);
  const [gex2, setGex2] = useState([]);
  const [scores, setScores] = useState({SPX:60,SPY:78});
  const [dexData, setDexData] = useState([]);
  const [detailTicker, setDetailTicker] = useState('SPY');
  const [flow, setFlow] = useState([]);
  const [sweeps, setSweeps] = useState([]);
  const [rightTab, setRightTab] = useState('flow');
  const [flowFilter, setFlowFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    setLoading(true);
    const nb={}, nc={};
    [[ticker1,setGex1],[ticker2,setGex2]].forEach(([t,setG]) => {
      const b = (DEFAULT_BASE[t]||100)+(Math.random()-0.5)*10;
      nb[t] = b;
      const chg = (Math.random()-0.5)*20;
      const pos = chg>=0;
      nc[t] = { v:(pos?'+':'')+chg.toFixed(2), p:(pos?'+':'')+((chg/b)*100).toFixed(2), pos };
      setG(genGexRows(b));
    });
    setBases(nb); setChanges(nc);
    setScores({ [ticker1]:Math.floor(Math.random()*35)+55, [ticker2]:Math.floor(Math.random()*35)+60 });
    setDexData(genDex(nb[detailTicker]||nb[ticker1]||100));
    setFlow(genFlow());
    setSweeps(genSweeps());
    setLastUpdated(new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
    setLoading(false);
  }, [ticker1, ticker2, detailTicker]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 60000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  const submitTicker = (val, setter, inputSetter) => {
    if (val.trim()) { setter(val.toUpperCase()); inputSetter(''); }
  };

  const filteredFlow = flow.filter(r => flowFilter==='ALL'||r.type===flowFilter||r.cond===flowFilter);
  const filteredSweeps = sweeps.filter(r => flowFilter==='ALL'||r.type===flowFilter||r.cond===flowFilter);

  const BG = '#0d1117', BG2 = '#161b22', BG3 = '#1c2333';
  const TEXT = '#e6edf3', MUTED = '#7d8590', MUTED2 = '#3d444d', BORDER = '#30363d';

  // ── GEX COLUMN ──
  const GexColumn = ({ tickerKey, gexRows, inputVal, setInput, onSubmit }) => {
    const base = bases[tickerKey]||100;
    const chg = changes[tickerKey]||{v:'0',p:'0',pos:true};
    const score = scores[tickerKey]||0;
    const maxGex = gexRows.length ? Math.max(...gexRows.map(r=>Math.abs(r.gex)),1) : 1;
    const putWall = Math.round(base*0.965/5)*5;
    const flip = Math.round(base*0.985/5)*5;
    const callWall = Math.round(base*1.025/5)*5;

    return (
      <div style={{backgroundColor:BG2,borderRadius:8,border:`1px solid ${BORDER}`,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {/* Header */}
        <div style={{padding:'14px 16px 12px',borderBottom:`1px solid ${BORDER}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:24,fontWeight:900,color:TEXT}}>{tickerKey}</span>
              <span style={{fontSize:12,color:MUTED}}>{COMPANY_NAMES[tickerKey]||tickerKey}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{backgroundColor:BG3,border:`2px solid ${score>=70?'#f9a825':score>=60?'#4caf50':'#888'}`,borderRadius:6,padding:'4px 12px',textAlign:'center',minWidth:70}}>
                <div style={{fontSize:8,color:MUTED,letterSpacing:'1px',marginBottom:1}}>FLOW SCORE</div>
                <div style={{fontSize:22,fontWeight:900,color:score>=70?'#f9a825':score>=60?'#4caf50':'#888',lineHeight:1}}>{score}</div>
              </div>
              <input value={inputVal} placeholder="Change…"
                onChange={e=>setInput(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==='Enter'&&onSubmit()}
                style={{width:80,backgroundColor:BG3,border:`1px solid ${BORDER}`,borderRadius:5,color:TEXT,fontSize:11,padding:'5px 8px',outline:'none'}}
              />
            </div>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:10}}>
            <span style={{fontSize:36,fontWeight:900,color:TEXT,letterSpacing:'-1px',lineHeight:1}}>{base.toFixed(2)}</span>
            <span style={{fontSize:14,fontWeight:600,color:chg.pos?'#4caf50':'#f44336'}}>
              {chg.pos?'▲':'▼'} {chg.v} ({chg.p}%)
            </span>
          </div>
          {/* Key levels */}
          <div style={{display:'flex',gap:24}}>
            {[{l:'PUT WALL',v:`$${putWall}`,c:'#f44336',sub:'-3.50%'},{l:'GAMMA FLIP',v:`$${flip}`,c:'#ff9800',sub:`${(base-flip).toFixed(2)} pts`},{l:'CALL WALL',v:`$${callWall}`,c:'#4caf50',sub:'+2.50%'}].map(k=>(
              <div key={k.l}>
                <div style={{fontSize:9,color:MUTED,letterSpacing:'0.8px',marginBottom:2}}>{k.l}</div>
                <div style={{fontSize:14,fontWeight:800,color:k.c}}>{k.v}</div>
                <div style={{fontSize:9,color:MUTED}}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* GEX label row */}
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 16px 4px'}}>
          <span style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:'1px'}}>DAILY GEX PROFILE</span>
          <span style={{fontSize:9,color:MUTED2}}>21 strikes · max $1.0M · Δ since last 15m refresh</span>
        </div>

        {/* GEX rows */}
        <div style={{padding:'0 12px 12px'}}>
          {gexRows.map(row => {
            const pct = Math.abs(row.gex)/maxGex;
            const color = getGexRowColor(row.gex);
            const isSpot = Math.abs(row.strike-base)<3;
            return (
              <div key={row.strike} style={{display:'flex',alignItems:'center',height:26,marginBottom:2,gap:6}}>
                <div style={{width:44,fontSize:11,fontWeight:isSpot?800:400,color:isSpot?'#f9a825':MUTED,textAlign:'right',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:3}}>
                  {isSpot&&<span style={{fontSize:9,color:'#f9a825'}}>▶</span>}
                  {row.strike}
                </div>
                <div style={{flex:1,height:22,backgroundColor:BG3,borderRadius:3,overflow:'hidden',position:'relative'}}>
                  <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${pct*100}%`,backgroundColor:color,borderRadius:3,minWidth:4}}/>
                  <div style={{position:'absolute',right:8,top:0,height:'100%',display:'flex',alignItems:'center'}}>
                    <span style={{fontSize:11,fontWeight:700,color:'#fff',textShadow:'0 1px 3px rgba(0,0,0,0.9)'}}>{fmt(row.gex)}</span>
                  </div>
                </div>
                <div style={{width:56,fontSize:10,fontWeight:600,textAlign:'right',flexShrink:0,color:row.pctChg>=0?'#4caf50':'#f44336'}}>
                  {row.pctChg>=0?'▲':'▼'}{Math.abs(row.pctChg)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── DETAIL SECTION ──
  const DetailSection = () => {
    const base = bases[detailTicker]||100;
    const regime = REGIMES[Math.floor(Math.random()*REGIMES.length)];
    const ivRank = Math.floor(Math.random()*100);
    const expMove = (base*0.015).toFixed(2);
    const skew = Math.random()>0.5?'Put Skew':'Call Skew';
    const pcOI = (0.8+Math.random()*0.6).toFixed(2);
    const flip = (base*0.985).toFixed(2);
    const callWall = (base*1.025).toFixed(2);
    const putWall = (base*0.965).toFixed(2);
    const spotPct = Math.max(5,Math.min(90,((base-Number(putWall))/(Number(callWall)-Number(putWall)))*100));
    const flipPct = Math.max(5,Math.min(90,((Number(flip)-Number(putWall))/(Number(callWall)-Number(putWall)))*100));
    const bullAgg = Math.floor(Math.random()*30)+45;
    const bearAgg = 100-bullAgg;
    const smConf = Math.floor(Math.random()*25)+55;
    const buyPres = Math.floor(Math.random()*30)+50;
    const sellPres = 100-buyPres;
    const totalGex = fmt((Math.random()-0.5)*2000000);
    const netDex = fmt((Math.random()-0.4)*1500000);
    const conf = Math.floor(Math.random()*25)+70;

    return (
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {/* Detail header */}
        <div style={{fontSize:11,color:MUTED,padding:'2px 0'}}>
          DETAIL · <span style={{color:TEXT,fontWeight:700}}>{detailTicker}</span> <span style={{color:MUTED}}>({COMPANY_NAMES[detailTicker]||detailTicker})</span>
        </div>

        {/* Regime strip */}
        <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${regime.color}55`,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:9,height:9,borderRadius:'50%',backgroundColor:regime.color,boxShadow:`0 0 8px ${regime.color}`}}/>
            <span style={{fontSize:14,fontWeight:800,color:regime.color}}>{regime.label}</span>
            <span style={{fontSize:11,color:MUTED}}>{regime.sub}</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:MUTED,letterSpacing:'0.5px',marginBottom:1}}>CONFIDENCE</div>
            <div style={{fontSize:18,fontWeight:900,color:regime.color}}>{conf}%</div>
          </div>
        </div>

        {/* IV stats */}
        <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${BORDER}`,padding:'12px 16px'}}>
          <div style={{display:'flex',gap:0}}>
            {[{l:'IV RANK',v:ivRank,c:'#f9a825'},{l:'EXPECTED MOVE',v:`±$${expMove}`,c:'#00bcd4'},{l:'SKEW',v:skew,c:'#9c27b0'},{l:'P/C OI',v:pcOI,c:'#4caf50'}].map((k,i)=>(
              <div key={k.l} style={{flex:1,paddingLeft:i>0?16:0,borderLeft:i>0?`1px solid ${BORDER}`:'none'}}>
                <div style={{fontSize:9,color:MUTED,letterSpacing:'0.5px',marginBottom:6}}>{k.l}</div>
                <div style={{fontSize:24,fontWeight:900,color:k.c,lineHeight:1}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gamma flip meter */}
        <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${BORDER}`,padding:'12px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,color:MUTED,letterSpacing:'0.5px'}}>GAMMA FLIP METER</span>
              <span style={{fontSize:10,color:MUTED2,marginLeft:8}}>{detailTicker} positioning between walls</span>
            </div>
            <div style={{backgroundColor:'#f9a825',color:'#000',padding:'3px 10px',borderRadius:4,fontSize:10,fontWeight:700}}>
              Distance: {(base-Number(flip)).toFixed(2)} pts
            </div>
          </div>
          <div style={{position:'relative',height:14,borderRadius:7,background:'linear-gradient(to right,#b71c1c,#e53935,#ff9800,#66bb6a,#2e7d32)',marginBottom:10,overflow:'visible'}}>
            {/* Flip marker */}
            <div style={{position:'absolute',left:`${flipPct}%`,top:-6,bottom:-6,width:2,backgroundColor:'#ff9800',boxShadow:'0 0 8px #ff9800',zIndex:2,transform:'translateX(-50%)'}}/>
            <div style={{position:'absolute',left:`${flipPct}%`,top:-18,transform:'translateX(-50%)',fontSize:8,color:'#ff9800',fontWeight:700}}>FLIP</div>
            {/* Spot marker */}
            <div style={{position:'absolute',left:`${spotPct}%`,top:-8,transform:'translateX(-50%)',width:18,height:26,backgroundColor:'#f9a825',borderRadius:4,boxShadow:'0 0 10px #f9a825',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3}}>
              <span style={{fontSize:7,color:'#000',fontWeight:900}}>SPOT</span>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:12,fontSize:10}}>
            <span style={{color:'#f44336',fontWeight:600}}>PUT WALL ${putWall}</span>
            <span style={{color:'#ff9800',fontWeight:600}}>FLIP ${flip}</span>
            <span style={{color:'#4caf50',fontWeight:600}}>CALL WALL ${callWall}</span>
          </div>
        </div>

        {/* Flow intel + hedge pressure side by side */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${BORDER}`,padding:'12px 14px'}}>
            <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:'0.5px',marginBottom:12}}>FLOW INTELLIGENCE</div>
            {[{l:'Bull Aggression',v:bullAgg,c:'#4caf50'},{l:'Bear Aggression',v:bearAgg,c:'#f44336'},{l:'Smart Money Confidence',v:smConf,c:'#f9a825'}].map(b=>(
              <div key={b.l} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,color:TEXT}}>{b.l}</span>
                  <span style={{fontSize:13,fontWeight:800,color:b.c}}>{b.v}{b.l.includes('Conf')?'%':''}</span>
                </div>
                <div style={{height:6,backgroundColor:BG3,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${b.v}%`,backgroundColor:b.c,borderRadius:3}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${BORDER}`,padding:'12px 14px'}}>
            <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:'0.5px',marginBottom:12}}>DEALER HEDGING PRESSURE</div>
            {[{l:'Buy Pressure',v:buyPres,c:'#00bcd4'},{l:'Sell Pressure',v:sellPres,c:'#9c27b0'}].map(b=>(
              <div key={b.l} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,color:TEXT}}>{b.l}</span>
                  <span style={{fontSize:13,fontWeight:800,color:b.c}}>{b.v}%</span>
                </div>
                <div style={{height:6,backgroundColor:BG3,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${b.v}%`,backgroundColor:b.c,borderRadius:3}}/>
                </div>
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:16,paddingTop:12,borderTop:`1px solid ${BORDER}`}}>
              <div>
                <div style={{fontSize:9,color:MUTED,marginBottom:3,letterSpacing:'0.5px'}}>TOTAL GEX</div>
                <div style={{fontSize:18,fontWeight:900,color:'#f44336'}}>{totalGex}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:MUTED,marginBottom:3,letterSpacing:'0.5px'}}>NET DEX</div>
                <div style={{fontSize:18,fontWeight:900,color:'#4caf50'}}>{netDex}</div>
              </div>
            </div>
          </div>
        </div>

        {/* DEX Matrix */}
        <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${BORDER}`,overflow:'hidden'}}>
          <div style={{padding:'10px 14px',borderBottom:`1px solid ${BORDER}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:'0.5px'}}>DEALER EXPOSURE MATRIX</div>
              <div style={{fontSize:11,color:MUTED,marginTop:2}}>
                <span style={{color:TEXT,fontWeight:700}}>{detailTicker}</span> · strikes × expirations · premium-weighted
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <select style={{backgroundColor:BG3,border:`1px solid ${BORDER}`,borderRadius:5,color:TEXT,fontSize:11,padding:'5px 10px',outline:'none',cursor:'pointer'}}>
                {['Premium','Delta','Gamma','Vega'].map(o=><option key={o}>{o}</option>)}
              </select>
              <select style={{backgroundColor:BG3,border:`1px solid ${BORDER}`,borderRadius:5,color:TEXT,fontSize:11,padding:'5px 10px',outline:'none',cursor:'pointer'}}>
                {['Full Matrix','Calls Only','Puts Only'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{backgroundColor:BG3}}>
                  <th style={{padding:'6px 10px',textAlign:'left',color:MUTED,fontWeight:700,fontSize:10,borderBottom:`1px solid ${BORDER}`,minWidth:55}}>STRIKE</th>
                  {EXPIRATIONS.map(e=><th key={e} style={{padding:'6px 6px',textAlign:'center',color:MUTED,fontWeight:700,fontSize:10,borderBottom:`1px solid ${BORDER}`,minWidth:68}}>{e}</th>)}
                  <th style={{padding:'6px 10px',textAlign:'right',color:MUTED,fontWeight:700,fontSize:10,borderBottom:`1px solid ${BORDER}`,minWidth:68}}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {dexData.map((row,ri)=>{
                  const isSpot = Math.abs(row.strike-base)<3;
                  return (
                    <tr key={row.strike} style={{backgroundColor:isSpot?'rgba(249,168,37,0.08)':ri%2?BG3+'55':'transparent'}}>
                      <td style={{padding:'5px 10px',color:isSpot?'#f9a825':MUTED,fontWeight:isSpot?800:600,fontSize:11}}>
                        {isSpot&&<span style={{color:'#f9a825',marginRight:5,fontSize:9}}>●</span>}{row.strike}
                      </td>
                      {EXPIRATIONS.map(exp=>{
                        const v=row.cells[exp]||0;
                        const {bg,color}=dexCellStyle(v);
                        return <td key={exp} style={{padding:'5px 4px',textAlign:'center',fontSize:10,fontWeight:700,backgroundColor:bg,color,borderLeft:`1px solid ${BORDER}22`}}>{v?fmt(v):'·'}</td>;
                      })}
                      <td style={{padding:'5px 10px',textAlign:'right',fontSize:11,fontWeight:800,color:row.rowTotal>=0?'#4caf50':'#f44336'}}>{fmt(row.rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',alignItems:'center',padding:'6px 14px',borderTop:`1px solid ${BORDER}`}}>
            <span style={{fontSize:9,color:MUTED}}>Lowest</span>
            <div style={{flex:1,height:6,background:'linear-gradient(to right,#1a0033,#6a1b9a,#1b5e20,#388e3c,#f9a825)',borderRadius:3,margin:'0 12px'}}/>
            <span style={{fontSize:9,color:MUTED}}>Highest</span>
          </div>
        </div>

        {/* AI Narrative */}
        <div style={{backgroundColor:BG2,borderRadius:6,border:`1px solid ${BORDER}`,padding:'14px 16px',display:'flex',gap:12}}>
          <div style={{width:34,height:34,borderRadius:6,backgroundColor:BG3,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16,fontWeight:900,color:TEXT}}>+</div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,fontWeight:700,color:MUTED,letterSpacing:'0.5px',marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
              AI NARRATIVE
              <span style={{color:TEXT,fontWeight:700}}>{detailTicker}</span>
              <span style={{color:'#4caf50',fontSize:9}}>· live</span>
            </div>
            <div style={{fontSize:12,color:TEXT,lineHeight:1.8}}>
              {detailTicker} is operating in a {regime.label.toLowerCase()} regime above ${flip}. Dealer positioning favors mean reversion near current levels. Bullish call accumulation detected into upcoming expiration. Smart-money confidence sits at {smConf}%. The gamma flip at ${flip} is a key trigger — a breach forces dealer buying cascades. Watch ${putWall} as structural support.
            </div>
          </div>
        </div>
        <div style={{fontSize:9,color:MUTED2,textAlign:'right',paddingBottom:4}}>Streaming · auto-refresh 60s · {lastUpdated}</div>
      </div>
    );
  };

  // ── RIGHT PANEL ──
  const RightPanel = () => {
    const items = rightTab==='flow' ? filteredFlow : filteredSweeps;
    return (
      <div style={{backgroundColor:BG2,borderRadius:8,border:`1px solid ${BORDER}`,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',position:'sticky',top:0}}>
        {/* Tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,padding:'0 8px',flexShrink:0}}>
          <button onClick={()=>setRightTab('flow')} style={{padding:'10px 12px',fontSize:12,fontWeight:700,backgroundColor:'transparent',border:'none',borderBottom:rightTab==='flow'?'2px solid #f9a825':'2px solid transparent',color:rightTab==='flow'?'#f9a825':MUTED,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            Live Flow <span style={{backgroundColor:BG3,borderRadius:10,padding:'1px 7px',fontSize:9,color:MUTED}}>{flow.length}</span>
          </button>
          <button onClick={()=>setRightTab('sweeps')} style={{padding:'10px 12px',fontSize:12,fontWeight:700,backgroundColor:'transparent',border:'none',borderBottom:rightTab==='sweeps'?'2px solid #f9a825':'2px solid transparent',color:rightTab==='sweeps'?'#f9a825':MUTED,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            Golden Sweeps <span style={{backgroundColor:BG3,borderRadius:10,padding:'1px 7px',fontSize:9,color:MUTED}}>{sweeps.length}</span>
          </button>
        </div>
        {/* Filters */}
        <div style={{display:'flex',gap:4,padding:'6px 10px',borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
          {['ALL','CALL','PUT','SWEEP','BLOCK'].map(f=>(
            <span key={f} onClick={()=>setFlowFilter(f)} style={{fontSize:10,padding:'2px 10px',borderRadius:12,border:`1px solid ${flowFilter===f?'#f9a825':BORDER}`,cursor:'pointer',fontWeight:700,backgroundColor:flowFilter===f?'rgba(249,168,37,0.1)':'transparent',color:flowFilter===f?'#f9a825':MUTED}}>{f}</span>
          ))}
        </div>
        {/* Column headers */}
        <div style={{display:'grid',gridTemplateColumns:'68px 44px 50px 42px 44px 36px 52px 1fr',padding:'4px 10px',borderBottom:`1px solid ${BORDER}`,flexShrink:0,gap:2}}>
          {['TIME','SYM','STRIKE','C/P','SIZE','SENT','COND','PREM'].map(h=>(
            <div key={h} style={{fontSize:9,color:MUTED2,fontWeight:700,letterSpacing:'0.3px'}}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        <div style={{overflowY:'auto',flex:1}}>
          {items.map((r,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'68px 44px 50px 42px 44px 36px 52px 1fr',padding:'5px 10px',borderBottom:`1px solid ${BORDER}22`,backgroundColor:i%2?BG3+'44':'transparent',alignItems:'center',gap:2}}>
              <span style={{fontSize:10,color:MUTED}}>{r.ts}</span>
              <span style={{fontSize:10,fontWeight:800,color:TEXT}}>{r.ticker}</span>
              <span style={{fontSize:10,color:MUTED}}>{r.strike}</span>
              <span style={{fontSize:10,fontWeight:700,color:r.type==='CALL'?'#4caf50':'#f44336'}}>{r.type}</span>
              <span style={{fontSize:10,color:MUTED}}>{r.size}</span>
              <span style={{fontSize:10,fontWeight:700,color:r.sent==='ASK'?'#4caf50':r.sent==='BID'?'#f44336':MUTED}}>{r.sent||'—'}</span>
              <span style={{fontSize:8,fontWeight:800,padding:'2px 4px',borderRadius:3,textAlign:'center',
                backgroundColor:r.cond==='SWEEP'?'#7f5000':r.cond==='BLOCK'?'#0d2050':'#1a3020',
                color:r.cond==='SWEEP'?'#ffcc02':r.cond==='BLOCK'?'#6699ff':'#66cc88'
              }}>{r.cond}</span>
              <span style={{fontSize:10,fontWeight:700,color:(r.isBull)?'#4caf50':'#f44336',textAlign:'right'}}>{fmt(r.prem)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{fontFamily:"'Inter','Segoe UI',sans-serif",backgroundColor:BG,minHeight:'100vh',display:'flex',flexDirection:'column',color:TEXT}}>
      {/* TOP BAR */}
      <div style={{display:'flex',alignItems:'center',padding:'8px 16px',backgroundColor:BG2,borderBottom:`1px solid ${BORDER}`,gap:12,flexShrink:0,height:48,boxSizing:'border-box'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:6,backgroundColor:'#f9a825',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:'#000'}}>S</div>
          <span style={{fontSize:14,fontWeight:700,color:TEXT}}>SmartMoney <span style={{color:MUTED}}>/</span> <span style={{color:MUTED}}>Flow</span></span>
        </div>
        <div style={{flex:1,maxWidth:340,backgroundColor:BG3,border:`1px solid ${BORDER}`,borderRadius:6,padding:'5px 12px',display:'flex',alignItems:'center',gap:8,cursor:'text'}}>
          <span style={{fontSize:12,color:MUTED}}>🔍</span>
          <span style={{fontSize:11,color:MUTED2}}>Search ticker, strike, sweep...</span>
          <span style={{marginLeft:'auto',fontSize:9,color:MUTED2,border:`1px solid ${BORDER}`,borderRadius:3,padding:'1px 5px'}}>⌘K</span>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:14}}>
          <span style={{fontSize:11,color:'#4caf50',display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:7,height:7,borderRadius:'50%',backgroundColor:'#4caf50',boxShadow:'0 0 6px #4caf50',display:'inline-block'}}/>
            Markets Open · API Connected
          </span>
          <span style={{fontSize:11,color:MUTED}}>Updated {lastUpdated}</span>
          <button onClick={refresh} disabled={loading} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:5,border:`1px solid ${BORDER}`,backgroundColor:BG3,fontSize:11,fontWeight:600,color:TEXT,cursor:'pointer'}}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 380px',flex:1,height:'calc(100vh - 48px)',overflow:'hidden',gap:8,padding:8,boxSizing:'border-box'}}>

        {/* LEFT — scrollable */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:10}}>
          {/* 2 GEX columns side by side */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <GexColumn tickerKey={ticker1} gexRows={gex1} inputVal={input1} setInput={setInput1} onSubmit={()=>submitTicker(input1,setTicker1,setInput1)}/>
            <GexColumn tickerKey={ticker2} gexRows={gex2} inputVal={input2} setInput={setInput2} onSubmit={()=>submitTicker(input2,setTicker2,setInput2)}/>
          </div>

          {/* Ticker selector for detail */}
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:10,color:MUTED}}>DETAIL VIEW:</span>
            {[ticker1,ticker2].map(t=>(
              <span key={t} onClick={()=>setDetailTicker(t)} style={{fontSize:11,padding:'4px 14px',borderRadius:5,border:`1px solid ${detailTicker===t?'#f9a825':BORDER}`,cursor:'pointer',backgroundColor:detailTicker===t?'rgba(249,168,37,0.1)':'transparent',color:detailTicker===t?'#f9a825':MUTED,fontWeight:700}}>{t}</span>
            ))}
          </div>

          {/* Detail section */}
          <DetailSection/>
        </div>

        {/* RIGHT — fixed */}
        <RightPanel/>
      </div>
    </div>
  );
};

export default SmartMoneyDashboard;
