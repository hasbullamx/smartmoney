import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';

const SmartMoneyDashboard = () => {
  const [ticker, setTicker] = useState('SPY');
  const [price, setPrice] = useState(7353.94);
  const [priceChange, setPriceChange] = useState(1.30);
  const [heatmapData, setHeatmapData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [smartMoneyScore, setSmartMoneyScore] = useState(0);
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [sectorHeatmap, setSectorHeatmap] = useState([]);
  const [loading, setLoading] = useState(false);

  // Generate mock heatmap data
  const generateHeatmapData = useCallback((tickerSymbol, currentPrice) => {
    const strikes = [];
    const baseStrike = Math.floor(currentPrice / 5) * 5;
    
    for (let i = -10; i <= 10; i++) {
      const strike = baseStrike + (i * 5);
      const expirations = ['0DTE', '7DTE', '14DTE', '30DTE'];
      
      expirations.forEach((exp) => {
        const daysToExp = parseInt(exp);
        const isOTM = i !== 0; // Strike is OTM if not at current price
        const baseVolume = Math.random() * 5000 + 1000;
        const baseOI = Math.random() * 10000 + 5000;
        const volumeChange = ((Math.random() - 0.3) * 100).toFixed(1);
        
        // Golden Sweep detection logic
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
        
        // Calculate smart money score contribution
        let scoreContribution = 50; // base neutral
        scoreContribution += isBullish ? 10 : -10;
        scoreContribution += vOiRatio > 3 ? 15 : 0;
        scoreContribution += premium > 500000 ? 15 : premium > 100000 ? 5 : 0;
        scoreContribution += isSweep ? 10 : 0;
        scoreContribution += isGoldenSweep ? 25 : 0;
        
        // Color intensity calculation
        const intensity = Math.log(premium / 10000) / Math.log(10);
        const hue = isBullish ? 120 : 0; // Green for bullish, red for bearish
        const saturation = Math.min(100, intensity * 30);
        const lightness = 45;
        
        strikes.push({
          strike,
          expiration: exp,
          callOrPut,
          volume: baseVolume.toFixed(0),
          openInterest: baseOI.toFixed(0),
          volumeChange: parseFloat(volumeChange),
          premium: premium,
          vOiRatio: vOiRatio,
          isAskSide,
          isSweep,
          isGoldenSweep,
          scoreContribution,
          color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
          intensity,
        });
      });
    }
    
    return strikes;
  }, []);

  // Generate sector heatmap
  const generateSectorHeatmap = useCallback(() => {
    const sectors = [
      { name: 'Tech', change: 2.3, bullishCount: 12, bearishCount: 3 },
      { name: 'Finance', change: 1.8, bullishCount: 8, bearishCount: 5 },
      { name: 'Healthcare', change: -0.5, bullishCount: 4, bearishCount: 9 },
      { name: 'Energy', change: 3.2, bullishCount: 10, bearishCount: 2 },
      { name: 'Retail', change: 0.8, bullishCount: 6, bearishCount: 7 },
    ];
    
    return sectors.map((sector) => ({
      ...sector,
      color: sector.change >= 0 ? 'hsl(120, 70%, 45%)' : 'hsl(0, 70%, 45%)',
    }));
  }, []);

  // Initialize data on mount
  useEffect(() => {
    setLoading(true);
    const data = generateHeatmapData(ticker, price);
    setHeatmapData(data);
    setSectorHeatmap(generateSectorHeatmap());
    
    // Check for golden sweeps
    const goldenSweeps = data.filter(d => d.isGoldenSweep);
    if (goldenSweeps.length > 0) {
      const newAlerts = goldenSweeps.map((sweep) => ({
        id: Math.random(),
        type: 'golden-sweep',
        message: `🔥 GOLDEN SWEEP: ${ticker} ${sweep.strike} ${sweep.callOrPut.toUpperCase()} | ${sweep.expiration} | Premium: $${(sweep.premium / 1000).toFixed(0)}K`,
        timestamp: new Date(),
        severity: 'high',
      }));
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 10));
    }
    
    // Calculate average smart money score
    const avgScore = Math.round(data.reduce((sum, d) => sum + d.scoreContribution, 0) / data.length);
    setSmartMoneyScore(Math.min(100, Math.max(0, avgScore)));
    
    setLoading(false);
  }, [ticker, price, generateHeatmapData, generateSectorHeatmap]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPrice((prev) => {
        const change = (Math.random() - 0.5) * 5;
        return parseFloat((prev + change).toFixed(2));
      });
      
      setPriceChange((prev) => {
        const change = (Math.random() - 0.5) * 0.5;
        return parseFloat((prev + change).toFixed(2));
      });
    }, 15000); // 15 second updates
    
    return () => clearInterval(interval);
  }, []);

  const handleStrikeClick = (strike) => {
    setSelectedStrike(strike);
    // Generate mock chart data
    const mockChartData = Array.from({ length: 20 }, (_, i) => ({
      time: i,
      open: price + (Math.random() - 0.5) * 10,
      high: price + (Math.random() * 10),
      low: price - (Math.random() * 10),
      close: price + (Math.random() - 0.5) * 10,
    }));
    setChartData(mockChartData);
  };

  const handleSectorClick = (sector) => {
    setTicker(sector.name); // Simplified - would normally drill into sector stocks
  };

  // Render heatmap cell with intensity-based coloring
  const renderHeatmapCell = (data) => {
    const intensity = Math.min(100, data.intensity * 40);
    const isSelected = selectedStrike?.strike === data.strike && selectedStrike?.expiration === data.expiration;
    
    return (
      <div
        key={`${data.strike}-${data.expiration}`}
        className={`heatmap-cell ${isSelected ? 'selected' : ''} ${data.isGoldenSweep ? 'golden-sweep' : ''}`}
        style={{
          backgroundColor: data.color,
          opacity: 0.4 + (intensity / 100) * 0.6,
          borderColor: data.isGoldenSweep ? '#FFD700' : 'transparent',
          borderWidth: data.isGoldenSweep ? '2px' : '1px',
          cursor: 'pointer',
        }}
        onClick={() => handleStrikeClick(data)}
        title={`${data.strike} ${data.expiration} | Vol: ${data.volume} | OI: ${data.openInterest} | Change: ${data.volumeChange}%`}
      >
        {data.isGoldenSweep && <span className="golden-indicator">⭐</span>}
        <span className="volume-change">{data.volumeChange > 0 ? '+' : ''}{data.volumeChange.toFixed(0)}%</span>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Smart Money Options Flow</h1>
          <div className="ticker-search">
            <input
              type="text"
              placeholder="Search ticker..."
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="ticker-input"
            />
          </div>
        </div>
        <div className="header-center">
          <div className="price-display">
            <span className="price">${price.toFixed(2)}</span>
            <span className={`change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="header-right">
          <div className="smart-money-score">
            <div className="score-label">Smart Money Score</div>
            <div className={`score-value score-${Math.floor(smartMoneyScore / 25)}`}>
              {smartMoneyScore}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Left Sidebar - Sector Heatmap */}
        <aside className="sidebar-left">
          <h2>Sector Heat</h2>
          <div className="sector-heatmap">
            {sectorHeatmap.map((sector) => (
              <div
                key={sector.name}
                className="sector-card"
                style={{ backgroundColor: sector.color }}
                onClick={() => handleSectorClick(sector)}
              >
                <div className="sector-name">{sector.name}</div>
                <div className="sector-change">{sector.change >= 0 ? '+' : ''}{sector.change.toFixed(1)}%</div>
                <div className="sector-flows">
                  <span className="bullish">📈 {sector.bullishCount}</span>
                  <span className="bearish">📉 {sector.bearishCount}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center - Heatmap & Chart */}
        <div className="center-content">
          {/* Options Heatmap */}
          <div className="heatmap-container">
            <h2>Options Flow Heatmap</h2>
            <div className="heatmap-legend">
              <span className="legend-item">🟢 Bullish</span>
              <span className="legend-item">🔴 Bearish</span>
              <span className="legend-item">🟣 High Conviction</span>
              <span className="legend-item">⭐ Golden Sweep</span>
            </div>
            <div className="heatmap-grid">
              <div className="heatmap-header">
                <div className="strike-column">STRIKE</div>
                {['0DTE', '7DTE', '14DTE', '30DTE'].map((exp) => (
                  <div key={exp} className="expiration-column">{exp}</div>
                ))}
              </div>
              <div className="heatmap-body">
                {Array.from({ length: 21 }, (_, i) => {
                  const strikeGroup = i - 10;
                  const baseStrike = Math.floor(price / 5) * 5;
                  const strikePrice = baseStrike + (strikeGroup * 5);
                  
                  return (
                    <div key={strikePrice} className="heatmap-row">
                      <div className="strike-label">{strikePrice}</div>
                      {['0DTE', '7DTE', '14DTE', '30DTE'].map((exp) => {
                        const cellData = heatmapData.find((d) => d.strike === strikePrice && d.expiration === exp);
                        return cellData ? renderHeatmapCell(cellData) : <div key={`${strikePrice}-${exp}`} className="heatmap-cell empty" />;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart Panel */}
          {selectedStrike && (
            <div className="chart-container">
              <h3>{ticker} {selectedStrike.strike} {selectedStrike.callOrPut.toUpperCase()} | {selectedStrike.expiration}</h3>
              <div className="chart-mock">
                <div className="chart-placeholder">
                  <span>Chart View - {selectedStrike.strike} Strike</span>
                  <span className="small">Volume: {selectedStrike.volume} | OI: {selectedStrike.openInterest}</span>
                  <span className="small">Premium: ${(selectedStrike.premium / 1000).toFixed(0)}K | V/OI: {selectedStrike.vOiRatio}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Alerts & Smart Money Details */}
        <aside className="sidebar-right">
          <div className="alerts-panel">
            <h2>🔔 Alerts</h2>
            <div className="alerts-list">
              {alerts.length === 0 ? (
                <div className="no-alerts">Waiting for signals...</div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className={`alert alert-${alert.severity}`}>
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-time">{alert.timestamp.toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="smart-money-details">
            <h2>Smart Money Signals</h2>
            <div className="signal-item">
              <span className="signal-label">Golden Sweeps</span>
              <span className="signal-value">{heatmapData.filter((d) => d.isGoldenSweep).length}</span>
            </div>
            <div className="signal-item">
              <span className="signal-label">High V/OI (>3)</span>
              <span className="signal-value">{heatmapData.filter((d) => d.vOiRatio > 3).length}</span>
            </div>
            <div className="signal-item">
              <span className="signal-label">Institutional Size</span>
              <span className="signal-value">{heatmapData.filter((d) => d.premium > 100000).length}</span>
            </div>
            <div className="signal-item">
              <span className="signal-label">Sweeps Detected</span>
              <span className="signal-value">{heatmapData.filter((d) => d.isSweep).length}</span>
            </div>
          </div>

          <div className="spy-integration">
            <h2>SPY/SPX Monitor</h2>
            <div className="integration-placeholder">
              <span>Connected to your analysis tool</span>
              <button className="integration-btn">Open SPY/SPX</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SmartMoneyDashboard;
