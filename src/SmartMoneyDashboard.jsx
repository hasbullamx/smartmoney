import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const EXPIRATIONS = ['0DTE','1DTE','2DTE','3DTE','7DTE','14DTE','21DTE','30DTE','45DTE','60DTE','90DTE'];
const MARKET_TICKERS = ['SPY','QQQ','AAPL','NVDA','TSLA','AMZN','MSFT','META','AMD','GOOGL','NFLX','COIN','MSTR','PLTR','ARM','UBER','SOFI','BABA','HOOD','SHOP'];
const COMPANY_NAMES = { SPY:'SPDR S&P 500 ETF', QQQ:'Invesco QQQ Trust', NVDA:'NVIDIA Corporation', AAPL:'Apple Inc.', TSLA:'Tesla Inc.', AMZN:'Amazon.com Inc.', MSFT:'Microsoft Corp.', META:'Meta Platforms', AMD:'Advanced Micro Devices', GOOGL:'Alphabet Inc.' };
const DEFAULT_BASE = { SPY:526, QQQ:458, NVDA:1224, AAPL:234, TSLA:310, AMZN:185, MSFT:415, META:520, AMD:155, GOOGL:175 };
const REGIMES = [
  { label:'Positive Gamma', sub:'Dealers long gamma — market likely to pin', color:'#00e676', glow:'rgba(0,230,118,0.2)' },
  { label:'Negative Gamma', sub:'Dealers short gamma — volatility expansion likely', color:'#ff5252', glow:'rgba(255,82,82,0.2)' },
  { label:'Volatility Expansion Risk', sub:'Gamma near zero — explosive move possible', color:'#f9a825', glow:'rgba(249,168,37,0.2)' },
  { label:'Dealer Long Gamma', sub:'Strong dealer hedge buying supports price', color:'#00bcd4', glow:'rgba(0,188,212,0.2)' },
  { label:'Pinning Environment', sub:'Max pain gravity — price gravitating to strike', color:'#ab47bc', glow:'rgba(171,71,188,0.2)' },
];
const FLOW_LABELS = ['Institutional','Opening','Hedge','High Conv.','Lotto','Closing'];
const CONDITIONS = ['SWEEP','BLOCK','SPLIT'];
const SENTIMENTS = ['ASK','BID','MID'];

