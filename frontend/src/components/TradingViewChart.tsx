import React, { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  tvSymbol: string;
  theme?: 'dark' | 'light';
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  tvSymbol,
  theme = 'dark'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Reset container contents
    containerRef.current.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    widgetWrapper.style.height = '100%';
    widgetWrapper.style.width = '100%';
    containerRef.current.appendChild(widgetWrapper);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '15',
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: '#0A0A0C',
      gridColor: 'rgba(255, 42, 77, 0.04)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com'
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, theme]);

  return (
    <div className="tradingview-widget-container w-full h-full relative rounded-xl overflow-hidden bg-obsidian-950 border border-obsidian-800" ref={containerRef}>
      <div className="tradingview-widget-container__widget h-full w-full flex items-center justify-center text-slate-500 text-xs font-mono">
        Loading TradingView Chart ({tvSymbol})...
      </div>
    </div>
  );
};
