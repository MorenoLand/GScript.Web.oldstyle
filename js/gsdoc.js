const DISCORD_AUTH_STORAGE_KEY = 'gscript_discord_auth';
const BOT_ADMIN_ROLE_ID = '1441076653852725420';
const BOT_EDITOR_ROLE_ID = '1440497287427129414';

function parseDiscordBool(value) {
  return value === true || value === 'true' || value === '1';
}

function normalizeDiscordAuth(user) {
  if (!user) return null;
  const roles = Array.isArray(user.roles)
    ? user.roles.map(String)
    : String(user.roles || '').split(',').map(role => role.trim()).filter(Boolean);
  const botAdmin = parseDiscordBool(user.botAdmin) || parseDiscordBool(user.bot_admin) || roles.includes(BOT_ADMIN_ROLE_ID);
  const botEditor = parseDiscordBool(user.botEditor) || parseDiscordBool(user.bot_editor) || roles.includes(BOT_EDITOR_ROLE_ID);
  return { ...user, roles, botAdmin, botEditor };
}

function hasDocsEditAccess(user) {
  const auth = normalizeDiscordAuth(user);
  return !!(auth && (auth.botAdmin || auth.botEditor));
}

const EDIT_FIELD_PROPS = {
  spellCheck: false,
  autoCorrect: 'off',
  autoCapitalize: 'off',
  autoComplete: 'off',
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false'
};

function readDiscordAuth() {
  try {
    const raw = localStorage.getItem(DISCORD_AUTH_STORAGE_KEY);
    const auth = raw ? normalizeDiscordAuth(JSON.parse(raw)) : null;
    if (auth) localStorage.setItem(DISCORD_AUTH_STORAGE_KEY, JSON.stringify(auth));
    return auth;
  } catch {
    return null;
  }
}