const clamp = (v,mn,mx) => Math.min(mx,Math.max(mn,v));
const fmt = (p) => {
  if (!p && p!==0) return '$0';
  const a=Math.abs(p), s=p<0?'-':'';
  if (a>=1000000) return `${s}$${(a/1e6).toFixed(1)}M`;
  if (a>=1000) return `${s}$${(a/1000).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
const getGrade = s => s>=90?'A+':s>=80?'A':s>=70?'B+':s>=60?'B':'C';

const gexBarColor = (gex, max) => {
  const t = Math.abs(gex)/max;
  if (gex>0) {
    if (t<0.25) return '#1a4a3a'; if (t<0.5) return '#00695c';
    if (t<0.75) return '#00bcd4'; return '#f9a825';
  } else {
    if (t<0.25) return '#2a0a3a'; if (t<0.5) return '#6a1b9a';
    if (t<0.75) return '#ab47bc'; return '#f9a825';
  }
};

const dexCellStyle = (val) => {
  const a=Math.abs(val);
  if (a<60000) return { bg:'transparent', color:'#1e2a3a' };
  if (val>0) {
    if (a<200000) return { bg:'#003d33', color:'#80cbc4' };
    if (a<500000) return { bg:'#00574a', color:'#fff' };
    if (a<1000000) return { bg:'#00897b', color:'#fff' };
    return { bg:'#26c6da', color:'#000' };
  } else {
    if (a<200000) return { bg:'#1a0033', color:'#ce93d8' };
    if (a<500000) return { bg:'#38006b', color:'#fff' };
    if (a<1000000) return { bg:'#6a1b9a', color:'#fff' };
    return { bg:'#ab47bc', color:'#fff' };
  }
};

// Sparkline SVG
const Sparkline = ({ color='#ff5252', width=120, height=28 }) => {
  const pts = Array.from({length:20},(_,i)=>({ x:i*(width/19), y:height/2+(Math.random()-0.5)*height*0.8 }));
  const d = pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.8}/>
    </svg>
  );
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const genGex = (base) => {
  const rows=[], bs=Math.floor(base/5)*5;
  for (let i=10;i>=-10;i--) {
    const strike=bs+i*5;
    const gex=(Math.random()-0.45)*2000000;
    rows.push({ strike, gex, isWall:Math.abs(gex)>1500000, isMagnet:Math.abs(gex)>800000&&Math.abs(gex)<1500000 });
  }
  return rows;
};

const genDex = (base) => {
  const bs=Math.floor(base/5)*5;
  return Array.from({length:21},(_,idx)=>{
    const strike=bs+(10-idx)*5;
    const cells={};
    EXPIRATIONS.forEach(e=>{ const v=(Math.random()-0.45)*1500000; cells[e]=Math.abs(v)<70000?0:v; });
    const rowTotal=Object.values(cells).reduce((s,v)=>s+v,0);
    return { strike,cells,rowTotal };
  });
};

const genFlow = () => {
  const now=new Date();
  return Array.from({length:60},(_,i)=>{
    const ticker=MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
    const base=DEFAULT_BASE[ticker]||100;
    const strike=Math.floor(base/5)*5+(Math.floor(Math.random()*10)-5)*5;
    const type=Math.random()>0.5?'CALL':'PUT';
    const sent=SENTIMENTS[Math.floor(Math.random()*3)];
    const cond=CONDITIONS[Math.floor(Math.random()*3)];
    const dte=Math.floor(Math.random()*90);
    const price=(Math.random()*8+0.1).toFixed(2);
    const size=Math.floor(Math.random()*900+50);
    const prem=price*size*100;
    const isBull=(type==='CALL'&&sent==='ASK')||(type==='PUT'&&sent==='BID');
    const unusual=size>500&&prem>200000;
    const label=FLOW_LABELS[Math.floor(Math.random()*FLOW_LABELS.length)];
    let score=50;
    score+=sent==='ASK'?10:-5; score+=prem>500000?20:prem>200000?10:0;
    score+=size>500?10:0; score+=cond==='SWEEP'?15:cond==='BLOCK'?10:0;
    score=clamp(score,0,100);
    const t=new Date(now.getTime()-i*11000);
    const ts=t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const expD=new Date(now.getTime()+dte*86400000);
    const exp=`${(expD.getMonth()+1).toString().padStart(2,'0')}/${expD.getDate().toString().padStart(2,'0')}/${expD.getFullYear().toString().slice(2)}`;
    return { ticker,strike,type,sent,cond,dte,price,size,prem,isBull,unusual,label,score,ts,exp };
  });
};

const genSweeps = () => Array.from({length:20},(_,i)=>{
  const ticker=MARKET_TICKERS[Math.floor(Math.random()*MARKET_TICKERS.length)];
  const base=DEFAULT_BASE[ticker]||100;
  const strike=Math.floor(base/5)*5+(Math.floor(Math.random()*10)-5)*5;
  const isBull=Math.random()>0.45;
  const score=Math.floor(Math.random()*35)+65;
  const dte=Math.floor(Math.random()*45);
  const prem=Math.random()*2000000+400000;
  const size=Math.floor(Math.random()*1200+200);
  const label=FLOW_LABELS[Math.floor(Math.random()*FLOW_LABELS.length)];
  const cond=Math.random()>0.5?'SWEEP':'BLOCK';
  const now=new Date(); const t=new Date(now.getTime()-i*25000);
  const ts=t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const expD=new Date(now.getTime()+dte*86400000);
  const exp=`${(expD.getMonth()+1).toString().padStart(2,'0')}/${expD.getDate().toString().padStart(2,'0')}/${expD.getFullYear().toString().slice(2)}`;
  return { ticker,strike,type:isBull?'CALL':'PUT',exp,dte,prem,size,score,grade:getGrade(score),isBull,label,cond,ts };
}).sort((a,b)=>b.prem-a.prem);

const genSummary = (ticker, base) => {
  const flip=(base*0.985).toFixed(2);
  const callWall=(base*1.025).toFixed(2);
  const putWall=(base*0.965).toFixed(2);
  const magnet=(base*0.998).toFixed(2);
  const ivRank=Math.floor(Math.random()*100);
  const ivPct=Math.floor(Math.random()*100);
  const expMove=(base*0.015).toFixed(2);
  const skew=Math.random()>0.5?'Put Skew':'Call Skew';
  const bullScore=Math.floor(Math.random()*60)+20;
  const bearScore=100-bullScore;
  const smConf=Math.floor(Math.random()*40)+55;
  const hedgeBuy=Math.floor(Math.random()*60)+20;
  const hedgeSell=100-hedgeBuy;
  const regime=REGIMES[Math.floor(Math.random()*REGIMES.length)];
  const regimeConf=Math.floor(Math.random()*30)+65;
  const totalGex=fmt((Math.random()-0.5)*3000000);
  const netDex=fmt((Math.random()-0.4)*2000000);
  const putCallOI=(0.7+Math.random()*0.5).toFixed(2);
  const change=(Math.random()-0.5)*50;
  const changePct=((change/base)*100).toFixed(2);
  const narrative=`${ticker} remains in ${regime.label.toLowerCase()} regime above $${flip}. Dealer positioning favors ${bullScore>50?'mean reversion':'volatility expansion'} near current levels. ${bullScore>50?'Bullish call':'Bearish put'} accumulation detected into upcoming expiration. Smart money confidence at ${smConf}%. Key gamma flip at $${flip} — breach triggers dealer ${bullScore>50?'buying':'selling'} cascade. Watch $${putWall} as structural ${bullScore>50?'support':'resistance'}.`;
  return { flip,callWall,putWall,magnet,ivRank,ivPct,expMove,skew,bullScore,bearScore,smConf,hedgeBuy,hedgeSell,regime,regimeConf,totalGex,netDex,putCallOI,change:change.toFixed(2),changePct,narrative };
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const SmartMoneyDashboard = () => {
  const [tickers,setTickers]=useState(['SPY','QQQ','NVDA']);
  const [tickerInputs,setTickerInputs]=useState(['','','']);
  const [selectedTicker,setSelectedTicker]=useState('NVDA');
  const [gexData,setGexData]=useState({});
  const [dexData,setDexData]=useState([]);
  const [flow,setFlow]=useState([]);
  const [sweeps,setSweeps]=useState([]);
  const [bases,setBases]=useState({SPY:526,QQQ:458,NVDA:1224});
  const [changes,setChanges]=useState({SPY:{v:-2.18,p:-0.41},QQQ:{v:1.46,p:0.32},NVDA:{v:-13.86,p:-1.12}});
  const [summary,setSummary]=useState(null);
  const [scores,setScores]=useState({SPY:66,QQQ:77,NVDA:83});
  const [scoreGrades,setScoreGrades]=useState({SPY:'C',QQQ:'B+',NVDA:'A'});
  const [scoreTrends,setScoreTrends]=useState({SPY:-1,QQQ:1,NVDA:1});
  const [flowFilter,setFlowFilter]=useState('ALL');
  const [sweepFilter,setSweepFilter]=useState('ALL');
  const [loading,setLoading]=useState(true);
  const [lastUpdated,setLastUpdated]=useState(null);
  const intervalRef=useRef(null);

  const refresh=useCallback(()=>{
    setLoading(true);
    const nb={},nc={},ng={},ns={},nsg={},nst={};
    tickers.forEach(t=>{
      const b=(DEFAULT_BASE[t]||100)+(Math.random()-0.5)*5;
      nb[t]=b;
      const chg=(Math.random()-0.5)*30;
      nc[t]={v:chg.toFixed(2),p:((chg/b)*100).toFixed(2)};
      ng[t]=genGex(b);
      const sc=Math.floor(Math.random()*35)+60;
      ns[t]=sc; nsg[t]=getGrade(sc); nst[t]=Math.random()>0.5?1:-1;
    });
    const selBase=nb[selectedTicker]||100;
    setBases(nb); setChanges(nc); setGexData(ng); setScores(ns); setScoreGrades(nsg); setScoreTrends(nst);
    setDexData(genDex(selBase));
    setFlow(genFlow()); setSweeps(genSweeps());
    setSummary(genSummary(selectedTicker,selBase));
    setLastUpdated(new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
    setLoading(false);
  },[tickers,selectedTicker]);

  useEffect(()=>{ refresh(); intervalRef.current=setInterval(refresh,60000); return ()=>clearInterval(intervalRef.current); },[refresh]);

  const changeTicker=(idx,val)=>{ const ni=[...tickerInputs]; ni[idx]=val.toUpperCase(); setTickerInputs(ni); };
  const submitTicker=(idx,e)=>{
    if (e.key==='Enter'&&tickerInputs[idx]) {
      const nt=[...tickers]; const old=nt[idx]; nt[idx]=tickerInputs[idx]; setTickers(nt);
      if (selectedTicker===old) setSelectedTicker(tickerInputs[idx]);
      const ni=[...tickerInputs]; ni[idx]=''; setTickerInputs(ni);
    }
  };
  const clearTicker=(idx)=>{ const ni=[...tickerInputs]; ni[idx]=''; setTickerInputs(ni); };

  const filteredFlow=flow.filter(r=>flowFilter==='ALL'||r.type===flowFilter||r.cond===flowFilter);
  const filteredSweeps=sweeps.filter(s=>sweepFilter==='ALL'||s.type===sweepFilter||s.cond===sweepFilter);
  const selBase=bases[selectedTicker]||425;
  const sum=summary;

  // ── LEFT GEX ──────────────────────────────────────────────────────────────
  const renderGex=(ticker,idx)=>{
    const rows=gexData[ticker]||[];
    const base=bases[ticker]||100;
    const chg=changes[ticker]||{v:0,p:0};
    const maxG=rows.length?Math.max(...rows.map(r=>Math.abs(r.gex)),1):1;
    const isSelected=selectedTicker===ticker;
    const isPos=Number(chg.p)>=0;
    const gammaFlip=(base*0.985).toFixed(0);
    const companyName=COMPANY_NAMES[ticker]||ticker;

    return (
      <div key={ticker} style={{...css.gexBox, border:isSelected?'1.5px solid rgba(249,168,37,0.6)':'1px solid #1a2332'}} onClick={()=>setSelectedTicker(ticker)}>
        {/* Search row */}
        <div style={css.gexSearchRow}>
          <span style={css.gexSearchIcon}>🔍</span>
          <span style={css.gexSearchTicker}>{ticker}</span>
          <span style={css.gexSearchCompany}>{companyName}</span>
          <span style={css.gexSearchX} onClick={e=>{e.stopPropagation();clearTicker(idx);}}>✕</span>
        </div>
        {/* Input (hidden but functional) */}
        <input placeholder="" value={tickerInputs[idx]} onChange={e=>changeTicker(idx,e.target.value)} onKeyDown={e=>submitTicker(idx,e)} style={css.gexHiddenInput} onClick={e=>e.stopPropagation()}/>

        {/* Price + sparkline */}
        <div style={css.gexPriceBlock}>
          <div style={css.gexPriceLeft}>
            <span style={css.gexPriceBig}>{base.toFixed(2)}</span>
            <span style={{...css.gexPriceChg, color:isPos?'#00e676':'#ff5252'}}>
              {isPos?'+':''}{chg.v} ({isPos?'+':''}{chg.p}%)
            </span>
          </div>
          <div style={{flex:1,display:'flex',justifyContent:'flex-end',paddingRight:4}}>
            <Sparkline color={isPos?'#00e676':'#ff5252'} width={100} height={24}/>
          </div>
        </div>

        {/* Column headers */}
        <div style={css.gexColHdr}>
          <span style={{width:46,fontSize:8,color:'#3a4a5a',textAlign:'right',paddingRight:6,flexShrink:0}}>STRIKE</span>
          <span style={{flex:1,fontSize:8,color:'#3a4a5a',textAlign:'center'}}>GEX</span>
          <span style={{width:56,fontSize:8,color:'#3a4a5a',textAlign:'right',flexShrink:0,paddingRight:2}}></span>
        </div>

        {/* GEX rows */}
        <div style={css.gexRowsWrap}>
          {rows.map(row=>{
            const pW=Math.abs(row.gex)/maxG;
            const col=gexBarColor(row.gex,maxG);
            const isPos2=row.gex>=0;
            const isSpot=Math.abs(row.strike-base)<3;
            const isFlip=Math.abs(row.strike-Number(gammaFlip))<3;
            return (
              <div key={row.strike} style={{...css.gexRow, backgroundColor:isSpot?'rgba(249,168,37,0.07)':isFlip?'rgba(255,82,82,0.04)':'transparent'}}>
                <div style={css.gexStrike}>
                  {isSpot&&<span style={{color:'#f9a825',marginRight:2,fontSize:7}}>●</span>}
                  {isFlip&&!isSpot&&<span style={{color:'#ff5252',marginRight:2,fontSize:7}}>⚡</span>}
                  <span style={{color:isSpot?'#f9a825':isFlip?'#ff5252':'#5a7a8a',fontWeight:isSpot||isFlip?700:400,fontSize:9}}>{row.strike}</span>
                </div>
                <div style={css.gexBarArea}>
                  <div style={css.gexCenter}/>
                  {isPos2
                    ?<div style={{position:'absolute',left:'50%',top:3,bottom:3,width:`${pW*50}%`,backgroundColor:col,borderRadius:'0 3px 3px 0',boxShadow:row.isWall?`0 0 5px ${col}`:undefined}}/>
                    :<div style={{position:'absolute',right:'50%',top:3,bottom:3,width:`${pW*50}%`,backgroundColor:col,borderRadius:'3px 0 0 3px',boxShadow:row.isWall?`0 0 5px ${col}`:undefined}}/>
                  }
                  {row.isWall&&<span style={{position:'absolute',top:2,right:2,fontSize:6,color:'#f9a825',fontWeight:800,letterSpacing:0.3}}>{isPos2?'CW':'PW'}</span>}
                  {row.isMagnet&&!row.isWall&&<span style={{position:'absolute',top:2,right:2,fontSize:7,color:'#555'}}>🧲</span>}
                </div>
                <div style={{width:56,fontSize:9,fontWeight:600,textAlign:'right',flexShrink:0,color:isPos2?'#00e676':'#ff5252',paddingRight:4}}>
                  {fmt(row.gex)}
                </div>
              </div>
            );
          })}
        </div>

        {/* GEX scale bar */}
        <div style={css.gexScaleBar}>
          <span style={css.gexScaleLbl}>-1.0M</span>
          <span style={css.gexScaleLbl}>-500K</span>
          <div style={{flex:1,height:5,background:'linear-gradient(to right,#6a1b9a,#ab47bc,#1a2332,#00695c,#00bcd4)',borderRadius:3,margin:'0 4px'}}/>
          <span style={css.gexScaleLbl}>+500K</span>
          <span style={css.gexScaleLbl}>+1.0M</span>
        </div>
      </div>
    );
  };

  // ── CENTER ────────────────────────────────────────────────────────────────
  const renderCenter=()=>{
    if (!sum) return <div style={css.centerPanel}/>;
    const {regime,regimeConf,flip,callWall,putWall,ivRank,expMove,skew,bullScore,bearScore,smConf,hedgeBuy,hedgeSell,totalGex,netDex,putCallOI,change,changePct,narrative}=sum;
    const chgIsPos=Number(changePct)>=0;

    return (
      <div style={css.centerPanel}>

        {/* REGIME STRIP */}
        <div style={{...css.regimeStrip,borderColor:regime.color,boxShadow:`0 0 16px ${regime.glow}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',backgroundColor:regime.color,boxShadow:`0 0 8px ${regime.color}`,flexShrink:0}}/>
            <span style={{fontSize:11,fontWeight:800,color:regime.color,letterSpacing:'0.2px'}}>{regime.label}</span>
            <span style={{fontSize:9,color:'#3a4a5a',marginLeft:4}}>{regime.sub}</span>
          </div>
          <span style={{fontSize:9,color:'#3a4a5a'}}>Confidence: <span style={{color:regime.color,fontWeight:700}}>{regimeConf}%</span></span>
        </div>

        {/* KEY LEVELS */}
        <div style={css.keyRow}>
          {[
            {l:'Gamma Flip',v:`$${flip}`,c:'#ff5252'},
            {l:'Call Wall',v:`$${callWall}`,c:'#00e676'},
            {l:'Put Wall',v:`$${putWall}`,c:'#ab47bc'},
            {l:'IV Rank',v:ivRank,c:'#f9a825'},
            {l:'Exp Move',v:`±$${expMove}`,c:'#00bcd4'},
            {l:'Skew',v:skew,c:'#ce93d8'},
          ].map(k=>(
            <div key={k.l} style={css.keyCard}>
              <div style={{fontSize:7,color:'#3a4a5a',marginBottom:2,letterSpacing:'0.5px',textTransform:'uppercase'}}>{k.l}</div>
              <div style={{fontSize:11,fontWeight:800,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* FLIP METER */}
        <div style={css.flipBox}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
            <span style={{fontSize:8,fontWeight:700,color:'#3a4a5a',letterSpacing:'0.5px'}}>⚡ GAMMA FLIP METER — {selectedTicker}</span>
            <span style={{fontSize:8,color:'#3a4a5a'}}>Distance: <span style={{color:'#f9a825',fontWeight:700}}>{(selBase-Number(flip)).toFixed(2)} pts</span></span>
          </div>
          <div style={{position:'relative',height:10,backgroundColor:'#0d1520',borderRadius:5,overflow:'visible'}}>
            <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${clamp(((selBase-Number(putWall))/(Number(callWall)-Number(putWall)))*100,2,98)}%`,background:'linear-gradient(to right,rgba(171,71,188,0.2),rgba(0,188,212,0.2))',borderRadius:5}}/>
            <div style={{position:'absolute',left:`${clamp(((Number(flip)-Number(putWall))/(Number(callWall)-Number(putWall)))*100,2,98)}%`,top:-4,bottom:-4,width:2,backgroundColor:'#ff5252',boxShadow:'0 0 8px #ff5252',zIndex:2}}/>
            <div style={{position:'absolute',left:`${clamp(((selBase-Number(putWall))/(Number(callWall)-Number(putWall)))*100,2,98)}%`,top:-5,bottom:-5,width:3,backgroundColor:'#f9a825',boxShadow:'0 0 10px #f9a825',borderRadius:2,zIndex:3}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:5}}>
            <span style={{fontSize:7,color:'#ab47bc'}}>PUT WALL ${putWall}</span>
            <span style={{fontSize:7,color:'#ff5252'}}>FLIP ${flip}</span>
            <span style={{fontSize:7,color:'#f9a825',fontWeight:700}}>● SPOT ${selBase.toFixed(2)}</span>
            <span style={{fontSize:7,color:'#00e676'}}>CALL WALL ${callWall}</span>
          </div>
        </div>

        {/* INTEL BARS */}
        <div style={{display:'flex',gap:5}}>
          {/* Flow intel */}
          <div style={css.intelBox}>
            <div style={{fontSize:7,color:'#3a4a5a',fontWeight:700,marginBottom:5,letterSpacing:'0.5px'}}>FLOW INTELLIGENCE</div>
            {[
              {label:'BULL AGGRESSION',val:bullScore,color:'#00e676',bg:'#001a0d'},
              {label:'BEAR AGGRESSION',val:bearScore,color:'#ff5252',bg:'#1a0000'},
              {label:'SM CONFIDENCE',val:smConf,color:'#f9a825',bg:'#1a1000'},
            ].map(b=>(
              <div key={b.label} style={{marginBottom:5}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{fontSize:7,color:b.color,letterSpacing:'0.3px'}}>{b.label}</span>
                  <span style={{fontSize:8,fontWeight:800,color:b.color}}>{b.val}{b.label.includes('CONF')?'%':''}</span>
                </div>
                <div style={{height:5,backgroundColor:b.bg,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${b.val}%`,backgroundColor:b.color,borderRadius:3,boxShadow:`0 0 4px ${b.color}66`}}/>
                </div>
              </div>
            ))}
          </div>
          {/* Hedge pressure */}
          <div style={css.intelBox}>
            <div style={{fontSize:7,color:'#3a4a5a',fontWeight:700,marginBottom:5,letterSpacing:'0.5px'}}>DEALER HEDGING PRESSURE</div>
            {[
              {label:'BUY PRESSURE',val:hedgeBuy,color:'#00bcd4',bg:'#00101a'},
              {label:'SELL PRESSURE',val:hedgeSell,color:'#ab47bc',bg:'#0f001a'},
            ].map(b=>(
              <div key={b.label} style={{marginBottom:5}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{fontSize:7,color:b.color,letterSpacing:'0.3px'}}>{b.label}</span>
                  <span style={{fontSize:8,fontWeight:800,color:b.color}}>{b.val}%</span>
                </div>
                <div style={{height:5,backgroundColor:b.bg,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${b.val}%`,backgroundColor:b.color,borderRadius:3,boxShadow:`0 0 4px ${b.color}66`}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DEX MATRIX */}
        <div style={css.dexBox}>
          <div style={css.dexHeader}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,fontWeight:800,color:'#f9a825'}}>⚡ {selectedTicker} — Dealer Exposure (Swing Mode)</span>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={css.dexPill}>Exposure: <strong>Premium</strong> ▾</div>
              <div style={css.dexPill}>View: <strong>Full Matrix</strong> ▾</div>
              <div style={{...css.dexPill,padding:'3px 7px'}}>⛶</div>
            </div>
          </div>
          <div style={{overflowX:'auto',overflowY:'auto',flex:1}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:9,tableLayout:'fixed'}}>
              <thead>
                <tr style={{backgroundColor:'#080c12'}}>
                  <th style={{...css.dexTh,width:52,textAlign:'left',paddingLeft:8}}>STRIKE</th>
                  {EXPIRATIONS.map(e=><th key={e} style={css.dexTh}>{e}</th>)}
                  <th style={{...css.dexTh,color:'#5a7a8a'}}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {dexData.map((row,ri)=>(
                  <tr key={row.strike} style={{backgroundColor:ri%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                    <td style={css.dexStrikeTd}>{row.strike}</td>
                    {EXPIRATIONS.map(exp=>{
                      const v=row.cells[exp]||0;
                      const {bg,color}=dexCellStyle(v);
                      return <td key={exp} style={{...css.dexTd,backgroundColor:bg,color}}>{v?fmt(v):''}</td>;
                    })}
                    <td style={{...css.dexTd,color:row.rowTotal>=0?'#00e676':'#ff5252',fontWeight:800,backgroundColor:'transparent'}}>{fmt(row.rowTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div style={css.dexLegend}>
            <span style={{fontSize:8,color:'#3a4a5a'}}>Lowest Exposure</span>
            <div style={{flex:1,height:6,background:'linear-gradient(to right,#6a1b9a,#1a2332,#00897b,#f9a825)',borderRadius:3,margin:'0 12px'}}/>
            <span style={{fontSize:8,color:'#3a4a5a'}}>Highest Exposure</span>
          </div>
          {/* Stats bar */}
          <div style={css.statsBar}>
            {[
              {l:'Spot Price',v:selBase.toFixed(2),c:'#ffffff'},
              {l:'Change',v:`${chgIsPos?'+':''}${change} (${chgIsPos?'+':''}${changePct}%)`,c:chgIsPos?'#00e676':'#ff5252'},
              {l:'IV Rank',v:ivRank,c:'#f9a825'},
              {l:'Put/Call (OI)',v:putCallOI,c:'#ab47bc'},
              {l:'Total GEX',v:totalGex,c:'#00e676'},
              {l:'Net Dealer Exposure',v:netDex,c:netDex.startsWith('-')?'#ff5252':'#00e676'},
            ].map(s=>(
              <div key={s.l} style={css.statItem}>
                <div style={{fontSize:7,color:'#3a4a5a',marginBottom:2,letterSpacing:'0.3px'}}>{s.l}</div>
                <div style={{fontSize:13,fontWeight:900,color:s.c,letterSpacing:'-0.3px'}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI NARRATIVE */}
        <div style={css.narrativeBox}>
          <span style={{fontSize:8,color:'#f9a825',fontWeight:800,marginRight:8,letterSpacing:'0.5px'}}>🤖 AI NARRATIVE</span>
          <span style={{fontSize:9,color:'#5a7a8a',lineHeight:1.5}}>{narrative}</span>
        </div>
      </div>
    );
  };

  // ── RIGHT ─────────────────────────────────────────────────────────────────
  const renderRight=()=>{
    const FLOW_FILTERS=['ALL','CALL','PUT','SWEEP','BLOCK'];
    const SWEEP_FILTERS=['ALL','CALL','PUT','SWEEP','BLOCK'];

    return (
      <div style={css.rightPanel}>

        {/* SCORECARDS */}
        <div style={css.rightBlock}>
          <div style={css.rightBlockHdr}>
            <span style={css.rightBlockTitle}>SCORECARDS <span style={{color:'#3a4a5a',fontWeight:400}}>ⓘ</span></span>
            <span style={{fontSize:8,color:'#3a4a5a',cursor:'pointer'}}>✎ Edit</span>
          </div>
          <div style={{display:'flex',gap:1,padding:'8px 6px 6px'}}>
            {tickers.map(k=>{
              const sc=scores[k]||0;
              const gr=scoreGrades[k]||'B';
              const tr=scoreTrends[k]||0;
              const scColor=sc>=75?'#00e676':sc>=60?'#f9a825':'#ff5252';
              return (
                <div key={k} style={css.scoreCard}>
                  <div style={{fontSize:9,color:'#3a4a5a',letterSpacing:'1px',marginBottom:4,fontWeight:700}}>{k}</div>
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:2}}>
                    <span style={{fontSize:36,fontWeight:900,color:scColor,lineHeight:1,letterSpacing:'-2px'}}>{sc}</span>
                    <span style={{fontSize:18,fontWeight:900,color:'#3a4a5a',lineHeight:1}}>{gr}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'#3a4a5a'}}>
                    <span>Score</span>
                    <span style={{display:'flex',alignItems:'center',gap:3}}>
                      Trend <span style={{color:tr>0?'#00e676':'#ff5252',fontSize:10}}>{tr>0?'▲':'▼'}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIVE OPTIONS FLOW */}
          <div style={css.flowHeader}>
            <span style={css.flowTitle}>LIVE OPTIONS FLOW <span style={{color:'#3a4a5a',fontWeight:400}}>ⓘ</span></span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:8,color:'#3a4a5a'}}>▼ Filter</span>
              <div style={{display:'flex',gap:2}}>
                {FLOW_FILTERS.map(f=>(
                  <span key={f} onClick={()=>setFlowFilter(f)} style={{...css.fChip,backgroundColor:flowFilter===f?'#1a2a3a':'transparent',color:flowFilter===f?'#f9a825':'#3a4a5a'}}>{f}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:8}}>
              <thead>
                <tr>{['TIME','SYM','STRIKE','C/P','EXP','DTE','PRICE','SIZE','SENT','COND','PREM'].map(h=>(
                  <th key={h} style={css.flowTh}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredFlow.slice(0,35).map((r,i)=>(
                  <tr key={i} style={{backgroundColor:r.unusual?'rgba(249,168,37,0.04)':i%2?'rgba(255,255,255,0.01)':'transparent'}}>
                    <td style={{...css.flowTd,color:'#3a4a5a'}}>{r.ts}</td>
                    <td style={{...css.flowTd,fontWeight:800,color:'#ccc'}}>{r.ticker}</td>
                    <td style={css.flowTd}>{r.strike}</td>
                    <td style={{...css.flowTd,color:r.type==='CALL'?'#00e676':'#ff5252',fontWeight:700}}>{r.type}</td>
                    <td style={css.flowTd}>{r.exp}</td>
                    <td style={css.flowTd}>{r.dte}</td>
                    <td style={css.flowTd}>${r.price}</td>
                    <td style={{...css.flowTd,color:r.unusual?'#f9a825':'#5a7a8a'}}>{r.size}</td>
                    <td style={{...css.flowTd,color:r.sent==='ASK'?'#00e676':r.sent==='BID'?'#ff5252':'#5a7a8a',fontWeight:700}}>{r.sent}</td>
                    <td style={css.flowTd}>
                      <span style={{...css.condBadge,
                        backgroundColor:r.cond==='SWEEP'?'#7f5000':r.cond==='BLOCK'?'#0d2050':'#1a3020',
                        color:r.cond==='SWEEP'?'#ffcc02':r.cond==='BLOCK'?'#6699ff':'#66cc88',
                        border:`1px solid ${r.cond==='SWEEP'?'#7f5000':r.cond==='BLOCK'?'#1a3a7a':'#1a4a2a'}`
                      }}>{r.cond}</span>
                    </td>
                    <td style={{...css.flowTd,fontWeight:700,color:r.isBull?'#00e676':'#ff5252'}}>{fmt(r.prem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GOLDEN SWEEPS */}
        <div style={css.rightBlock}>
          <div style={css.flowHeader}>
            <span style={css.flowTitle}>GOLDEN SWEEPS — INSTITUTIONAL FLOW <span style={{color:'#3a4a5a',fontWeight:400}}>ⓘ</span></span>
            <span style={{fontSize:11,color:'#3a4a5a',cursor:'pointer'}}>⬇</span>
          </div>
          <div style={{display:'flex',gap:4,padding:'5px 8px',borderBottom:'1px solid #1a2332'}}>
            {SWEEP_FILTERS.map(f=>(
              <span key={f} onClick={()=>setSweepFilter(f)} style={{...css.fChip,
                backgroundColor:sweepFilter===f?'#1a2a3a':'transparent',
                color:sweepFilter===f?'#f9a825':'#3a4a5a',
                padding:'2px 8px', border:`1px solid ${sweepFilter===f?'#2a3a4a':'#1a2332'}`
              }}>{f}</span>
            ))}
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:8}}>
              <thead>
                <tr>{['TIME','SYM','STRIKE','TYPE','EXP','DTE','PREM','SIZE','COND','GRADE'].map(h=>(
                  <th key={h} style={css.flowTh}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredSweeps.map((s,i)=>(
                  <tr key={i} style={{backgroundColor:i%2?'rgba(255,255,255,0.01)':'transparent'}}>
                    <td style={{...css.flowTd,color:'#3a4a5a'}}>{s.ts}</td>
                    <td style={{...css.flowTd,fontWeight:800,color:'#ccc'}}>{s.ticker}</td>
                    <td style={css.flowTd}>{s.strike}</td>
                    <td style={{...css.flowTd,color:s.isBull?'#00e676':'#ff5252',fontWeight:700}}>{s.type}</td>
                    <td style={css.flowTd}>{s.exp}</td>
                    <td style={css.flowTd}>{s.dte}</td>
                    <td style={{...css.flowTd,fontWeight:700,color:s.isBull?'#00e676':'#ff5252'}}>{fmt(s.prem)}</td>
                    <td style={css.flowTd}>{s.size}</td>
                    <td style={css.flowTd}>
                      <span style={{...css.condBadge,
                        backgroundColor:s.cond==='SWEEP'?'#7f5000':'#0d2050',
                        color:s.cond==='SWEEP'?'#ffcc02':'#6699ff',
                        border:`1px solid ${s.cond==='SWEEP'?'#7f5000':'#1a3a7a'}`
                      }}>{s.cond}</span>
                    </td>
                    <td style={css.flowTd}>
                      <span style={{...css.gradeBadge,
                        backgroundColor:s.grade==='A+'?'#f9a825':s.grade==='A'?'#005a3a':s.grade==='B+'?'#0a2050':s.grade==='B'?'#1a2332':'#0a0e14',
                        color:s.grade==='A+'?'#000':'#fff'
                      }}>{s.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:'4px 8px',borderTop:'1px solid #1a2332',fontSize:7,color:'#2a3a4a',display:'flex',justifyContent:'space-between'}}>
            <span>Grades reflect premium size, flow sentiment & market impact.</span>
            <span>Last updated: {lastUpdated}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── TOP BAR ───────────────────────────────────────────────────────────────
  return (
    <div style={css.root}>
      <div style={css.topBar}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16,color:'#f9a825'}}>⚡</span>
          <span style={css.logoText}>SmartMoney Flow</span>
          <span style={css.topBarSub}>Real Prices · Mock Flow · {loading?'Fetching…':`Updated: ${lastUpdated}`}</span>
        </div>
        <div style={css.topTickersRow}>
          {tickers.map(t=>{
            const b=bases[t]||0; const c=changes[t]||{v:0,p:0}; const isPos=Number(c.p)>=0;
            return (
              <span key={t} style={css.topTickerPill}>
                <span style={{color:'#7a8a9a',marginRight:4,fontWeight:600}}>{t}</span>
                <span style={{color:'#ddd',fontWeight:700}}>{b.toFixed(2)}</span>
                <span style={{color:isPos?'#00e676':'#ff5252',marginLeft:4,fontSize:9}}>{isPos?'+':''}{c.p}%</span>
              </span>
            );
          })}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginLeft:'auto'}}>
          <span style={{fontSize:9,color:'#00e676',display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:6,height:6,borderRadius:'50%',backgroundColor:'#00e676',boxShadow:'0 0 6px #00e676',display:'inline-block'}}/>
            API Connected
          </span>
          <span style={css.topBtn}>⚙</span>
          <span style={css.topBtn}>🌙 Dark ▾</span>
          <button onClick={refresh} style={css.refreshBtn} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={css.main}>
        {/* LEFT */}
        <div style={css.leftPanel}>
          <div style={css.leftHdr}>GEX HEATMAPS <span style={{color:'#3a4a5a',fontWeight:400,fontSize:9}}>ⓘ</span></div>
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

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = {
  root:{fontFamily:"'IBM Plex Mono','Courier New',monospace",backgroundColor:'#060a10',minHeight:'100vh',display:'flex',flexDirection:'column',color:'#fff',fontSize:10},
  topBar:{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',backgroundColor:'#080c14',borderBottom:'1px solid #1a2332',flexShrink:0},
  logoText:{fontSize:14,fontWeight:900,color:'#fff',letterSpacing:'-0.5px'},
  topBarSub:{fontSize:9,color:'#3a4a5a',marginLeft:4},
  topTickersRow:{display:'flex',gap:6,marginLeft:16},
  topTickerPill:{fontSize:10,padding:'3px 10px',backgroundColor:'#0d1520',borderRadius:4,border:'1px solid #1a2332',display:'flex',alignItems:'center'},
  topBtn:{fontSize:10,color:'#3a4a5a',cursor:'pointer',padding:'3px 8px',border:'1px solid #1a2332',borderRadius:4,backgroundColor:'#0d1520'},
  refreshBtn:{padding:'4px 12px',borderRadius:4,border:'1px solid #1a2332',backgroundColor:'#0d1520',fontSize:9,fontWeight:700,color:'#7a8a9a',cursor:'pointer',display:'flex',alignItems:'center',gap:4},
  main:{display:'flex',flex:1,gap:5,padding:'5px',overflow:'hidden',height:'calc(100vh - 40px)'},

  // LEFT
  leftPanel:{width:'21%',display:'flex',flexDirection:'column',gap:4,minWidth:0,overflowY:'auto'},
  leftHdr:{fontSize:8,fontWeight:700,color:'#3a4a5a',letterSpacing:'1px',padding:'2px 0 4px'},
  gexBox:{backgroundColor:'#0a0e18',borderRadius:6,display:'flex',flexDirection:'column',overflow:'hidden',cursor:'pointer',flexShrink:0},
  gexSearchRow:{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',backgroundColor:'#080c14',borderBottom:'1px solid #1a2332'},
  gexSearchIcon:{fontSize:9,color:'#3a4a5a',flexShrink:0},
  gexSearchTicker:{fontSize:10,fontWeight:800,color:'#7a9ab0',flexShrink:0},
  gexSearchCompany:{fontSize:8,color:'#2a3a4a',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  gexSearchX:{fontSize:9,color:'#2a3a4a',cursor:'pointer',flexShrink:0},
  gexHiddenInput:{position:'absolute',opacity:0,width:0,height:0,pointerEvents:'none'},
  gexPriceBlock:{display:'flex',alignItems:'center',padding:'6px 8px 4px',gap:4},
  gexPriceLeft:{display:'flex',flexDirection:'column'},
  gexPriceBig:{fontSize:18,fontWeight:900,color:'#ddd',letterSpacing:'-0.5px',lineHeight:1},
  gexPriceChg:{fontSize:9,fontWeight:600,marginTop:1},
  gexColHdr:{display:'flex',padding:'2px 8px 2px',borderBottom:'1px solid #1a2332'},
  gexRowsWrap:{overflowY:'auto',padding:'2px 6px 2px'},
  gexRow:{display:'flex',alignItems:'center',height:19,borderRadius:2,marginBottom:1},
  gexStrike:{width:46,fontSize:9,textAlign:'right',paddingRight:4,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'flex-end'},
  gexBarArea:{flex:1,height:15,position:'relative',backgroundColor:'#0d1520',borderRadius:3},
  gexCenter:{position:'absolute',left:'50%',top:0,bottom:0,width:1,backgroundColor:'#1a2332',zIndex:1},
  gexScaleBar:{display:'flex',alignItems:'center',padding:'4px 8px',borderTop:'1px solid #1a2332',gap:4},
  gexScaleLbl:{fontSize:7,color:'#2a3a4a'},

  // CENTER
  centerPanel:{flex:1,display:'flex',flexDirection:'column',gap:4,minWidth:0,overflowY:'auto'},
  regimeStrip:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 12px',backgroundColor:'#0a0e18',borderRadius:5,border:'1px solid',flexShrink:0},
  keyRow:{display:'flex',gap:4,flexShrink:0},
  keyCard:{flex:1,backgroundColor:'#0a0e18',borderRadius:5,padding:'6px 8px',border:'1px solid #1a2332',textAlign:'center'},
  flipBox:{backgroundColor:'#0a0e18',borderRadius:5,padding:'8px 12px',border:'1px solid #1a2332',flexShrink:0},
  intelBox:{flex:1,backgroundColor:'#0a0e18',borderRadius:5,padding:'8px 10px',border:'1px solid #1a2332'},
  dexBox:{flex:1,backgroundColor:'#0a0e18',borderRadius:6,border:'1px solid #1a2332',display:'flex',flexDirection:'column',overflow:'hidden',minHeight:200},
  dexHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderBottom:'1px solid #1a2332',flexShrink:0},
  dexPill:{fontSize:8,color:'#5a7a8a',padding:'3px 8px',backgroundColor:'#0d1520',border:'1px solid #1a2332',borderRadius:4,cursor:'pointer'},
  dexTh:{padding:'5px 4px',color:'#3a4a5a',fontWeight:700,textAlign:'center',position:'sticky',top:0,fontSize:8,whiteSpace:'nowrap',borderBottom:'1px solid #1a2332',backgroundColor:'#080c14',zIndex:1},
  dexStrikeTd:{padding:'3px 8px',color:'#5a7a8a',fontWeight:700,fontSize:9,borderRight:'1px solid #1a2332',whiteSpace:'nowrap',textAlign:'left'},
  dexTd:{padding:'3px 4px',textAlign:'center',fontSize:8,fontWeight:700,borderLeft:'1px solid rgba(255,255,255,0.03)',height:20},
  dexLegend:{display:'flex',alignItems:'center',padding:'5px 10px',borderTop:'1px solid #1a2332',flexShrink:0},
  statsBar:{display:'flex',flexShrink:0,borderTop:'1px solid #1a2332'},
  statItem:{flex:1,padding:'7px 8px',textAlign:'center',borderRight:'1px solid #1a2332'},
  narrativeBox:{backgroundColor:'#0a0e18',borderRadius:5,padding:'7px 12px',border:'1px solid #1a2332',flexShrink:0},

  // RIGHT
  rightPanel:{width:'27%',display:'flex',flexDirection:'column',gap:4,minWidth:0},
  rightBlock:{backgroundColor:'#0a0e18',borderRadius:6,border:'1px solid #1a2332',display:'flex',flexDirection:'column',overflow:'hidden',flex:1},
  rightBlockHdr:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',borderBottom:'1px solid #1a2332',flexShrink:0},
  rightBlockTitle:{fontSize:9,fontWeight:700,color:'#5a7a8a',letterSpacing:'0.8px'},
  scoreCard:{flex:1,backgroundColor:'#080c14',borderRadius:5,padding:'10px 8px',border:'1px solid #1a2332',textAlign:'left'},
  flowHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',borderBottom:'1px solid #1a2332',flexShrink:0},
  flowTitle:{fontSize:8,fontWeight:700,color:'#5a7a8a',letterSpacing:'0.5px'},
  fChip:{fontSize:7,padding:'2px 5px',borderRadius:3,cursor:'pointer',fontWeight:700,letterSpacing:'0.3px',border:'1px solid #1a2332'},
  flowTh:{padding:'4px 5px',backgroundColor:'#080c14',color:'#2a3a4a',fontWeight:700,textAlign:'left',position:'sticky',top:0,fontSize:7,whiteSpace:'nowrap',borderBottom:'1px solid #1a2332'},
  flowTd:{padding:'3px 5px',fontSize:8,color:'#5a7a8a',whiteSpace:'nowrap',borderBottom:'1px solid rgba(255,255,255,0.02)'},
  condBadge:{fontSize:7,fontWeight:800,padding:'1px 4px',borderRadius:2,letterSpacing:'0.3px'},
  gradeBadge:{fontSize:8,fontWeight:900,padding:'1px 5px',borderRadius:2,letterSpacing:'0.3px'},
};

export default SmartMoneyDashboard;
