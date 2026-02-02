function GraphApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialView = parseInt(urlParams.get('view') || '0');
  const initialPeak = urlParams.get('peak') ? parseInt(urlParams.get('peak')) : null;
  const loadingMessages = ['Gathering player data...', 'Counting servers...', 'Crunching numbers...', 'Loading statistics...', 'Fetching latest data...', 'Analyzing trends...', 'Preparing charts...', 'Almost there...'];
  const [loadingMessage, setLoadingMessage] = React.useState('');
  const [view, setView] = React.useState(initialView);
  const [viewTitle, setViewTitle] = React.useState(initialPeak ? '' : '24 Hours');
  const [timeFormat, setTimeFormat] = React.useState('%I:%M %p');
  const [dataPoints, setDataPoints] = React.useState([]);
  const [peakPlayerCount, setPeakPlayerCount] = React.useState(0);
  const [alltimePeakPlayerCount, setAlltimePeakPlayerCount] = React.useState(0);
  const [peakTimestamp2, setPeakTimestamp2] = React.useState(null);
  const [individualPeakServer, setIndividualPeakServer] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [viewLoading, setViewLoading] = React.useState(false);
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [error, setError] = React.useState(false);
  const chartRef = React.useRef(null);
  const chartInstanceRef = React.useRef(null);
  const timeFormats = ['%I:%M %p', '%m/%d %I %p', '%m/%d', '%b %d'];
  const viewTitles = ['24 Hours', 'Week', 'Month', 'Year'];

  const seriesData = React.useMemo(() => {
    const seriesMap = new Map(), totalMap = new Map();
    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i], timestamp = point.timestamp, serverName = point.serverName, playerCount = point.playerCount;
      if (!seriesMap.has(serverName)) seriesMap.set(serverName, []);
      seriesMap.get(serverName).push([timestamp, playerCount]);
      totalMap.set(timestamp, (totalMap.get(timestamp) || 0) + playerCount);
    }
    const series = [];
    let colorIndex = 1;
    const getColor = (index) => `hsl(${(index * 360 / 100) % 260}, 70%, 50%)`;
    for (const [serverName, data] of seriesMap) {
      data.sort((a, b) => a[0] - b[0]);
      series.push({name: serverName, data: data, color: getColor(colorIndex++)});
    }
    const totalData = Array.from(totalMap.entries()).sort((a, b) => a[0] - b[0]);
    series.unshift({name: 'All Servers', data: totalData, color: '#ffffff', lineWidth: 3});
    return series;
  }, [dataPoints]);

  React.useEffect(() => {
    let apiUrl = 'https://api.moreno.land/api/graalstats/stats/' + view + '/processed';
    if (initialPeak) apiUrl += '?peak=' + initialPeak;
    setLoadingProgress(0);
    setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    const messageInterval = setInterval(() => setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]), 1500);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);
    xhr.responseType = 'json';
    xhr.onprogress = () => setLoadingProgress(10);
    xhr.onload = function() {
      if (xhr.status === 200) {
        setLoadingProgress(50);
        var data = xhr.response;
        setTimeout(() => {
          if (data.error) { setError(true); setLoading(false); setLoadingProgress(0); clearInterval(messageInterval); return; }
          setLoadingProgress(90);
          setDataPoints(data.dataPoints || []);
          setPeakPlayerCount(data.peakPlayerCount || 0);
          setAlltimePeakPlayerCount(data.alltimePeakPlayerCount || 0);
          setPeakTimestamp2(data.peakTimestamp || null);
          setIndividualPeakServer(data.individualPeakServer || '');
          if (initialPeak) {
            const date = new Date(initialPeak * 1000);
            setViewTitle('Around ' + date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'}) + ' on ' + (date.getMonth()+1) + '/' + date.getDate() + '/' + date.getFullYear().toString().slice(-2));
          } else setViewTitle(viewTitles[view]);
          setTimeFormat(timeFormats[view]);
          setTimeout(() => { setLoadingProgress(100); setLoading(false); setLoadingProgress(0); clearInterval(messageInterval); }, 100);
        }, 50);
      }
    };
    xhr.onerror = () => { console.error('Error loading graph data'); setError(true); setLoading(false); setLoadingProgress(0); clearInterval(messageInterval); };
    xhr.send();
  }, []);

  React.useEffect(() => {
    if (loading || !chartRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.update({title: { text: viewTitle }, xAxis: { labels: { formatter: function() { return Highcharts.dateFormat(timeFormat, this.value); }}}, series: seriesData}, false, false);
      chartInstanceRef.current.redraw();
      return;
    }
    if (typeof Highcharts === 'undefined') { console.error('Highcharts not loaded'); return; }
    chartInstanceRef.current = Highcharts.chart(chartRef.current, {
      chart: {type: 'line', backgroundColor: 'rgba(30, 80, 40, 0)', marginTop: 50, height: 800, width: null, borderWidth: 0, plotBorderWidth: 0, borderRadius: 10, animation: false, plotOptions: {series: {animation: false, lineWidth: 2, dataGrouping: {enabled: true, approximation: 'average', groupPixelWidth: 2}}}, tooltip: {animation: false}, events: {render: function() { const titleEl = this.title.element; titleEl.style.cursor = 'pointer'; titleEl.onclick = function() { const hasHidden = chartInstanceRef.current.series.some(s => !s.visible); if (hasHidden) { chartInstanceRef.current.series.forEach(s => s.setVisible(true, false)); chartInstanceRef.current.setTitle({ text: viewTitle }); chartInstanceRef.current.redraw(); }}}}},
      title: {text: null, style: {display: 'none'}},
      xAxis: {type: 'datetime', title: { text: 'Timestamp (' + (new Date().getTimezoneOffset() === 240 ? 'EDT' : 'EST') + ')', style: { color: '#ffffff', fontFamily: 'Tempus Sans ITC', fontWeight: 'bold' }}, labels: {style: { color: '#ffffff', fontFamily: 'Tempus Sans ITC', fontWeight: 'bold' }, formatter: function() { return Highcharts.dateFormat(timeFormat, this.value - 5 * 3600 * 1000); }}},
      yAxis: {title: { text: '', style: { color: '#ffffff', fontFamily: 'Tempus Sans ITC', fontWeight: 'bold' }}, min: 0, labels: { style: { color: '#ffffff', fontFamily: 'Tempus Sans ITC', fontWeight: 'bold' }}},
      series: seriesData,
      tooltip: {shared: false, crosshairs: true, useHTML: true, style: { color: '#ffffff', fontFamily: 'Tempus Sans ITC', fontWeight: 'bold' }, backgroundColor: '#333333', borderColor: '#444444', formatter: function() { return `<b>${Highcharts.dateFormat('%m-%d-%Y at %I:%M %p', this.x - 5 * 3600 * 1000)}</b><br/><span style="display:inline-block;width:10px;height:10px;background-color:${this.series.color};border-radius:50%;margin-right:5px;"></span>${this.series.name}: ${this.y}`; }},
      plotOptions: {series: {marker: { enabled: false }, animation: false, events: {legendItemClick: function() { const chart = chartInstanceRef.current, series = chart.series, visibleCount = series.filter(s => s.visible).length; if (visibleCount === 1 && this.visible) { series.forEach(s => s.setVisible(true, false)); chart.setTitle({ text: viewTitle }); } else { const isVisible = this.visible; if (!isVisible) { series.forEach(s => s.setVisible(false, false)); this.setVisible(true, false); chart.setTitle({ text: this.name }); } else { series.forEach(s => s.setVisible(true, false)); chart.setTitle({ text: viewTitle }); }} chart.redraw(); return false; }}}},
      credits: { enabled: false },
      legend: { enabled: true, itemStyle: { color: '#ffffff', fontWeight: 'bold', fontFamily: 'Tempus Sans ITC' }},
      accessibility: { enabled: true },
      exporting: {
        buttons: {
          contextButton: {
            menuItems: [
            'downloadPDF',
            'downloadPNG',
            {
              text: 'Download CSV',
              onclick: function() {
                const headers = ['Timestamp', 'Date', 'Server Name', 'Player Count'];
                const rows = dataPoints.map(point => [
                  point.timestamp,
                  new Date(point.timestamp * 1000).toISOString(),
                  point.serverName,
                  point.playerCount
                ]);
                const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'graal_stats_' + viewTitle.toLowerCase().replace(/\s+/g, '_') + '.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }
            },
            {
              text: 'Download JSON',
              onclick: function() {
                const data = dataPoints.map(point => ({
                  timestamp: point.timestamp,
                  date: new Date(point.timestamp * 1000).toISOString(),
                  serverName: point.serverName,
                  playerCount: point.playerCount
                }));
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'graal_stats_' + viewTitle.toLowerCase().replace(/\s+/g, '_') + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }
            }
          ],
            style: { color: '#ffffff', backgroundColor: 'transparent', border: 'none', borderRadius: '0', padding: '5px 10px', cursor: 'pointer' },
            align: 'right',
            verticalAlign: 'bottom',
            y: -10,
            x: -10
          }
        },
        scale: 2,
        sourceWidth: undefined,
        sourceHeight: undefined,
        chartOptions: {
          xAxis: {
            labels: { style: { color: '#000000' } },
            title: { style: { color: '#000000' } }
          },
          yAxis: {
            labels: { style: { color: '#000000' } },
            title: { style: { color: '#000000' } }
          },
          legend: {
            itemStyle: { color: '#000000', fontWeight: 'bold' }
          },
          title: {
            style: { color: '#000000' }
          }
        }
      }
    });
    chartInstanceRef.current.reflow();
    return () => { if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; }};
  }, [seriesData, viewTitle, timeFormat, loading, viewLoading]);

  function loadView(newView) {
    if (newView === view) return;
    setViewLoading(true);
    setLoadingProgress(0);
    setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    const messageInterval = setInterval(() => setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]), 1500);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.moreno.land/api/graalstats/stats/' + newView + '/processed', true);
    xhr.responseType = 'json';
    xhr.onprogress = () => setLoadingProgress(10);
    xhr.onload = function() {
      if (xhr.status === 200) {
        setLoadingProgress(50);
        var data = xhr.response;
        setTimeout(() => {
          setLoadingProgress(90);
          setView(newView);
          setViewTitle(viewTitles[newView]);
          setTimeFormat(timeFormats[newView]);
          setDataPoints(data.dataPoints || []);
          setPeakPlayerCount(data.peakPlayerCount || 0);
          setAlltimePeakPlayerCount(data.alltimePeakPlayerCount || 0);
          setPeakTimestamp2(data.peakTimestamp || null);
          setIndividualPeakServer(data.individualPeakServer || '');
          setTimeout(() => { setLoadingProgress(100); setViewLoading(false); setLoadingProgress(0); clearInterval(messageInterval); }, 100);
          var url = new URL(window.location);
          url.searchParams.set('view', newView);
          url.searchParams.delete('peak');
          window.history.pushState(null, '', url);
        }, 50);
      }
    };
    xhr.onerror = () => { console.error('Error loading graph data'); setViewLoading(false); setLoadingProgress(0); clearInterval(messageInterval); };
    xhr.send();
  }

  if (error) return React.createElement('div', { className: 'error-message' }, React.createElement('p', null, '🔌 Database temporarily unavailable'), React.createElement('p', null, 'Please try again in a few minutes'));

  const peakUrl = "/?graph&peak=" + (peakTimestamp2 ? peakTimestamp2 : Date.now());
  const peakTime = peakTimestamp2 ? new Date(peakTimestamp2 - 4 * 3600 * 1000) : null;
  const timezone = new Date().getTimezoneOffset() === 240 ? 'EDT' : 'EST';

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px' } },
      React.createElement('p', null, 'There was a ', React.createElement('a', { href: peakUrl, style: { color: '#40ff40', textDecoration: 'none', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, 'peak'), ' of ', React.createElement('font', { style: { textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' }, color: 'yellow' }, alltimePeakPlayerCount.toLocaleString()), ' player(s) online during the last ', React.createElement('font', { style: { fontWeight: 'bold' } }, viewTitle.toLowerCase()), peakTime ? '. (Peaked at ' + new Date(peakTime).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, month: 'numeric', day: 'numeric', year: '2-digit' }) + ' ' + timezone + ')' : ''),
      React.createElement('p', null, 'The top server ', React.createElement('font', { style: { textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', color: '#40ff40', fontWeight: 'bold' } }, individualPeakServer), ' had a peak of ', React.createElement('font', { style: { textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' }, color: 'yellow' }, peakPlayerCount.toLocaleString()), ' player(s) during this time.'),
      React.createElement('p', { style: { marginTop: '1px' } }, React.createElement('a', { href: '/?list', onClick: (e) => { e.preventDefault(); window.location.href = '/?list'; }, style: { color: '#40ff40', textDecoration: 'none', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, 'View List'), React.createElement('br'), React.createElement('a', { href: '/?changes', onClick: (e) => { e.preventDefault(); window.location.href = '/?changes'; }, style: { color: '#40ff40', textDecoration: 'none', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, 'View Changes'), React.createElement('br'), React.createElement('br'), React.createElement('a', { onClick: () => loadView(0), style: { color: view === 0 ? 'yellow' : '#40ff40', textDecoration: 'none', cursor: 'pointer', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, '24 Hours'), ' | ', React.createElement('a', { onClick: () => loadView(1), style: { color: view === 1 ? 'yellow' : '#40ff40', textDecoration: 'none', cursor: 'pointer', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, 'Week'), ' | ', React.createElement('a', { onClick: () => loadView(2), style: { color: view === 2 ? 'yellow' : '#40ff40', textDecoration: 'none', cursor: 'pointer', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, 'Month'), ' | ', React.createElement('a', { onClick: () => loadView(3), style: { color: view === 3 ? 'yellow' : '#40ff40', textDecoration: 'none', cursor: 'pointer', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)', fontWeight: 'bold' } }, 'Year'))
    ),
    React.createElement('div', { style: { width: '100%', padding: '0 10px' } }, React.createElement('div', { className: 'chart-wrapper', style: { position: 'relative', margin: '0 auto' } }, viewLoading && React.createElement('div', { style: { position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, textAlign: 'center' } }, React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '5px' } }, loadingMessage), React.createElement('div', { style: { width: '300px', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '3px', overflow: 'hidden' } }, React.createElement('div', { style: { width: loadingProgress + '%', height: '100%', backgroundColor: '#40ff40', transition: 'width 0.1s ease' } }))), React.createElement('div', { ref: chartRef, className: 'chart' }))),
    React.createElement('footer', { style: { textAlign: 'center', marginTop: '20px', color: '#ffffff' } }, React.createElement('p', null, 'This data is updated every 10 minutes.'), React.createElement('p', null, React.createElement('a', { href: 'https://graalonline.com', style: { color: '#40ff40', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)' } }, 'Graal Online'), ' is Copyright/trademarked to ', React.createElement('a', { href: 'https://www.toonslab.com/', style: { color: '#40ff40', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)' } }, 'Toonslab'), ' and is in no way affiliated with this site.'), React.createElement('p', { style: { fontSize: '0.7em', marginTop: '10px' } }, '* Some servers are not shown as they are not playable/joinable.'))
  );
}