function isDiscordAuthHash(hash) {
  const cleanHash = hash.replace(/^#/, '');
  if (!cleanHash) return false;
  const params = new URLSearchParams(cleanHash);
  return params.has('token') || params.has('error');
}

function renderDocText(value) {
  return (value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: #2a2a3a; color: #ff6b9d; padding: 0.2em 0.4em; border-radius: 3px;">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #5ba5ff;">$1</a>')
    .replace(/\n/g, '<br>');
}

function GSDoc() {
  const [apiData, setApiData] = React.useState({});
  const [currentHash, setCurrentHash] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sidebarOpen, setSidebarOpen] = React.useState(window.innerWidth > 768);
  const [expandedGroups, setExpandedGroups] = React.useState(new Set());
  const [copiedShare, setCopiedShare] = React.useState(null);
  const [copiedCode, setCopiedCode] = React.useState(null);
  const [activeSection, setActiveSection] = React.useState(null);
  const [discordUser, setDiscordUser] = React.useState(readDiscordAuth);
  const [discordAuthError, setDiscordAuthError] = React.useState('');
  const [editingKey, setEditingKey] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState(null);
  const [editStatus, setEditStatus] = React.useState('');
  const [creatingDefinition, setCreatingDefinition] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState('');
  const [deletingKey, setDeletingKey] = React.useState(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [deleteStatus, setDeleteStatus] = React.useState('');
  const restoreScrollRef = React.useRef(null);
  const sidebarRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const docsListRef = React.useRef(null);
  const editFormRef = React.useRef(null);
  const createFormRef = React.useRef(null);
  const initialHashHandledRef = React.useRef(false);
  const isMobile = window.innerWidth <= 768;

  const discordLoginUrl = React.useMemo(() => {
    const isDocsHost = window.location.hostname.toLowerCase() === 'docs.gscript.dev';
    const returnUrl = isDocsHost
      ? `${window.location.origin}${window.location.pathname || '/'}`
      : `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return `https://api.moreno.land/api/auth/discord/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  }, []);

  const handleDiscordLogout = React.useCallback(() => {
    localStorage.removeItem(DISCORD_AUTH_STORAGE_KEY);
    setDiscordUser(null);
  }, []);

  const handleDiscordAuthHash = React.useCallback(() => {
    if (!isDiscordAuthHash(window.location.hash)) return false;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.has('token')) {
      const user = normalizeDiscordAuth({
        token: params.get('token') || '',
        username: params.get('username') || '',
        nickname: params.get('nickname') || '',
        avatarUrl: params.get('avatar_url') || '',
        discordId: params.get('discord_id') || '',
        roles: (params.get('roles') || '').split(',').filter(Boolean),
        botAdmin: params.get('bot_admin') === 'true',
        botEditor: params.get('bot_editor') === 'true'
      });
      localStorage.setItem(DISCORD_AUTH_STORAGE_KEY, JSON.stringify(user));
      setDiscordUser(user);
      setDiscordAuthError('');
    } else if (params.has('error')) {
      setDiscordAuthError(params.get('error') || 'discord_login_failed');
    }

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    return true;
  }, []);

  React.useEffect(() => {
    handleDiscordAuthHash();
  }, [handleDiscordAuthHash]);

  React.useEffect(() => {
    fetch('https://api.moreno.land/api/gscript').then(r => r.json()).then(data => {
      setApiData(data);
      setTimeout(() => {
        if (window.Prism) window.Prism.highlightAll();
      }, 100);
    }).catch(e => console.error('GSDoc fetch error:', e));
  }, []);

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

  React.useEffect(() => {
    const handleHashChange = () => {
      if (handleDiscordAuthHash()) return;
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        scrollToHash(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [apiData, handleDiscordAuthHash, scrollToHash]);

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

  const canEditDocs = hasDocsEditAccess(discordUser);

  const readDefinitionForm = React.useCallback((form, fallback = {}, fallbackKey = '') => {
    const read = (field) => form?.querySelector(`[name="${field}"]`)?.value ?? fallback[field] ?? '';
    const key = read('key').trim();
    return {
      key: key || fallbackKey,
      payload: {
        name: read('name') || key || fallbackKey,
        type: read('type'),
        scope: read('scope') || 'clientside',
        params: read('params').split(',').map(p => p.trim()).filter(Boolean),
        returns: read('returns') || 'void',
        description: read('description'),
        example: read('example')
      }
    };
  }, []);

  const beginEdit = React.useCallback((key, item) => {
    setCreatingDefinition(false);
    setCreateStatus('');
    setDeletingKey(null);
    setDeleteConfirm('');
    setDeleteStatus('');
    const scroller = docsListRef.current;
    const section = document.getElementById(key);
    const sectionOffset = scroller && section
      ? section.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      : 0;
    restoreScrollRef.current = {
      key,
      top: scroller?.scrollTop ?? 0,
      offset: sectionOffset
    };
    setEditingKey(key);
    setEditStatus('');
    setEditDraft({
      name: item.name || key,
      type: item.type || '',
      scope: item.scope || 'clientside',
      params: Array.isArray(item.params) ? item.params.join(', ') : '',
      returns: item.returns || 'void',
      description: item.description || '',
      example: item.example || ''
    });
  }, []);

  const cancelEdit = React.useCallback(() => {
    const key = editingKey;
    setEditingKey(null);
    setEditDraft(null);
    setEditStatus('');
    setDeletingKey(null);
    setDeleteConfirm('');
    setDeleteStatus('');
    if (key) {
      restoreScrollRef.current = restoreScrollRef.current || { key, top: docsListRef.current?.scrollTop ?? 0, offset: 0 };
      window.history.replaceState(null, '', `#${key}`);
    }
  }, [editingKey]);

  const updateEditDraft = React.useCallback((field, value) => {
    setEditDraft(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveEdit = React.useCallback(async (key) => {
    if (!editDraft || !discordUser?.token) return;
    setEditStatus('Saving...');
    try {
      const form = editFormRef.current;
      const { payload } = readDefinitionForm(form, editDraft, key);

      const response = await fetch(`https://api.moreno.land/api/gscript/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${discordUser.token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Save failed.');

      setApiData(prev => ({ ...prev, [key]: result.item || payload }));
      setEditingKey(null);
      setEditDraft(null);
      setDeletingKey(null);
      setDeleteConfirm('');
      setDeleteStatus('');
      restoreScrollRef.current = restoreScrollRef.current || { key, top: docsListRef.current?.scrollTop ?? 0, offset: 0 };
      setEditStatus(result.message || 'Saved.');
      window.history.replaceState(null, '', `#${key}`);
      setTimeout(() => setEditStatus(''), 2400);
    } catch (err) {
      setEditStatus(err.message || 'Save failed.');
    }
  }, [discordUser, editDraft, readDefinitionForm]);

  const beginCreate = React.useCallback(() => {
    setEditingKey(null);
    setEditDraft(null);
    setEditStatus('');
    setDeletingKey(null);
    setDeleteConfirm('');
    setDeleteStatus('');
    setCreatingDefinition(true);
    setCreateStatus('');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    requestAnimationFrame(() => {
      const scroller = docsListRef.current;
      if (scroller) scroller.scrollTop = 0;
    });
  }, []);

  const cancelCreate = React.useCallback(() => {
    setCreatingDefinition(false);
    setCreateStatus('');
  }, []);

  const saveCreate = React.useCallback(async () => {
    if (!discordUser?.token) return;
    setCreateStatus('Creating...');
    try {
      const { key, payload } = readDefinitionForm(createFormRef.current, { scope: 'clientside', returns: 'void' });
      if (!key || key.length > 120) throw new Error('Give the definition a valid key first.');

      const response = await fetch(`https://api.moreno.land/api/gscript/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${discordUser.token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Create failed.');

      setApiData(prev => ({ ...prev, [key]: result.item || payload }));
      setCreatingDefinition(false);
      setCreateStatus(result.message || 'Created.');
      setCurrentHash(key);
      setActiveSection(key);
      window.history.replaceState(null, '', `#${key}`);
      setTimeout(() => scrollToHash(key), 80);
      setTimeout(() => setCreateStatus(''), 2400);
    } catch (err) {
      setCreateStatus(err.message || 'Create failed.');
    }
  }, [discordUser, readDefinitionForm, scrollToHash]);

  const deleteDefinition = React.useCallback(async (key) => {
    if (!discordUser?.token || deleteConfirm.trim() !== key) return;
    setDeleteStatus('Deleting...');
    try {
      const response = await fetch(`https://api.moreno.land/api/gscript/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${discordUser.token}`
        },
        body: JSON.stringify({ confirmation: deleteConfirm.trim() })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Delete failed.');

      setApiData(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setEditingKey(null);
      setEditDraft(null);
      setDeletingKey(null);
      setDeleteConfirm('');
      setDeleteStatus('');
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    } catch (err) {
      setDeleteStatus(err.message || 'Delete failed.');
    }
  }, [discordUser, deleteConfirm]);

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
    const isEditing = editingKey === key && editDraft;
    const isSaving = isEditing && editStatus === 'Saving...';
    const draftParams = editDraft?.params.split(',').map(p => p.trim()).filter(Boolean) || [];
    const renderMeta = (label, field, value) => React.createElement('div', { className: isEditing ? 'docs-editable-meta is-editing' : '' },
      React.createElement('strong', null, `${label}: `),
      isEditing
        ? (field === 'scope'
          ? React.createElement('select', { name: field, defaultValue: editDraft.scope },
            React.createElement('option', { value: 'clientside' }, 'clientside'),
            React.createElement('option', { value: 'serverside' }, 'serverside'),
            React.createElement('option', { value: 'global' }, 'global')
          )
          : field === 'type'
            ? React.createElement('select', { name: field, defaultValue: editDraft.type },
              React.createElement('option', { value: '' }, ''),
              React.createElement('option', { value: 'function' }, 'function'),
              React.createElement('option', { value: 'variable' }, 'variable')
            )
            : React.createElement('input', { name: field, defaultValue: editDraft[field], ...EDIT_FIELD_PROPS }))
        : value && React.createElement('code', null, value)
    );
    return React.createElement('div', { className: `section-wrapper ${isEditing ? 'is-editing' : ''}`, key: key, ref: isEditing ? editFormRef : null },
      React.createElement('h2', { id: key },
        React.createElement('span', { className: 'docs-section-title' }, name),
        canEditDocs && React.createElement('span', { className: 'docs-edit-strip' },
          !isEditing && React.createElement('button', { type: 'button', onClick: () => beginEdit(key, item) }, 'Edit'),
          isEditing && React.createElement(React.Fragment, null,
            React.createElement('button', { type: 'button', className: isSaving ? 'is-saving' : '', disabled: isSaving, onClick: () => saveEdit(key) },
              isSaving && React.createElement('span', { className: 'docs-save-spinner', 'aria-hidden': 'true' }),
              isSaving ? 'Saving' : 'Save'
            ),
            React.createElement('button', { type: 'button', disabled: isSaving, onClick: cancelEdit }, 'Cancel'),
            React.createElement('button', { type: 'button', className: 'is-danger', disabled: isSaving, onClick: () => {
              setDeletingKey(key);
              setDeleteConfirm('');
              setDeleteStatus('');
            } }, 'Delete')
          )
        ),
        React.createElement('button', {
          className: 'share-btn' + (isShareCopied ? ' copied' : ''),
          onClick: (e) => {
            e.stopPropagation();
            const url = `https://share.gscript.dev/${key}?v=${Date.now()}`;
            navigator.clipboard.writeText(url);
            setCopiedShare(key);
            setTimeout(() => setCopiedShare(null), 2000);
          }
        }, isShareCopied ? 'Copied' : 'Share')
      ),
      isEditing
        ? React.createElement('textarea', { name: 'description', className: 'docs-inline-edit docs-description-edit', defaultValue: editDraft.description, rows: 5, ...EDIT_FIELD_PROPS, 'aria-label': 'Description' })
        : item.description && React.createElement('p', { dangerouslySetInnerHTML: { __html: renderDocText(item.description) } }),
      (isEditing || item.type || item.params || item.returns || item.scope) && React.createElement('div', { className: 'docs-meta-panel' },
        renderMeta('Type', 'type', item.type),
        renderMeta('Parameters', 'params', isEditing ? draftParams.join(', ') : (item.params || []).join(', ')),
        renderMeta('Returns', 'returns', item.returns),
        renderMeta('Scope', 'scope', item.scope)
      ),
      (isEditing || item.example) && React.createElement('div', { className: `code-wrapper ${isEditing ? 'is-editing' : ''}` },
        !isEditing && React.createElement('button', {
          className: 'copy-btn' + (isCodeCopied ? ' copied' : ''),
          onClick: (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.example);
            setCopiedCode(key);
            setTimeout(() => setCopiedCode(null), 2000);
          }
        }, isCodeCopied ? '✓' : 'Copy'),
        isEditing
          ? React.createElement('textarea', { name: 'example', className: 'docs-inline-edit docs-example-edit', defaultValue: editDraft.example, rows: 9, ...EDIT_FIELD_PROPS, 'aria-label': 'Example' })
          : React.createElement('pre', null,
            React.createElement('code', { className: 'language-javascript', dangerouslySetInnerHTML: { __html: item.example.replace(/</g, '&lt;').replace(/>/g, '&gt;') } })
          )
      ),
      isEditing && editStatus && React.createElement('div', { className: `docs-edit-status ${/fail|required|invalid|forbidden|error/i.test(editStatus) ? 'is-error' : ''}` }, editStatus),
      isEditing && deletingKey === key && React.createElement('div', { className: 'docs-delete-panel' },
        React.createElement('p', null, `Type ${key} to permanently delete this definition.`),
        React.createElement('div', null,
          React.createElement('input', { value: deleteConfirm, onChange: e => setDeleteConfirm(e.target.value), ...EDIT_FIELD_PROPS, 'aria-label': `Type ${key} to confirm deletion` }),
          React.createElement('button', { type: 'button', disabled: deleteConfirm.trim() !== key || deleteStatus === 'Deleting...', onClick: () => deleteDefinition(key) }, deleteStatus === 'Deleting...' ? 'Deleting' : 'Confirm Delete')
        ),
        deleteStatus && React.createElement('span', { className: /fail|required|invalid|forbidden|error/i.test(deleteStatus) ? 'is-error' : '' }, deleteStatus)
      ),
      React.createElement('hr', null)
    );
  }, [apiData, copiedShare, copiedCode, canEditDocs, editingKey, editDraft, editStatus, deletingKey, deleteConfirm, deleteStatus, beginEdit, cancelEdit, saveEdit, deleteDefinition, updateEditDraft]);

  const renderCreateSection = React.useCallback(() => {
    if (!creatingDefinition) return null;
    const isCreating = createStatus === 'Creating...';
    const renderMeta = (label, field, defaultValue) => React.createElement('div', { className: 'docs-editable-meta is-editing' },
      React.createElement('strong', null, `${label}: `),
      field === 'scope'
        ? React.createElement('select', { name: field, defaultValue: defaultValue },
          React.createElement('option', { value: 'clientside' }, 'clientside'),
          React.createElement('option', { value: 'serverside' }, 'serverside'),
          React.createElement('option', { value: 'global' }, 'global')
        )
        : field === 'type'
          ? React.createElement('select', { name: field, defaultValue: defaultValue },
            React.createElement('option', { value: '' }, ''),
            React.createElement('option', { value: 'function' }, 'function'),
            React.createElement('option', { value: 'variable' }, 'variable')
          )
          : React.createElement('input', { name: field, defaultValue: defaultValue, ...EDIT_FIELD_PROPS })
    );

    return React.createElement('div', { className: 'section-wrapper is-editing docs-create-section', key: '__create__', ref: createFormRef },
      React.createElement('h2', null,
        React.createElement('span', { className: 'docs-section-title' }, 'Add definition'),
        React.createElement('span', { className: 'docs-edit-strip' },
          React.createElement('button', { type: 'button', className: isCreating ? 'is-saving' : '', disabled: isCreating, onClick: saveCreate },
            isCreating && React.createElement('span', { className: 'docs-save-spinner', 'aria-hidden': 'true' }),
            isCreating ? 'Creating' : 'Create'
          ),
          React.createElement('button', { type: 'button', disabled: isCreating, onClick: cancelCreate }, 'Cancel')
        )
      ),
      React.createElement('div', { className: 'docs-meta-panel docs-create-key' },
        renderMeta('Key', 'key', ''),
        renderMeta('Name', 'name', ''),
        renderMeta('Type', 'type', 'function'),
        renderMeta('Parameters', 'params', ''),
        renderMeta('Returns', 'returns', 'void'),
        renderMeta('Scope', 'scope', 'clientside')
      ),
      React.createElement('textarea', { name: 'description', className: 'docs-inline-edit docs-description-edit', defaultValue: '', rows: 5, ...EDIT_FIELD_PROPS, 'aria-label': 'Description' }),
      React.createElement('div', { className: 'code-wrapper is-editing' },
        React.createElement('textarea', { name: 'example', className: 'docs-inline-edit docs-example-edit', defaultValue: '', rows: 9, ...EDIT_FIELD_PROPS, 'aria-label': 'Example' })
      ),
      createStatus && React.createElement('div', { className: `docs-edit-status ${/fail|required|invalid|forbidden|error/i.test(createStatus) ? 'is-error' : ''}` }, createStatus),
      React.createElement('hr', null)
    );
  }, [creatingDefinition, createStatus, saveCreate, cancelCreate]);

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
      keys.push(key);
    });
    Object.keys(grouped).sort().forEach(groupName => {
      const groupKeys = grouped[groupName];
      groupKeys.forEach(key => keys.push(key));
    });
    return keys;
  }, [apiData, groups]);

  const visibleKeys = React.useMemo(() => {
    if (editingKey) return [editingKey];
    return orderedKeys;
  }, [editingKey, orderedKeys]);

  React.useEffect(() => {
    if (editingKey || !restoreScrollRef.current) return;
    const restore = restoreScrollRef.current;
    restoreScrollRef.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = docsListRef.current;
        if (!scroller) return;
        const section = document.getElementById(restore.key);
        if (section) {
          const delta = (section.getBoundingClientRect().top - scroller.getBoundingClientRect().top) - (restore.offset || 0);
          scroller.scrollTop += delta;
        } else {
          scroller.scrollTop = restore.top;
        }
      });
    });
  }, [editingKey, visibleKeys]);

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

    const hash = isDiscordAuthHash(window.location.hash) ? '' : window.location.hash.replace('#', '');
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
  const discordDisplayName = discordUser?.nickname || discordUser?.username || 'Discord';
  const discordRoleLabel = discordUser?.botAdmin ? 'Bot Admin' : (discordUser?.botEditor ? 'Bot Editor' : 'Logged in');
  const discordLoginTitle = discordAuthError === 'discord_oauth_not_configured'
    ? 'Discord OAuth is not configured yet'
    : 'Login with Discord';

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
          React.createElement('div', { className: `docs-auth-row ${canEditDocs ? 'can-add' : ''}` },
            React.createElement('input', { type: 'text', id: 'search', placeholder: 'Search functions...', value: searchQuery, onChange: handleSearch }),
            discordUser
              ? React.createElement('button', {
                  type: 'button',
                  className: `docs-discord-auth logged-in ${discordUser.botAdmin ? 'is-admin' : (discordUser.botEditor ? 'is-editor' : '')}`,
                  onClick: handleDiscordLogout,
                  title: `${discordDisplayName} - ${discordRoleLabel}. Click to log out.`,
                  'aria-label': 'Log out of Discord'
                },
                  discordUser.avatarUrl
                    ? React.createElement('img', { src: discordUser.avatarUrl, alt: '' })
                    : React.createElement('i', { className: 'fab fa-discord' }),
                  (discordUser.botAdmin || discordUser.botEditor) && React.createElement('span', { className: 'docs-role-badge' }, discordUser.botAdmin ? 'A' : 'E')
                )
              : React.createElement('a', {
                  className: `docs-discord-auth ${discordAuthError ? 'has-error' : ''}`,
                  href: discordLoginUrl,
                  title: discordLoginTitle,
                  'aria-label': 'Login with Discord'
                }, React.createElement('i', { className: 'fab fa-discord' })),
            canEditDocs && React.createElement('button', {
              type: 'button',
              className: `docs-sidebar-action ${creatingDefinition ? 'active' : ''}`,
              onClick: beginCreate,
              title: 'Add definition',
              'aria-label': 'Add definition'
            }, React.createElement('span', null, '+'))
          )
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
      React.createElement('main', { id: 'content', ref: contentRef, className: `${sidebarOpen ? '' : 'expanded'} ${editingKey ? 'docs-editing-active' : ''}`.trim() },
        React.createElement('div', { className: 'docs-list', ref: docsListRef },
          orderedKeys.length === 0 ? React.createElement('p', { className: 'docs-loading' }, 'Loading documentation...') :
          React.createElement(React.Fragment, null,
            renderCreateSection(),
            visibleKeys.map(key => renderSection(key))
          )
        )
      )
    )
  );
}
