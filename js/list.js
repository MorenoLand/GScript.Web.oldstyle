function useMapTooltip() {
  const tooltipRef = React.useRef(null), imageCache = React.useRef(new Map()), loadingImages = React.useRef(new Set()), hideTimeoutRef = React.useRef(null), showTimeoutRef = React.useRef(null);
  React.useEffect(() => {
    if (!tooltipRef.current) { tooltipRef.current = document.createElement('div'); tooltipRef.current.id = 'map-tooltip'; document.body.appendChild(tooltipRef.current); }
    return () => { if (tooltipRef.current && tooltipRef.current.parentNode) tooltipRef.current.parentNode.removeChild(tooltipRef.current); };
  }, []);
  function preloadImage(src) { if (imageCache.current.has(src) || loadingImages.current.has(src)) return; loadingImages.current.add(src); const img = new Image(); img.onload = () => { imageCache.current.set(src, true); loadingImages.current.delete(src); }; img.onerror = () => { imageCache.current.set(src, false); loadingImages.current.delete(src); }; img.src = src; }
  function positionTooltip(mouseX, mouseY) { if (!tooltipRef.current) return; const buffer = 20, rect = tooltipRef.current.getBoundingClientRect(); let x = mouseX + buffer, y = mouseY + buffer; if (x + rect.width > window.innerWidth) x = mouseX - rect.width - buffer; if (y + rect.height > window.innerHeight) y = mouseY - rect.height - buffer; if (x < 0) x = buffer; if (y < 0) y = buffer; tooltipRef.current.style.left = x + 'px'; tooltipRef.current.style.top = y + 'px'; }
  function showMapTooltip(event, serverNameUgly) { if (!tooltipRef.current) return; clearTimeout(hideTimeoutRef.current); clearTimeout(showTimeoutRef.current); const mapSrc = 'gfx/login_servermap_' + serverNameUgly + '.png'; if (imageCache.current.has(mapSrc) && !imageCache.current.get(mapSrc)) { if (tooltipRef.current.classList.contains('show')) tooltipRef.current.classList.remove('show'); return; } showTimeoutRef.current = setTimeout(() => { const img = new Image(); img.onload = () => { tooltipRef.current.innerHTML = '<img src="' + mapSrc + '" alt="Server Map">'; positionTooltip(event.clientX + window.scrollX, event.clientY + window.scrollY); tooltipRef.current.classList.add('show'); imageCache.current.set(mapSrc, true); }; img.onerror = () => { imageCache.current.set(mapSrc, false); if (tooltipRef.current.classList.contains('show')) tooltipRef.current.classList.remove('show'); }; img.src = mapSrc; }, 50); }
  function hideMapTooltip() { if (!tooltipRef.current) return; clearTimeout(showTimeoutRef.current); hideTimeoutRef.current = setTimeout(() => { if (tooltipRef.current) tooltipRef.current.classList.remove('show'); }, 50); }
  function updateTooltipPosition(event) { if (tooltipRef.current && tooltipRef.current.classList.contains('show')) positionTooltip(event.clientX + window.scrollX, event.clientY + window.scrollY); }
  return { preloadImage, showMapTooltip, hideMapTooltip, updateTooltipPosition };
}

const truncate = (text, limit) => text.length > limit ? text.substring(0, limit) + '..' : text;

function ServerRow({ server, idx, preloadImage, showMapTooltip, hideMapTooltip, updateTooltipPosition }) {
  const serverNameUgly = server.server_nameugly || 'N/A', serverName = server.server_name || 'N/A', serverType = server.server_type || 'Classic', imageName = 'gfx/login_icon_' + serverNameUgly + '.png', mapName = 'gfx/login_servermap_' + serverNameUgly + '.png';
  React.useEffect(() => preloadImage(mapName), [mapName, preloadImage]);
  return React.createElement('tr', {key: idx, 'data-server': serverNameUgly, 'data-map': serverNameUgly, onMouseEnter: (e) => showMapTooltip(e, serverNameUgly), onMouseLeave: hideMapTooltip, onMouseMove: updateTooltipPosition},
    React.createElement('td', {className: 'servername'}, React.createElement('img', {src: imageName, alt: serverName, loading: 'lazy', onError: (e) => e.target.src = 'gfx/login_icon_developer4.png', style: {width: 32, height: 32, verticalAlign: 'middle', marginRight: 10}}), serverName),
    React.createElement('td', {className: 'type'}, serverType),
    React.createElement('td', {className: 'playercount'}, server.player_count || '0'),
    React.createElement('td', {className: 'language'}, server.language || 'N/A'),
    React.createElement('td', {className: 'description'}, truncate(server.description || 'No description available.', 30)),
    React.createElement('td', {className: 'website'}, server.website ? React.createElement('a', {href: server.website}, truncate(server.website, 25)) : 'None.'),
    React.createElement('td', {className: 'version'}, server.graal_version || 'Worlds')
  );
}

