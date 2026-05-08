import React, { useState, useEffect, useCallback } from 'react';

const SmartMoneyDashboard = () => {
  const [customTicker, setCustomTicker] = useState('QQQ');
  const [customTickerInput, setCustomTickerInput] = useState('');
  
  const tickerData = {
    SPX: { price: 5932.80, priceChange: 1.45, basePrice: 5930 },
    SPY: { price: 585.43, priceChange: 1.30, basePrice: 585 },
    QQQ: { price: 428.75, priceChange: 2.12, basePrice: 425 },
    NVDA: { price: 134.52, priceChange: 0.85, basePrice: 135 },
    AAPL: { price: 234.18, priceChange: -0.45, basePrice: 234 },
    TSLA: { price: 312.45, priceChange: 3.22, basePrice: 310 },
  };

  const expirationRanges = {
    quick: ['0DTE', '2DTE', '4DTE', '7DTE'],
    monthly: ['14DTE', '21DTE', '30DTE', '45DTE'],
  };

  const [heatmapDataAll, setHeatmapDataAll] = useState({});
  const [expandedMonthlyData, setExpandedMonthlyData] = useState([]);
  const [smartMoneyScoreAll, setSmartMoneyScoreAll] = useState({});
  const [goldenSweepsAll, setGoldenSweepsAll] = useState([]);

  const generateHeatmapData = useCallback((ticker, basePrice, expirations) => {
    const strikes = [];
    const baseStrike = Math.floor(basePrice / 5) * 5;
    
    for (let i = -10; i <= 10; i++) {
      const strike = baseStrike + (i * 5);
      
      expirations.forEach((exp) => {
        const daysToExp = parseInt(exp);
        const isOTM = i !== 0;
        const baseVolume = Math.random() * 5000 + 1000;
        const baseOI = Math.random() * 10000 + 5000;
        const volumeChange = ((Math.random() - 0.3) * 100).toFixed(1);
        
        const premium = (Math.random() * 2000000 + 100000).toFixed(0);
        const vOiRatio = (baseVolume / baseOI).toFixed(2);
        const isAskSide = Math.random() > 0.3;
        const isSweep = Math.random() > 0.7;
        
        const isGoldenSweep = 
          premium > 500000 && 
          isOTM && 
          daysToExp <= 7 && 
          isSweep && 
          isAskSide;
        
        const callOrPut = Math.random() > 0.5 ? 'call' : 'put';
        const isBullish = (callOrPut === 'call' && isAskSide) || (callOrPut === 'put' && !isAskSide);
        
        let scoreContribution = 50;
        scoreContribution += isBullish ? 10 : -10;
        scoreContribution += vOiRatio > 3 ? 15 : 0;
        scoreContribution += premium > 500000 ? 15 : premium > 100000 ? 5 : 0;
        scoreContribution += isSweep ? 10 : 0;
        scoreContribution += isGoldenSweep ? 25 : 0;
        
        const intensity = Math.log(premium / 10000) / Math.log(10);
        const hue = isBullish ? 120 : 0;
        const saturation = Math.min(100, intensity * 30);
        const lightness = 45;
        
        strikes.push({
          strike,
          expiration: exp,
          callOrPut,
          volume: baseVolume.toFixed(0),
          openInterest: baseOI.toFixed(0),
          volumeChange: parseFloat(volumeChange),
          premium: parseFloat(premium),
          vOiRatio: parseFloat(vOiRatio),
          isAskSide,
          isSweep,
          isGoldenSweep,
          scoreContribution,
          color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
          intensity,
          ticker,
        });
      });
    }
    
    return strikes;
  }, []);

  const calculateSmartMoneyScore = useCallback((data) => {
    if (data.length === 0) return 0;
    const avgScore = data.reduce((sum, d) => sum + d.scoreContribution, 0) / data.length;
    return Math.min(100, Math.max(0, Math.round(avgScore)));
  }, []);

  const getGrade = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    return 'C';
  };

  useEffect(() => {
    const allData = {};
    const allScores = {};
    const allGoldenSweeps = [];
    
    [{ name: 'SPX', data: tickerData.SPX }, 
     { name: 'SPY', data: tickerData.SPY },
     { name: customTicker, data: tickerData[customTicker] || { price: 100, basePrice: 100 } }
    ].forEach(({ name, data }) => {
      const quickData = generateHeatmapData(name, data.basePrice, expirationRanges.quick);
      const monthlyData = generateHeatmapData(name, data.basePrice, expirationRanges.monthly);
      
      allData[name] = quickData;
      allScores[name] = calculateSmartMoneyScore(quickData);
      
      const goldenSweeps = [...quickData, ...monthlyData].filter(d => d.isGoldenSweep);
      goldenSweeps.forEach(sweep => {
        allGoldenSweeps.push({
          ticker: name,
          strike: sweep.strike,
          type: sweep.callOrPut.toUpperCase(),
          expiration: sweep.expiration,
          premium: sweep.premium,
          score: sweep.scoreContribution,
          grade: getGrade(sweep.scoreContribution),
        });
      });
    });
    
    allGoldenSweeps.sort((a, b) => b.premium - a.premium);
    
    const monthlyData = generateHeatmapData(customTicker, tickerData[customTicker]?.basePrice || 100, expirationRanges.monthly);
    
    setHeatmapDataAll(allData);
    setSmartMoneyScoreAll(allScores);
    setGoldenSweepsAll(allGoldenSweeps.slice(0, 15));
    setExpandedMonthlyData(monthlyData);
  }, [customTicker, generateHeatmapData, calculateSmartMoneyScore]);

  const handleTickerSearch = (e) => {
    const value = e.target.value.toUpperCase();
    setCustomTickerInput(value);
    if (value && tickerData[value]) {
      setCustomTicker(value);
      setCustomTickerInput('');
    }
  };

  const renderHeatmap = (ticker, data) => {
    const strikes = [];
    const baseStrike = Math.floor((tickerData[ticker]?.basePrice || 100) / 5) * 5;
    
    for (let i = -10; i <= 10; i++) {
      const strikePrice = baseStrike + (i * 5);
      const strikeData = data.filter(d => d.strike === strikePrice);
      strikes.push({ price: strikePrice, data: strikeData });
    }
    
    return (
      <div className="heatmap-container">
        <div className="heatmap-header">
          <div className="ticker-title">{ticker}</div>
          <div className="price-info">
            ${tickerData[ticker]?.price.toFixed(2)} 
            <span className={tickerData[ticker]?.priceChange >= 0 ? 'positive' : 'negative'}>
              {tickerData[ticker]?.priceChange >= 0 ? '+' : ''}{tickerData[ticker]?.priceChange.toFixed(2)}%
            </span>
          </div>
        </div>
        
        <div className="heatmap-grid">
          <div className="heatmap-body">
            {strikes.map((strike) => (
              <div key={strike.price} className="heatmap-row">
                <div className="strike-label">{strike.price}</div>
                {data.filter(d => d.strike === strike.price).map((cell, idx) => (
                  <div
                    key={idx}
                    className={`heatmap-cell ${cell.isGoldenSweep ? 'golden-sweep' : ''}`}
                    style={{
                      backgroundColor: cell.color,
                      opacity: 0.4 + (cell.intensity / 100) * 0.6,
                      borderColor: cell.isGoldenSweep ? '#FFD700' : 'transparent',
                    }}
                    title={`${cell.strike} ${cell.expiration} | Vol: ${cell.volume} | Change: ${cell.volumeChange}%`}
                  >
                    {cell.isGoldenSweep && <span className="golden-indicator">⭐</span>}
                    <span className="vol-change">{cell.volumeChange > 0 ? '+' : ''}{cell.volumeChange.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-main">
      <div className="left-panel">
        <div className="heatmap-wrapper">
          {renderHeatmap('SPX', heatmapDataAll['SPX'] || [])}
        </div>
        <div className="heatmap-wrapper">
          {renderHeatmap('SPY', heatmapDataAll['SPY'] || [])}
        </div>
        <div className="heatmap-wrapper">
          <div className="custom-ticker-search">
            <input
              type="text"
              placeholder="Search ticker..."
              value={customTickerInput}
              onChange={handleTickerSearch}
              className="search-input"
            />
          </div>
          {renderHeatmap(customTicker, heatmapDataAll[customTicker] || [])}
        </div>
      </div>

      <div className="right-panel">
        <div className="grid-cell top-left">
          <div className="cell-header">Expanded Monthly Heatmap</div>
          <div className="heatmap-expanded">
            {renderHeatmap(`${customTicker} (Monthly)`, expandedMonthlyData)}
          </div>
        </div>

        <div className="grid-cell top-right">
          <div className="cell-header">Real-time Flow Scorecard</div>
          <div className="scorecard-container">
            <div className="score-display">
              <div className="score-spx">
                <div className="score-label">SPX</div>
                <div className={`score-value grade-${getGrade(smartMoneyScoreAll['SPX'] || 0)}`}>
                  {smartMoneyScoreAll['SPX'] || 0}
                </div>
                <div className="score-grade">{getGrade(smartMoneyScoreAll['SPX'] || 0)}</div>
              </div>
              <div className="score-spy">
                <div className="score-label">SPY</div>
                <div className={`score-value grade-${getGrade(smartMoneyScoreAll['SPY'] || 0)}`}>
                  {smartMoneyScoreAll['SPY'] || 0}
                </div>
                <div className="score-grade">{getGrade(smartMoneyScoreAll['SPY'] || 0)}</div>
              </div>
              <div className={`score-custom grade-${customTicker}`}>
                <div className="score-label">{customTicker}</div>
                <div className={`score-value grade-${getGrade(smartMoneyScoreAll[customTicker] || 0)}`}>
                  {smartMoneyScoreAll[customTicker] || 0}
                </div>
                <div className="score-grade">{getGrade(smartMoneyScoreAll[customTicker] || 0)}</div>
              </div>
            </div>

            <div className="alerts-section">
              <div className="section-title">Flow Alerts</div>
              <div className="alerts-list">
                <div className="alert-item">
                  <span className="alert-label">Sweep Activity</span>
                  <span className="alert-value">{goldenSweepsAll.length}</span>
                </div>
                <div className="alert-item">
                  <span className="alert-label">Golden Sweeps</span>
                  <span className="alert-value">{goldenSweepsAll.filter(g => g.grade === 'A+').length}</span>
                </div>
                <div className="alert-item">
                  <span className="alert-label">A-Grade Activity</span>
                  <span className="alert-value">{goldenSweepsAll.filter(g => g.grade === 'A').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-cell bottom-left">
          <div className="cell-header">SPX Live Chart</div>
          <div className="chart-placeholder">
            <div className="chart-mock">
              <div>SPX Candlestick Chart</div>
              <div className="chart-info">
                <span>Real-time data from Polygon API</span>
                <span>Synchronized with heatmaps</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-cell bottom-right">
          <div className="cell-header">🔥 Golden Sweeps Detected</div>
          <div className="golden-sweeps-list">
            {goldenSweepsAll.length === 0 ? (
              <div className="no-sweeps">Waiting for signals...</div>
            ) : (
              goldenSweepsAll.slice(0, 10).map((sweep, idx) => (
                <div key={idx} className={`sweep-item grade-${sweep.grade}`}>
                  <div className="sweep-info">
                    <span className="sweep-ticker">{sweep.ticker}</span>
                    <span className="sweep-strike">{sweep.strike} {sweep.type}</span>
                    <span className="sweep-exp">{sweep.expiration}</span>
                  </div>
                  <div className="sweep-details">
                    <span className="sweep-premium">${(sweep.premium / 1000).toFixed(0)}K</span>
                    <span className={`sweep-grade grade-${sweep.grade}`}>{sweep.grade}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartMoneyDashboard;
