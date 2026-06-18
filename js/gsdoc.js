function GSDoc() {
  const [apiData, setApiData] = React.useState({});
  const [currentHash, setCurrentHash] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sidebarOpen, setSidebarOpen] = React.useState(window.innerWidth > 768);
  const [expandedGroups, setExpandedGroups] = React.useState(new Set());
  const [copiedShare, setCopiedShare] = React.useState(null);
  const [copiedCode, setCopiedCode] = React.useState(null);
  const [activeSection, setActiveSection] = React.useState(null);
  const sidebarRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const docsListRef = React.useRef(null);
  const initialHashHandledRef = React.useRef(false);
  const isMobile = window.innerWidth <= 768;

  React.useEffect(() => {
    fetch('https://api.moreno.land/api/gscript').then(r => r.json()).then(data => {
      setApiData(data);
      setTimeout(() => {
        if (window.Prism) window.Prism.highlightAll();
      }, 100);
    }).catch(e => console.error('GSDoc fetch error:', e));
  }, []);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        scrollToHash(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [apiData]);

  const updateMetaTags = React.useCallback((id) => {
    if (!apiData[id]) return;
    const item = apiData[id];
    const name = item.name || id;
    const desc = (item.description || 'GScript API function').replace(/`/g, '');
    const parts = [desc];
    if (item.type) parts.push(`\nType: ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`);
    if (item.params && item.params.length > 0) parts.push(`Parameters: ${item.params.join(', ')}`);
    if (item.returns) parts.push(`Returns: ${item.returns}`);
    if (item.scope) parts.push(`Scope: ${item.scope.charAt(0).toUpperCase() + item.scope.slice(1)}`);
    if (item.example) {
      const lines = item.example.split('\n');
      parts.push(`\nExample:\n${lines.slice(0, 3).join('\n')}${lines.length > 3 ? '...' : ''}`);
    }
    const fullDesc = parts.join('\n');
    document.title = `${name} - GScript API Documentation`;
    const ogUrl = document.getElementById('og-url');
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const twitterTitle = document.getElementById('twitter-title');
    const twitterDesc = document.getElementById('twitter-description');
    if (ogUrl) ogUrl.setAttribute('content', `https://docs.gscript.dev/?share=${id}`);
    if (ogTitle) ogTitle.setAttribute('content', name);
    if (ogDesc) ogDesc.setAttribute('content', fullDesc);
    if (twitterTitle) twitterTitle.setAttribute('content', name);
    if (twitterDesc) twitterDesc.setAttribute('content', fullDesc);
  }, [apiData]);

  const resolveDocId = React.useCallback((hash) => {
    const id = hash.replace('#', '').toLowerCase();
    return Object.keys(apiData).find(key => {
      const itemName = (apiData[key]?.name || '').toLowerCase();
      return key.toLowerCase() === id || itemName === id;
    }) || '';
  }, [apiData]);

  const scrollToHash = React.useCallback((hash) => {
    let id = resolveDocId(hash) || hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      setCurrentHash(id);
      window.history.replaceState(null, '', `#${id}`);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateMetaTags(id);
    }
  }, [resolveDocId, updateMetaTags]);

  const handleSearch = React.useCallback((e) => {
    setSearchQuery(e.target.value.toLowerCase());
  }, []);

  const handleSectionClick = React.useCallback((key, e) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentHash(key);
    window.history.replaceState(null, '', `#${key}`);
    setTimeout(() => scrollToHash(key), 100);
    if (isMobile) setSidebarOpen(false);
  }, [scrollToHash, isMobile]);

  const toggleGroup = React.useCallback((groupName, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  }, []);

  const groups = React.useMemo(() => {
    const grouped = {};
    const ungrouped = [];
    Object.keys(apiData).forEach(key => {
      const item = apiData[key];
      const name = item.name || key;
      const desc = item.description || '';
      const allMatches = [];
      const matchName = name.match(/^([\w$]+)(?:\.|:+|_)/);
      if (matchName) allMatches.push(matchName);
      desc.split('|').forEach(part => {
        const matchDesc = part.match(/^([\w$]+)(?:\.|:+|_)/);
        if (matchDesc) allMatches.push(matchDesc);
      });
      if (allMatches.length > 0) {
        let added = false;
        allMatches.forEach(match => {
          const rawGroup = match[1];
          const groupKey = rawGroup.toLowerCase();
          if (groupKey === 'clientside' || groupKey === 'serverside') return;
          if (!grouped[rawGroup]) grouped[rawGroup] = [];
          grouped[rawGroup].push(key);
          added = true;
        });
        if (!added) ungrouped.push(key);
      } else {
        ungrouped.push(key);
      }
    });
    return { grouped, ungrouped };
  }, [apiData]);

  const renderSection = React.useCallback((key) => {
    const item = apiData[key];
    if (!item) return null;
    const name = item.name || key;
    const isShareCopied = copiedShare === key;
    const isCodeCopied = copiedCode === key;
    return React.createElement('div', { className: 'section-wrapper', key: key },
      React.createElement('h2', { id: key },
        name,
        React.createElement('button', {
          className: 'share-btn' + (isShareCopied ? ' copied' : ''),
          onClick: (e) => {
            e.stopPropagation();
            const url = `https://share.gscript.dev/${key}?v=${Date.now()}`;
            navigator.clipboard.writeText(url);
            setCopiedShare(key);
            setTimeout(() => setCopiedShare(null), 2000);
          }
        }, isShareCopied ? '✓' : 'Share')
      ),
      item.description && React.createElement('p', { dangerouslySetInnerHTML: { __html: item.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code style="background: #2a2a3a; color: #ff6b9d; padding: 0.2em 0.4em; border-radius: 3px;">$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #5ba5ff;">$1</a>').replace(/\n/g, '<br>') } }),
      (item.type || item.params || item.returns || item.scope) && React.createElement('div', { style: { background: 'rgba(42, 42, 58, 0.85)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', borderLeft: '3px solid rgba(91, 165, 255, 0.5)' } },
        item.type && React.createElement('div', null, React.createElement('strong', { style: { color: '#7bb5ff' } }, 'Type: '), React.createElement('code', { style: { background: '#2a2a3a', color: '#ff6b9d', padding: '0.2em 0.4em', borderRadius: '3px' } }, item.type)),
        item.params && item.params.length > 0 && React.createElement('div', null, React.createElement('strong', { style: { color: '#7bb5ff' } }, 'Parameters: '), React.createElement('code', { style: { background: '#2a2a3a', color: '#ff6b9d', padding: '0.2em 0.4em', borderRadius: '3px' } }, item.params.join(', '))),
        item.returns && React.createElement('div', null, React.createElement('strong', { style: { color: '#7bb5ff' } }, 'Returns: '), React.createElement('code', { style: { background: '#2a2a3a', color: '#ff6b9d', padding: '0.2em 0.4em', borderRadius: '3px' } }, item.returns)),
        item.scope && React.createElement('div', null, React.createElement('strong', { style: { color: '#7bb5ff' } }, 'Scope: '), React.createElement('code', { style: { background: '#2a2a3a', color: '#ff6b9d', padding: '0.2em 0.4em', borderRadius: '3px' } }, item.scope))
      ),
      item.example && React.createElement('div', { className: 'code-wrapper' },
        React.createElement('button', {
          className: 'copy-btn' + (isCodeCopied ? ' copied' : ''),
          onClick: (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.example);
            setCopiedCode(key);
            setTimeout(() => setCopiedCode(null), 2000);
          }
        }, isCodeCopied ? '✓' : 'Copy'),
        React.createElement('pre', null,
          React.createElement('code', { className: 'language-javascript', dangerouslySetInnerHTML: { __html: item.example.replace(/</g, '&lt;').replace(/>/g, '&gt;') } })
        )
      ),
      React.createElement('hr', null)
    );
  }, [apiData, copiedShare, copiedCode]);

  const orderedKeys = React.useMemo(() => {
    const keys = [];
    const { grouped, ungrouped } = groups;
    ungrouped.forEach(key => {
      const item = apiData[key];
      const name = item.name || key;
      const nameKey = name.toLowerCase();
      let merged = false;
      Object.keys(grouped).forEach(groupName => {
        if (groupName.toLowerCase() === nameKey) merged = true;
      });
      if (merged) return;
      if (name.match(/^on[A-Z]/) || name.match(/^mud/i) || name.match(/^matrix/i) || name.match(/^kingdom/i)) return;
      keys.push(key);
    });
    Object.keys(grouped).sort().forEach(groupName => {
      const groupKeys = grouped[groupName];
      groupKeys.forEach(key => keys.push(key));
    });
    return keys;
  }, [apiData, groups]);

  React.useEffect(() => {
    if (orderedKeys.length === 0) return;
    const scroller = docsListRef.current;
    if (!scroller) return;
    let scrollFrame = null;

    const setActiveKey = (key) => {
      if (!key) return;
      setCurrentHash(key);
      setActiveSection(key);
      window.history.replaceState(null, '', `#${key}`);
      for (const groupName in groups.grouped) {
        if (groups.grouped[groupName].includes(key)) {
          setExpandedGroups(prev => new Set([...prev, groupName]));
          break;
        }
      }
      setTimeout(() => {
        const activeLink = document.querySelector(`#sidebar a[href="#${key}"]`);
        if (activeLink) activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    };

    const updateActiveFromScroll = () => {
      if (scroller.scrollTop <= 2) {
        setActiveKey(orderedKeys[0]);
        return;
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
        setActiveKey(orderedKeys[orderedKeys.length - 1]);
        return;
      }
      const scrollerTop = scroller.getBoundingClientRect().top;
      let nextActive = orderedKeys[0];
      for (const key of orderedKeys) {
        const el = document.getElementById(key);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - scrollerTop;
        if (top <= 24) nextActive = key;
        else break;
      }
      setActiveKey(nextActive);
    };

    const onScroll = () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(updateActiveFromScroll);
    };

    const hash = window.location.hash.replace('#', '');
    const initialKey = !initialHashHandledRef.current && hash ? resolveDocId(hash) : '';
    initialHashHandledRef.current = true;
    if (initialKey) {
      setTimeout(() => scrollToHash(initialKey), 50);
      setTimeout(updateActiveFromScroll, 500);
    } else {
      updateActiveFromScroll();
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [orderedKeys, groups, resolveDocId, scrollToHash]);

  React.useEffect(() => {
    document.body.classList.add('docs-active');
    return () => {
      document.body.classList.remove('docs-active');
    };
  }, []);

  const docsCount = Object.keys(apiData).length;

  return React.createElement(React.Fragment, null,
    React.createElement('meta', { charSet: 'UTF-8' }),
    React.createElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0, minimum-scale=1.0' }),
    React.createElement('meta', { name: 'theme-color', content: '#4a9eff' }),
    React.createElement('meta', { property: 'og:title', content: 'GScript API Documentation', id: 'og-title' }),
    React.createElement('meta', { property: 'og:description', content: 'Complete API documentation for GScript', id: 'og-description' }),
    React.createElement('meta', { property: 'og:type', content: 'website' }),
    React.createElement('meta', { property: 'og:url', content: 'https://docs.gscript.dev', id: 'og-url' }),
    React.createElement('meta', { property: 'og:site_name', content: 'GScript Docs' }),
    React.createElement('meta', { property: 'og:image', content: 'https://docs.gscript.dev/graal_icon.png' }),
    React.createElement('meta', { name: 'twitter:card', content: 'summary_large_image' }),
    React.createElement('meta', { name: 'twitter:title', content: 'GScript API Documentation', id: 'twitter-title' }),
    React.createElement('meta', { name: 'twitter:description', content: 'Complete API documentation for GScript', id: 'twitter-description' }),
    React.createElement('meta', { name: 'twitter:image', content: 'https://docs.gscript.dev/graal_icon.png' }),
    React.createElement('link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css' }),
    React.createElement('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js' }),
    React.createElement('div', { className: `docs-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}` },
      !sidebarOpen && React.createElement('button', { id: 'sidebar-open-toggle', type: 'button', onClick: () => setSidebarOpen(true), 'aria-label': 'Open docs menu' },
        React.createElement('span', null, '❯')
      ),
      React.createElement('div', { id: 'sidebar-overlay', className: sidebarOpen ? 'show' : '', onClick: () => setSidebarOpen(false) }),
      React.createElement('div', { id: 'sidebar', className: sidebarOpen ? 'show' : (isMobile ? '' : 'hidden') },
        React.createElement('div', { id: 'sidebar-header' },
          React.createElement('button', { id: 'sidebar-toggle', type: 'button', onClick: () => setSidebarOpen(!sidebarOpen), className: sidebarOpen ? '' : 'collapsed', 'aria-label': sidebarOpen ? 'Collapse docs menu' : 'Open docs menu' },
            React.createElement('span', null, sidebarOpen ? '❮' : '❯')
          ),
          React.createElement('a', { className: 'docs-back-link', href: './' }, 'Back'),
          React.createElement('h2', null, '#gscript docs'),
          React.createElement('p', null, docsCount ? `${docsCount} entries` : 'Loading entries'),
          React.createElement('input', { type: 'text', id: 'search', placeholder: 'Search functions...', value: searchQuery, onChange: handleSearch })
        ),
        React.createElement('div', { id: 'sidebar-links' },
          groups.ungrouped.map(key => {
            const item = apiData[key];
            const name = item.name || key;
            return React.createElement('a', {
              href: `#${key}`,
              key: key,
              className: activeSection === key ? 'active' : '',
              style: { display: searchQuery && !key.toLowerCase().includes(searchQuery) && !name.toLowerCase().includes(searchQuery) ? 'none' : 'flex' },
              onClick: (e) => handleSectionClick(key, e)
            }, name);
          }),
          Object.keys(groups.grouped).sort().map(groupName =>
            React.createElement(React.Fragment, { key: groupName },
              React.createElement('div', { className: 'tree-parent' + (expandedGroups.has(groupName) ? ' expanded' : ''), onClick: (e) => toggleGroup(groupName, e) },
                React.createElement('span', { className: 'arrow' }, '▶'),
                React.createElement('span', null, groupName)
              ),
              React.createElement('div', { className: 'tree-children' + (expandedGroups.has(groupName) ? ' show' : '') },
                [...new Set(groups.grouped[groupName])].map(key =>
                  React.createElement('a', {
                    href: `#${key}`,
                    key: key,
                    className: activeSection === key ? 'active' : '',
                    style: { display: searchQuery && !key.toLowerCase().includes(searchQuery) && (!apiData[key]?.name || !apiData[key].name.toLowerCase().includes(searchQuery)) ? 'none' : 'flex' },
                    onClick: (e) => handleSectionClick(key, e)
                  }, apiData[key]?.name || key)
                )
              )
            )
          )
        )
      ),
      React.createElement('main', { id: 'content', ref: contentRef, className: sidebarOpen ? '' : 'expanded' },
        React.createElement('div', { className: 'docs-list', ref: docsListRef },
          orderedKeys.length === 0 ? React.createElement('p', { className: 'docs-loading' }, 'Loading documentation...') :
          orderedKeys.map(key => renderSection(key))
        )
      )
    )
  );
}