function ServerListView(props) {
  const {
    servers, allServers, filteredServers,
    showDevServers, setShowDevServers,
    sortConfig, setSortConfig,
    columnWidths, setColumnWidths,
    currentPage, setCurrentPage,
    perPage, setPerPage,
    tableWrapperRef, tableRef,
    resizingColumn, setResizingColumn,
    guidePosition, setGuidePosition,
    handleMouseDown
  } = props;

  const { preloadImage, showMapTooltip, hideMapTooltip, updateTooltipPosition } = useMapTooltip();
  const totalPages = Math.ceil(filteredServers.length / perPage);
  const totalPlayerCount = allServers.reduce((sum, s) => sum + (s.player_count || 0), 0);

  const handleSort = (column) => {
    if (sortConfig.column === column && sortConfig.direction === 'desc') { setSortConfig({column: null, direction: null}); return; }
    const newDirection = sortConfig.column === column ? 'desc' : 'asc';
    setSortConfig({column, direction: newDirection});
  };

  const getSortedIndicator = (column) => {
    if (sortConfig.column !== column) return null;
    return React.createElement('i', {className: sortConfig.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down', style: {marginLeft: '5px'}});
  };

  const setCurrentPageWithUrl = (page) => {
    setCurrentPage(page);
    const url = new URL(window.location);
    page > 1 ? url.searchParams.set('page', page) : url.searchParams.delete('page');
    window.history.pushState(null, '', url);
  };

  return React.createElement(React.Fragment, null,
    React.createElement('div', {style: {display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '25px'}},
      React.createElement('p', null, 'There are currently ', React.createElement('font', {color: 'yellow', style: {textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'}}, totalPlayerCount.toLocaleString(), ' player(s)'), ' online across ', React.createElement('font', {color: 'yellow', style: {textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'}}, allServers.length, ' server(s)'), '.'),
      React.createElement('p', {style: {marginTop: '10px'}}, React.createElement('a', {href: '/?graph', onClick: (e) => { e.preventDefault(); window.location.href = '/?graph'; }, style: {color: '#40ff40', textDecoration: 'none', cursor: 'pointer', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'}}, 'View Graph'), React.createElement('br'), React.createElement('a', {href: '/?changes', onClick: (e) => { e.preventDefault(); window.location.href = '/?changes'; }, style: {color: '#40ff40', textDecoration: 'none', cursor: 'pointer', textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'}}, 'View Changes'))
    ),
    React.createElement('div', {ref: tableWrapperRef, className: 'table-wrapper', style: {display: 'flex', flexDirection: 'column', gap: '0', width: '100%', maxWidth: '1420px', margin: '0 auto', position: 'relative'}},
      React.createElement('div', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}},
        React.createElement('div'),
        React.createElement('label', {style: {display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#ffffff'}}, React.createElement('span', {style: {position: 'relative', display: 'inline-block', width: '36px', height: '20px', borderRadius: '20px', backgroundColor: showDevServers ? 'rgba(25, 118, 210, 1)' : 'rgba(255, 255, 255, 0.3)', transition: 'background-color 0.2s', cursor: 'pointer'}}, React.createElement('input', {type: 'checkbox', checked: showDevServers, onChange: (e) => setShowDevServers(e.target.checked), style: {position: 'absolute', opacity: 0, width: 0, height: 0}}), React.createElement('span', {style: {position: 'absolute', content: '""', height: '16px', width: '16px', left: showDevServers ? '18px' : '2px', bottom: '2px', backgroundColor: '#ffffff', transition: 'left 0.2s', borderRadius: '50%'}})), 'Show Hidden servers')
      ),
      React.createElement('div', {className: 'resize-guide', style: {position: 'absolute', top: tableWrapperRef.current ? (tableWrapperRef.current.querySelector('table')?.getBoundingClientRect().top - tableWrapperRef.current.getBoundingClientRect().top) + 'px' : '40px', height: tableRef.current?.offsetHeight + 'px' || 'auto', width: '5px', backgroundColor: 'rgba(255, 255, 255, 0.3)', pointerEvents: 'none', zIndex: 10, display: resizingColumn && guidePosition !== null && tableWrapperRef.current ? 'block' : 'none', left: resizingColumn && guidePosition !== null && tableWrapperRef.current ? (guidePosition - tableWrapperRef.current.getBoundingClientRect().left - 2.5) + 'px' : 'auto'}}),
      React.createElement('div', {style: {backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: '8px', overflow: 'hidden'}},
        React.createElement('table', {ref: tableRef, style: {borderCollapse: 'collapse', tableLayout: 'fixed', margin: '0', width: '100%'}},
          React.createElement('thead', {style: {textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'}},
            React.createElement('tr', null,
              React.createElement('th', {onClick: () => handleSort('server_name'), style: {position: 'relative', paddingLeft: '45px', width: columnWidths.server_name + '%', cursor: 'pointer'}}, React.createElement('button', {onClick: (e) => { e.stopPropagation(); window.location.reload(); }, className: 'rbutton', style: {position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer'}}, React.createElement('i', {className: 'fas fa-sync-alt fa-lg', style: {color: '#FFFF00'}})), 'Server Name', getSortedIndicator('server_name'), React.createElement('div', {className: 'resizer', onMouseDown: (e) => handleMouseDown('server_name', e)})),
              React.createElement('th', {onClick: () => handleSort('type'), style: {width: columnWidths.type + '%', position: 'relative'}}, 'Type', getSortedIndicator('type'), React.createElement('div', {className: 'resizer', onMouseDown: (e) => handleMouseDown('type', e)})),
              React.createElement('th', {onClick: () => handleSort('player_count'), style: {width: columnWidths.player_count + '%', textAlign: 'center', paddingRight: '60px', position: 'relative'}}, 'Player Count', getSortedIndicator('player_count'), React.createElement('div', {className: 'resizer', onMouseDown: (e) => handleMouseDown('player_count', e)})),
              React.createElement('th', {onClick: () => handleSort('language'), style: {width: columnWidths.language + '%', position: 'relative'}}, 'Language', getSortedIndicator('language'), React.createElement('div', {className: 'resizer', onMouseDown: (e) => handleMouseDown('language', e)})),
              React.createElement('th', {onClick: () => handleSort('description'), style: {width: columnWidths.description + '%', position: 'relative'}}, 'Description', getSortedIndicator('description'), React.createElement('div', {className: 'resizer', onMouseDown: (e) => handleMouseDown('description', e)})),
              React.createElement('th', {onClick: () => handleSort('website'), style: {width: columnWidths.website + '%', position: 'relative'}}, 'Website', getSortedIndicator('website'), React.createElement('div', {className: 'resizer', onMouseDown: (e) => handleMouseDown('website', e)})),
              React.createElement('th', {onClick: () => handleSort('graal_version'), style: {textAlign: 'center', paddingRight: '20px', width: columnWidths.graal_version + '%', position: 'relative'}}, 'Game Version', getSortedIndicator('graal_version'))
            )
          ),
          React.createElement('tbody', null, servers.map((server, idx) => React.createElement(ServerRow, {key: idx, idx, server, preloadImage, showMapTooltip, hideMapTooltip, updateTooltipPosition})))
        ),
        React.createElement('div', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', backgroundColor: 'rgba(0, 0, 0, 0.5)', gap: '20px', fontSize: '0.875rem', color: '#ffffff'}},
          React.createElement('span', null, 'Page Total: ', servers.reduce((sum, s) => sum + (s.player_count || 0), 0)),
          React.createElement('div', {style: {display: 'flex', alignItems: 'center', gap: '8px'}}, React.createElement('span', null, 'Rows per page:'), React.createElement('select', {value: perPage, onChange: (e) => { setPerPage(parseInt(e.target.value)); setCurrentPageWithUrl(1); }, style: {padding: '4px', backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.23)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem'}}, React.createElement('option', {value: 10}, '10'), React.createElement('option', {value: 25}, '25'), React.createElement('option', {value: 50}, '50'), React.createElement('option', {value: 100}, '100'))),
          React.createElement(React.Fragment, null, React.createElement('span', null, (currentPage - 1) * perPage + 1, '-', Math.min(currentPage * perPage, filteredServers.length), ' of ', filteredServers.length), React.createElement('div', {style: {display: 'flex', gap: '4px', alignItems: 'center'}}, React.createElement('button', {onClick: () => setCurrentPageWithUrl(Math.max(1, currentPage - 1)), disabled: currentPage === 1, style: {padding: '1px 8px 5px 8px', backgroundColor: 'transparent', border: 'none', color: currentPage === 1 ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.74)', cursor: currentPage === 1 ? 'default' : 'pointer', borderRadius: '4px', fontSize: '1.25rem', lineHeight: '1'}}, '<'), (() => { const totalPages = Math.ceil(filteredServers.length / perPage), pages = []; for (let i = 1; i <= totalPages; i++) pages.push(i); return pages.map(page => React.createElement('button', {key: page, onClick: () => setCurrentPageWithUrl(page), style: {padding: '4px 8px', backgroundColor: currentPage === page ? 'rgba(25, 118, 210, 1)' : 'transparent', border: 'none', color: currentPage === page ? '#ffffff' : 'rgba(255, 255, 255, 0.74)', cursor: 'pointer', borderRadius: '4px', fontSize: '0.875rem'}}, page.toString())); })(), React.createElement('button', {onClick: () => setCurrentPageWithUrl(Math.min(Math.ceil(filteredServers.length / perPage), currentPage + 1)), disabled: currentPage === Math.ceil(filteredServers.length / perPage), style: {padding: '1px 8px 5px 8px', backgroundColor: 'transparent', border: 'none', color: currentPage === Math.ceil(filteredServers.length / perPage) ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.74)', cursor: currentPage === Math.ceil(filteredServers.length / perPage) ? 'default' : 'pointer', borderRadius: '4px', fontSize: '1.25rem', lineHeight: '1'}}, '>')))
        )
      )
    )
  );
}
