const DISCORD_AUTH_STORAGE_KEY = 'gscript_discord_auth';
const BOT_ADMIN_ROLE_ID = '1441076653852725420';
const BOT_EDITOR_ROLE_ID = '1440497287427129414';
const DOCS_CACHE_KEY = 'gscript_docs_cache';
const DOCS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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

const renderedDocCache = new Map();

function memoizedRenderDocText(value) {
  if (!value) return '';
  if (renderedDocCache.has(value)) return renderedDocCache.get(value);
  const result = renderDocText(value);
  renderedDocCache.set(value, result);
  return result;
}

let docsMonacoPromise = null;

function ensureDocsMonaco() {
  if (window.monaco) {
    registerDocsMonacoLanguage();
    return Promise.resolve(window.monaco);
  }
  if (docsMonacoPromise) return docsMonacoPromise;

  docsMonacoPromise = new Promise((resolve, reject) => {
    const loadEditor = () => {
      window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        registerDocsMonacoLanguage();
        resolve(window.monaco);
      }, reject);
    };

    if (typeof window.require === 'function' && window.require.config) {
      loadEditor();
      return;
    }

    const existingLoader = document.querySelector('script[data-docs-monaco-loader="true"]');
    if (existingLoader) {
      existingLoader.addEventListener('load', loadEditor, { once: true });
      existingLoader.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
    script.dataset.docsMonacoLoader = 'true';
    script.onload = loadEditor;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return docsMonacoPromise;
}

function registerDocsMonacoLanguage() {
  if (!window.monaco || window.__gscriptDocsMonacoReady) return;
  window.__gscriptDocsMonacoReady = true;

  if (!window.monaco.languages.getLanguages().some(language => language.id === 'graalscript')) {
    window.monaco.languages.register({ id: 'graalscript' });
  }

  window.monaco.languages.setMonarchTokensProvider('graalscript', {
    keywords: [
      'class', 'extends', 'implements', 'import', 'instanceof', 'interface', 'native', 'package', 'volatile', 'throws',
      'break', 'case', 'continue', 'default', 'do', 'else', 'elseif', 'for', 'function', 'if', 'in', 'return', 'switch', 'while', 'with', 'xor',
      'public', 'const', 'enum'
    ],
    memory: ['new', 'datablock'],
    builtins: ['true', 'false', 'nil', 'null', 'pi'],
    extras: ['this', 'thiso', 'temp', 'server', 'serverr', 'client', 'clientr', 'player'],
    objectProperties: ['name'],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@blockcomment'],
        [/"/, 'string', '@string_dq'],
        [/'/, 'string', '@string_sq'],
        [/0[xX][0-9a-fA-F]+[Ll]?\b/, 'number'],
        [/[0-9]*\.[0-9]+([eE][-+]?[0-9]+)?[fFdD]?\b/, 'number.float'],
        [/[0-9]+[eE][-+]?[0-9]+[fFdD]?\b/, 'number.float'],
        [/[0-9]+[fFdD]\b/, 'number.float'],
        [/[0-9]+[Ll]?\b/, 'number'],
        [/\b(?:true|false|nil|null|pi)\b/i, 'keyword.builtin'],
        [/\b(?:this|thiso|temp|server|serverr|client|clientr|player)\b/i, 'keyword.extras'],
        [/[a-zA-Z_]\w*(?=\s*\()/, {
          cases: {
            '@keywords': 'keyword',
            '@memory': 'keyword.memory',
            '@default': 'function.call'
          }
        }],
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@memory': 'keyword.memory',
            '@objectProperties': 'variable.property',
            '@default': 'identifier'
          }
        }],
        [/[-~^@/%|=+*!?&<>]/, 'operator'],
        [/[\[\]]/, 'operator'],
        [/[{}();:,.]/, 'delimiter']
      ],
      blockcomment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ],
      string_dq: [
        [/[^"]+/, 'string'],
        [/"/, 'string', '@pop']
      ],
      string_sq: [
        [/[^'\n]+/, 'string'],
        [/\n/, '', '@pop'],
        [/'/, 'string', '@pop']
      ]
    }
  });

  window.monaco.editor.defineTheme('gscript-docs', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'f8f8f2' },
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'be84ff' },
      { token: 'number.float', foreground: 'be84ff' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'keyword.memory', foreground: 'f92672', fontStyle: 'bold' },
      { token: 'keyword.builtin', foreground: 'be84ff' },
      { token: 'keyword.extras', foreground: 'f57900' },
      { token: 'function.call', foreground: 'a6e22b' },
      { token: 'variable.property', foreground: '3f8c61' },
      { token: 'operator', foreground: 'f92672' },
      { token: 'delimiter', foreground: 'ffffff' },
      { token: 'identifier', foreground: 'f8f8f2' }
    ],
    colors: {
      'editor.background': '#030607',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#60615d',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editorCursor.foreground': '#f8f8f0',
      'editor.selectionBackground': '#444444',
      'editor.lineHighlightBackground': '#091211',
      'editor.lineHighlightBorder': '#091211',
      'editorIndentGuide.background1': '#1a211f',
      'editorIndentGuide.activeBackground1': '#516058',
      'scrollbarSlider.background': '#5c5c5c66',
      'scrollbarSlider.hoverBackground': '#77777788',
      'scrollbarSlider.activeBackground': '#999999cc'
    }
  });
}

function DocsMonacoExampleEditor({ name, defaultValue = '', placeholder = '', ariaLabel = 'Example' }) {
  const containerRef = React.useRef(null);
  const hiddenRef = React.useRef(null);
  const editorRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let disposed = false;
    ensureDocsMonaco().then(monacoInstance => {
      if (disposed || !containerRef.current) return;
      const editor = monacoInstance.editor.create(containerRef.current, {
        value: defaultValue || '',
        language: 'graalscript',
        theme: 'gscript-docs',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        lineHeight: 22,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wrappingIndent: 'indent',
        tabSize: 2,
        insertSpaces: true,
        columnSelection: true,
        multiCursorModifier: 'alt',
        multiCursorMergeOverlapping: true,
        multiCursorPaste: 'full',
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideMarkersInOverviewRuler: true,
        scrollbar: { useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
      });
      editorRef.current = editor;
      setReady(true);
      editor.onDidChangeModelContent(() => {
        if (hiddenRef.current) hiddenRef.current.value = editor.getValue();
      });
      setTimeout(() => editor.layout(), 0);
    }).catch(error => {
      console.error('Failed to load Monaco for docs:', error);
      setFailed(true);
    });

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = defaultValue || '';
    if (editorRef.current && editorRef.current.getValue() !== (defaultValue || '')) {
      editorRef.current.setValue(defaultValue || '');
    }
  }, [defaultValue]);

  if (failed) {
    return React.createElement('textarea', {
      name,
      className: 'docs-inline-edit docs-example-edit',
      defaultValue,
      rows: 9,
      placeholder,
      'aria-label': ariaLabel,
      ...EDIT_FIELD_PROPS
    });
  }

  return React.createElement(React.Fragment, null,
    React.createElement('textarea', {
      ref: hiddenRef,
      name,
      defaultValue,
      className: 'docs-example-hidden-field',
      tabIndex: -1,
      'aria-hidden': 'true',
      ...EDIT_FIELD_PROPS
    }),
    React.createElement('div', {
      ref: containerRef,
      className: `docs-monaco-example ${ready ? 'is-ready' : ''}`,
      role: 'textbox',
      'aria-label': ariaLabel,
      'data-placeholder': placeholder
    }, !ready && React.createElement('span', null, placeholder || 'Loading editor...'))
  );
}

const GS_CODE_KEYWORDS = new Set(['class', 'extends', 'implements', 'import', 'instanceof', 'interface', 'native', 'package', 'volatile', 'throws', 'break', 'case', 'continue', 'default', 'do', 'else', 'elseif', 'for', 'function', 'if', 'in', 'return', 'switch', 'while', 'with', 'xor', 'public', 'const', 'enum']);
const GS_CODE_MEMORY = new Set(['new', 'datablock']);
const GS_CODE_BUILTINS = new Set(['true', 'false', 'nil', 'null', 'pi']);
const GS_CODE_EXTRAS = new Set(['this', 'thiso', 'temp', 'server', 'serverr', 'client', 'clientr', 'player']);
const GS_CODE_PROPERTIES = new Set(['name']);

function tokenizeGSCode(value = '') {
  const tokens = [];
  const text = String(value || '');
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let match = rest.match(/^\/\/[^\n]*/);
    if (match) { tokens.push(['comment', match[0]]); i += match[0].length; continue; }
    match = rest.match(/^\/\*[\s\S]*?(?:\*\/|$)/);
    if (match) { tokens.push(['comment', match[0]]); i += match[0].length; continue; }
    match = rest.match(/^"([^"\\]|\\.)*"?/);
    if (match && match[0]) { tokens.push(['string', match[0]]); i += match[0].length; continue; }
    match = rest.match(/^'([^'\\\n]|\\.)*'?/);
    if (match && match[0]) { tokens.push(['string', match[0]]); i += match[0].length; continue; }
    match = rest.match(/^(?:0[xX][0-9a-fA-F]+[Ll]?|[0-9]*\.[0-9]+(?:[eE][-+]?[0-9]+)?[fFdD]?|[0-9]+[eE][-+]?[0-9]+[fFdD]?|[0-9]+[fFdD]|[0-9]+[Ll]?)/);
    if (match) { tokens.push(['number', match[0]]); i += match[0].length; continue; }
    match = rest.match(/^[a-zA-Z_]\w*/);
    if (match) {
      const word = match[0], lower = word.toLowerCase(), after = text.slice(i + word.length);
      const type = GS_CODE_KEYWORDS.has(lower) ? 'keyword' : GS_CODE_MEMORY.has(lower) ? 'memory' : GS_CODE_BUILTINS.has(lower) ? 'builtin' : GS_CODE_EXTRAS.has(lower) ? 'extra' : GS_CODE_PROPERTIES.has(lower) ? 'property' : /^\s*\(/.test(after) ? 'function' : 'plain';
      tokens.push([type, word]); i += word.length; continue;
    }
    match = rest.match(/^[-~^@/%|=+*!?&<>\[\]]+/);
    if (match) { tokens.push(['operator', match[0]]); i += match[0].length; continue; }
    match = rest.match(/^[{}();:,.]+/);
    if (match) { tokens.push(['delimiter', match[0]]); i += match[0].length; continue; }
    tokens.push(['plain', text[i]]);
    i += 1;
  }
  return tokens;
}

const DocsCodeBlock = React.memo(({ value = '' }) => {
  return React.createElement('pre', { className: 'docs-code-block', 'aria-label': 'Example code' },
    React.createElement('code', null, tokenizeGSCode(value).map((token, index) => React.createElement('span', { key: index, className: 'gs-token-' + token[0] }, token[1])))
  );
});

function fetchDocsApi() {
  try {
    const cached = localStorage.getItem(DOCS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < DOCS_CACHE_DURATION) {
        return Promise.resolve(parsed.data);
      }
    }
  } catch { }

  return fetch('https://api.moreno.land/api/gscript').then(r => r.json()).then(data => {
    try {
      localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    } catch { }
    return data;
  });
}

function DocsSection({ sectionKey, item, editingKey, editDraft, editStatus, deletingKey, deleteConfirm, deleteStatus, copiedShare, copiedCode, canEditDocs, canDeleteDocs, beginEdit, cancelEdit, saveEdit, deleteDefinition, setCopiedShare, setCopiedCode, setDeletingKey, setDeleteConfirm, setDeleteStatus }) {
  const key = sectionKey;
  const name = (item && item.name) || key;
  const isShareCopied = copiedShare === key;
  const isCodeCopied = copiedCode === key;
  const isEditing = editingKey === key && editDraft;
  const isSaving = isEditing && editStatus === 'Saving...';
  const editFormRef = React.useRef(null);
  const draftParams = (editDraft && editDraft.params) ? editDraft.params.split(',').map(function(p) { return p.trim(); }).filter(Boolean) : [];

  const renderMeta = function(label, field, value) {
    return React.createElement('div', { className: isEditing ? 'docs-editable-meta is-editing' : '' },
      React.createElement('strong', null, label + ': '),
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
              React.createElement('option', { value: 'variable' }, 'variable'),
              React.createElement('option', { value: 'event' }, 'event'),
              React.createElement('option', { value: 'object' }, 'object')
            )
            : React.createElement('input', { name: field, defaultValue: editDraft[field], ...EDIT_FIELD_PROPS }))
        : value && React.createElement('code', null, value)
    );
  };

  return React.createElement('div', { id: key, className: 'section-wrapper' + (isEditing ? ' is-editing' : ''), key: key, ref: isEditing ? editFormRef : null },
    React.createElement('h2', null,
      React.createElement('span', { className: 'docs-section-title' }, name),
      canEditDocs && React.createElement('span', { className: 'docs-edit-strip' },
        !isEditing && React.createElement('button', { type: 'button', onClick: function() { beginEdit(key, item); } }, 'Edit'),
        isEditing && React.createElement(React.Fragment, null,
          React.createElement('button', { type: 'button', className: isSaving ? 'is-saving' : '', disabled: isSaving, onClick: function() { saveEdit(key); } },
            isSaving && React.createElement('span', { className: 'docs-save-spinner', 'aria-hidden': 'true' }),
            isSaving ? 'Saving' : 'Save'
          ),
          React.createElement('button', { type: 'button', disabled: isSaving, onClick: cancelEdit }, 'Cancel'),
          canDeleteDocs && React.createElement('button', { type: 'button', className: 'is-danger', disabled: isSaving, onClick: function() {
            setDeletingKey(key);
            setDeleteConfirm('');
            setDeleteStatus('');
          } }, 'Delete')
        )
      ),
      React.createElement('button', {
        className: 'share-btn' + (isShareCopied ? ' copied' : ''),
        onClick: function(e) {
          e.stopPropagation();
          navigator.clipboard.writeText('https://share.gscript.dev/' + key + '?v=' + Date.now());
          setCopiedShare(key);
          setTimeout(function() { setCopiedShare(null); }, 2000);
        }
      }, isShareCopied ? 'Copied' : 'Share')
    ),
    isEditing
      ? React.createElement('textarea', { name: 'description', className: 'docs-inline-edit docs-description-edit', defaultValue: editDraft.description, rows: 5, ...EDIT_FIELD_PROPS, 'aria-label': 'Description' })
      : item.description && React.createElement('p', { dangerouslySetInnerHTML: { __html: memoizedRenderDocText(item.description) } }),
    (isEditing || item.type || item.params || item.returns || item.scope) && React.createElement('div', { className: 'docs-meta-panel' },
      renderMeta('Type', 'type', item.type),
      renderMeta('Parameters', 'params', isEditing ? draftParams.join(', ') : ((item.params || [])).join(', ')),
      renderMeta('Returns', 'returns', item.returns),
      renderMeta('Scope', 'scope', item.scope)
    ),
    (isEditing || item.example) && React.createElement('div', { className: 'code-wrapper' + (isEditing ? ' is-editing' : '') },
      !isEditing && React.createElement('button', {
        className: 'copy-btn' + (isCodeCopied ? ' copied' : ''),
        onClick: function(e) {
          e.stopPropagation();
          navigator.clipboard.writeText(item.example);
          setCopiedCode(key);
          setTimeout(function() { setCopiedCode(null); }, 2000);
        }
      }, isCodeCopied ? '\u2713' : 'Copy'),
      isEditing
        ? React.createElement(DocsMonacoExampleEditor, { name: 'example', defaultValue: editDraft.example, placeholder: 'Example', ariaLabel: 'Example' })
        : React.createElement(DocsCodeBlock, { value: item.example || '' })
    ),
    isEditing && editStatus && React.createElement('div', { className: 'docs-edit-status' + (/fail|required|invalid|forbidden|error/i.test(editStatus) ? ' is-error' : '') }, editStatus),
    isEditing && deletingKey === key && React.createElement('div', { className: 'docs-delete-panel' },
      React.createElement('p', null, 'Type ' + key + ' to permanently delete this definition.'),
      React.createElement('div', null,
        React.createElement('input', { value: deleteConfirm, onChange: function(e) { setDeleteConfirm(e.target.value); }, ...EDIT_FIELD_PROPS, 'aria-label': 'Type ' + key + ' to confirm deletion' }),
        React.createElement('button', { type: 'button', disabled: deleteConfirm.trim() !== key || deleteStatus === 'Deleting...', onClick: function() { deleteDefinition(key); } }, deleteStatus === 'Deleting...' ? 'Deleting' : 'Confirm Delete'),
        React.createElement('button', { type: 'button', className: 'is-cancel', disabled: deleteStatus === 'Deleting...', onClick: function() {
          setDeletingKey(null);
          setDeleteConfirm('');
          setDeleteStatus('');
        } }, 'Cancel')
      ),
      deleteStatus && React.createElement('span', { className: /fail|required|invalid|forbidden|error/i.test(deleteStatus) ? 'is-error' : '' }, deleteStatus)
    ),
    React.createElement('hr', null)
  );
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
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const [discordUser, setDiscordUser] = React.useState(readDiscordAuth);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [discordAuthError, setDiscordAuthError] = React.useState('');
  const [editingKey, setEditingKey] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState(null);
  const [editStatus, setEditStatus] = React.useState('');
  const [creatingDefinition, setCreatingDefinition] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState('');
  const [deletingKey, setDeletingKey] = React.useState(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState('');
  const [deleteStatus, setDeleteStatus] = React.useState('');
  const [initialLoading, setInitialLoading] = React.useState(true);
  const restoreScrollRef = React.useRef(null);
  const sidebarRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const docsListRef = React.useRef(null);
  const editFormRef = React.useRef(null);
  const createFormRef = React.useRef(null);
  const initialHashHandledRef = React.useRef(false);
  const searchTimeoutRef = React.useRef(null);
  const isMobile = window.innerWidth <= 768;

  const discordLoginUrl = React.useMemo(function() {
    const isDocsHost = window.location.hostname.toLowerCase() === 'docs.gscript.dev';
    const returnUrl = isDocsHost
      ? window.location.origin + (window.location.pathname || '/')
      : window.location.origin + window.location.pathname + window.location.search;
    return 'https://api.moreno.land/api/auth/discord/login?returnUrl=' + encodeURIComponent(returnUrl);
  }, []);

  const docsBackHref = React.useMemo(function() {
    return window.location.hostname.toLowerCase() === 'docs.gscript.dev' ? 'https://gscript.dev/' : './';
  }, []);

  const handleDiscordLogout = React.useCallback(function() {
    localStorage.removeItem(DISCORD_AUTH_STORAGE_KEY);
    setDiscordUser(null);
    setLogoutConfirmOpen(false);
  }, []);

  const handleDiscordAuthHash = React.useCallback(function() {
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

    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }, []);

  React.useEffect(function() {
    handleDiscordAuthHash();
  }, [handleDiscordAuthHash]);

  React.useEffect(function() {
    fetchDocsApi().then(function(data) {
      setApiData(data);
      setInitialLoading(false);
    }).catch(function(e) {
      console.error('GSDoc fetch error:', e);
      setInitialLoading(false);
    });
  }, []);

  const updateMetaTags = React.useCallback(function(id) {
    if (!apiData[id]) return;
    const item = apiData[id];
    const name = item.name || id;
    const desc = (item.description || 'GScript API function').replace(/`/g, '');
    var parts = [desc];
    if (item.type) parts.push('\nType: ' + item.type.charAt(0).toUpperCase() + item.type.slice(1));
    if (item.params && item.params.length > 0) parts.push('Parameters: ' + item.params.join(', '));
    if (item.returns) parts.push('Returns: ' + item.returns);
    if (item.scope) parts.push('Scope: ' + item.scope.charAt(0).toUpperCase() + item.scope.slice(1));
    if (item.example) {
      const lines = item.example.split('\n');
      parts.push('\nExample:\n' + lines.slice(0, 3).join('\n') + (lines.length > 3 ? '...' : ''));
    }
    const fullDesc = parts.join('\n');
    document.title = name + ' - GScript API Documentation';
    const ogUrl = document.getElementById('og-url');
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const twitterTitle = document.getElementById('twitter-title');
    const twitterDesc = document.getElementById('twitter-description');
    if (ogUrl) ogUrl.setAttribute('content', 'https://docs.gscript.dev/?share=' + id);
    if (ogTitle) ogTitle.setAttribute('content', name);
    if (ogDesc) ogDesc.setAttribute('content', fullDesc);
    if (twitterTitle) twitterTitle.setAttribute('content', name);
    if (twitterDesc) twitterDesc.setAttribute('content', fullDesc);
  }, [apiData]);

  const resolveDocId = React.useCallback(function(hash) {
    const id = hash.replace('#', '').toLowerCase();
    return Object.keys(apiData).find(function(key) {
      const itemName = (apiData[key] && apiData[key].name || '').toLowerCase();
      return key.toLowerCase() === id || itemName === id;
    }) || '';
  }, [apiData]);

  const scrollToHash = React.useCallback(function(hash) {
    const id = resolveDocId(hash) || hash.replace('#', '');
    if (id) setCurrentHash(id);
    const el = document.getElementById(id);
    if (el) {
      window.history.replaceState(null, '', '#' + id);
      const scroller = docsListRef.current;
      if (scroller) scroller.scrollTop = el.offsetTop;
      else el.scrollIntoView({ behavior: 'auto', block: 'start' });
      updateMetaTags(id);
    }
  }, [resolveDocId, updateMetaTags]);

  React.useEffect(function() {
    const handleHashChange = function() {
      if (handleDiscordAuthHash()) return;
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        scrollToHash(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return function() { window.removeEventListener('hashchange', handleHashChange); };
  }, [apiData, handleDiscordAuthHash, scrollToHash]);

  const handleSearch = React.useCallback(function(e) {
    const value = e.target.value.toLowerCase();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(function() {
      setSearchQuery(value);
    }, 400);
  }, []);

  const handleSectionClick = React.useCallback(function(key, e) {
    e.preventDefault();
    e.stopPropagation();
    scrollToHash(key);
    if (isMobile) setSidebarOpen(false);
  }, [scrollToHash, isMobile]);

  const toggleGroup = React.useCallback(function(groupName, e) {
    e.preventDefault();
    e.stopPropagation();
    setExpandedGroups(function(prev) {
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
  const canDeleteDocs = !!(discordUser && discordUser.botAdmin);

  const readDefinitionForm = React.useCallback(function(form, fallback, fallbackKey) {
    fallback = fallback || {};
    fallbackKey = fallbackKey || '';
    const read = function(field) {
      return (form && form.querySelector('[name="' + field + '"]') && form.querySelector('[name="' + field + '"]').value) || fallback[field] || '';
    };
    const key = (read('key') || read('name')).trim();
    return {
      key: key || fallbackKey,
      payload: {
        name: read('name') || key || fallbackKey,
        type: read('type'),
        scope: read('scope') || 'clientside',
        params: read('params').split(',').map(function(p) { return p.trim(); }).filter(Boolean),
        returns: read('returns') || 'void',
        description: read('description'),
        example: read('example')
      }
    };
  }, []);

  const beginEdit = React.useCallback(function(key, item) {
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
      key: key,
      top: (scroller && scroller.scrollTop) || 0,
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

  const cancelEdit = React.useCallback(function() {
    const key = editingKey;
    setEditingKey(null);
    setEditDraft(null);
    setEditStatus('');
    setDeletingKey(null);
    setDeleteConfirm('');
    setDeleteStatus('');
    if (key) {
      restoreScrollRef.current = restoreScrollRef.current || { key: key, top: (docsListRef.current && docsListRef.current.scrollTop) || 0, offset: 0 };
      window.history.replaceState(null, '', '#' + key);
    }
  }, [editingKey]);

  const updateEditDraft = React.useCallback(function(field, value) {
    setEditDraft(function(prev) { return { ...prev, [field]: value }; });
  }, []);

  const saveEdit = React.useCallback(async function(key) {
    if (!editDraft || !discordUser || !discordUser.token) return;
    setEditStatus('Saving...');
    try {
      const form = editFormRef.current;
      const payload = readDefinitionForm(form, editDraft, key).payload;

      const response = await fetch('https://api.moreno.land/api/gscript/' + encodeURIComponent(key), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + discordUser.token
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(function() { return {}; });
      if (!response.ok || !result.success) throw new Error(result.error || 'Save failed.');

      setApiData(function(prev) { return { ...prev, [key]: result.item || payload }; });
      setEditingKey(null);
      setEditDraft(null);
      setDeletingKey(null);
      setDeleteConfirm('');
      setDeleteStatus('');
      restoreScrollRef.current = restoreScrollRef.current || { key: key, top: (docsListRef.current && docsListRef.current.scrollTop) || 0, offset: 0 };
      window.history.replaceState(null, '', '#' + key);
      setTimeout(function() { setEditStatus(''); }, 2400);
    } catch (err) {
      setEditStatus(err.message || 'Save failed.');
    }
  }, [discordUser, editDraft, readDefinitionForm]);

  const beginCreate = React.useCallback(function() {
    setEditingKey(null);
    setEditDraft(null);
    setEditStatus('');
    setDeletingKey(null);
    setDeleteConfirm('');
    setDeleteStatus('');
    setCreatingDefinition(true);
    setCreateStatus('');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    requestAnimationFrame(function() {
      const scroller = docsListRef.current;
      if (scroller) scroller.scrollTop = 0;
    });
  }, []);

  const cancelCreate = React.useCallback(function() {
    setCreatingDefinition(false);
    setCreateStatus('');
  }, []);

  const saveCreate = React.useCallback(async function() {
    if (!discordUser || !discordUser.token) return;
    setCreateStatus('Creating...');
    try {
      const result = readDefinitionForm(createFormRef.current, { scope: 'clientside', returns: 'void' });
      const key = result.key;
      const payload = result.payload;
      if (!key || key.length > 120) throw new Error('Give the definition a valid key first.');

      const response = await fetch('https://api.moreno.land/api/gscript/' + encodeURIComponent(key), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + discordUser.token
        },
        body: JSON.stringify(payload)
      });
      const res = await response.json().catch(function() { return {}; });
      if (!response.ok || !res.success) throw new Error(res.error || 'Create failed.');

      setApiData(function(prev) { return { ...prev, [key]: res.item || payload }; });
      setCreatingDefinition(false);
      setCurrentHash(key);
      setActiveSection(key);
      window.history.replaceState(null, '', '#' + key);
      setTimeout(function() { scrollToHash(key); }, 80);
      setTimeout(function() { setCreateStatus(''); }, 2400);
    } catch (err) {
      setCreateStatus(err.message || 'Create failed.');
    }
  }, [discordUser, readDefinitionForm, scrollToHash]);

  const deleteDefinition = React.useCallback(async function(key) {
    if (!discordUser || !discordUser.token || deleteConfirm.trim() !== key) return;
    setDeleteStatus('Deleting...');
    try {
      const response = await fetch('https://api.moreno.land/api/gscript/' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + discordUser.token
        },
        body: JSON.stringify({ confirmation: deleteConfirm.trim() })
      });
      const result = await response.json().catch(function() { return {}; });
      if (!response.ok || !result.success) throw new Error(result.error || 'Delete failed.');

      setApiData(function(prev) {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setEditingKey(null);
      setEditDraft(null);
      setDeletingKey(null);
      setDeleteConfirm('');
      setDeleteStatus('');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err) {
      setDeleteStatus(err.message || 'Delete failed.');
    }
  }, [discordUser, deleteConfirm]);

  const groups = React.useMemo(function() {
    const grouped = {};
    const keyGroups = {};
    const ungrouped = [];
    Object.keys(apiData).forEach(function(key) {
      const item = apiData[key];
      const name = item.name || key;
      const desc = item.description || '';
      const allMatches = [];
      const matchName = name.match(/^([\w$]+)(?:\.|:+|_)/);
      if (matchName) allMatches.push(matchName);
      (desc || '').split('|').forEach(function(part) {
        const matchDesc = part.match(/^([\w$]+)(?:\.|:+|_)/);
        if (matchDesc) allMatches.push(matchDesc);
      });
      if (allMatches.length > 0) {
        var added = false;
        allMatches.forEach(function(match) {
          const rawGroup = match[1];
          const groupKey = rawGroup.toLowerCase();
          if (groupKey === 'clientside' || groupKey === 'serverside') return;
          if (!grouped[rawGroup]) grouped[rawGroup] = [];
          if (grouped[rawGroup].indexOf(key) === -1) grouped[rawGroup].push(key);
          if (!keyGroups[key]) keyGroups[key] = rawGroup;
          added = true;
        });
        if (!added) ungrouped.push(key);
      } else {
        ungrouped.push(key);
      }
    });
    return { grouped: grouped, ungrouped: ungrouped, keyGroups: keyGroups };
  }, [apiData]);

  const expandAllGroups = React.useCallback(function() {
    setExpandedGroups(function(prev) {
      var groupCount = Object.keys(groups.grouped).length;
      if (prev.size >= groupCount) return new Set();
      return new Set(Object.keys(groups.grouped));
    });
  }, [groups]);

  const clearSearch = React.useCallback(function() {
    setSearchQuery('');
  }, []);

  const refreshEntries = React.useCallback(function() {
    fetchDocsApi().then(function(data) { setApiData(data); });
  }, []);

  const renderSection = React.useCallback(function(key) {
    const item = apiData[key];
    if (!item) return null;
    return React.createElement(DocsSection, {
      sectionKey: key,
      item: item,
      editingKey: editingKey,
      editDraft: editDraft,
      editStatus: editStatus,
      deletingKey: deletingKey,
      deleteConfirm: deleteConfirm,
      deleteStatus: deleteStatus,
      copiedShare: copiedShare,
      copiedCode: copiedCode,
      canEditDocs: canEditDocs,
      canDeleteDocs: canDeleteDocs,
      beginEdit: beginEdit,
      cancelEdit: cancelEdit,
      saveEdit: saveEdit,
      deleteDefinition: deleteDefinition,
      setCopiedShare: setCopiedShare,
      setCopiedCode: setCopiedCode,
      setDeletingKey: setDeletingKey,
      setDeleteConfirm: setDeleteConfirm,
      setDeleteStatus: setDeleteStatus
    });
  }, [apiData, copiedShare, copiedCode, canEditDocs, canDeleteDocs, editingKey, editDraft, editStatus, deletingKey, deleteConfirm, deleteStatus, beginEdit, cancelEdit, saveEdit, deleteDefinition]);

  const renderCreateSection = React.useCallback(function() {
    if (!creatingDefinition) return null;
    const isCreating = createStatus === 'Creating...';
    const renderMeta = function(label, field, defaultValue) {
      return React.createElement('div', { className: 'docs-editable-meta is-editing' },
        React.createElement('strong', null, label + ': '),
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
              React.createElement('option', { value: 'variable' }, 'variable'),
              React.createElement('option', { value: 'event' }, 'event'),
              React.createElement('option', { value: 'object' }, 'object')
            )
            : React.createElement('input', { name: field, defaultValue: defaultValue, ...EDIT_FIELD_PROPS })
      );
    };
    const renderIdentity = function(label, field, placeholder) {
      return React.createElement('label', { className: 'docs-create-identity-field' },
        React.createElement('strong', null, label + ': '),
        React.createElement('input', { name: field, placeholder: placeholder, ...EDIT_FIELD_PROPS })
      );
    };

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
      React.createElement('div', { className: 'docs-create-identity' },
        renderIdentity('Name', 'name', 'function_or_variable_name')
      ),
      React.createElement('textarea', { name: 'description', className: 'docs-inline-edit docs-description-edit', defaultValue: '', rows: 5, placeholder: 'Description', ...EDIT_FIELD_PROPS, 'aria-label': 'Description' }),
      React.createElement('div', { className: 'docs-meta-panel' },
        renderMeta('Type', 'type', 'function'),
        renderMeta('Parameters', 'params', ''),
        renderMeta('Returns', 'returns', 'void'),
        renderMeta('Scope', 'scope', 'clientside')
      ),
      React.createElement('div', { className: 'code-wrapper is-editing' },
        React.createElement(DocsMonacoExampleEditor, { name: 'example', defaultValue: '', placeholder: 'Example', ariaLabel: 'Example' })
      ),
      createStatus && React.createElement('div', { className: 'docs-edit-status' + (/fail|required|invalid|forbidden|error/i.test(createStatus) ? ' is-error' : '') }, createStatus),
      React.createElement('hr', null)
    );
  }, [creatingDefinition, createStatus, saveCreate, cancelCreate]);

  const topLevelKeys = React.useMemo(function() {
    const keys = [];
    const ungrouped = groups.ungrouped;
    ungrouped.forEach(function(key) { keys.push(key); });
    return keys;
  }, [groups]);

  const orderedKeys = React.useMemo(function() {
    const groupedKeys = [];
    Object.keys(groups.grouped).sort().forEach(function(groupName) {
      groups.grouped[groupName].forEach(function(key) { groupedKeys.push(key); });
    });
    return topLevelKeys.concat(groupedKeys);
  }, [groups, topLevelKeys]);

  const visibleKeys = React.useMemo(function() {
    if (editingKey) return [editingKey];
    if (searchQuery) return orderedKeys;
    const selectedKey = currentHash || activeSection;
    const selectedGroup = selectedKey ? groups.keyGroups[selectedKey] : '';
    if (selectedGroup && groups.grouped[selectedGroup]) return groups.grouped[selectedGroup];
    return topLevelKeys;
  }, [activeSection, currentHash, editingKey, groups, orderedKeys, searchQuery, topLevelKeys]);

  React.useEffect(function() {
    if (!searchQuery) return;
    var groupsToExpand = [];
    Object.keys(groups.grouped).forEach(function(groupName) {
      var hasMatch = groups.grouped[groupName].some(function(key) {
        var item = apiData[key];
        var name = (item && item.name) || key;
        return key.toLowerCase().indexOf(searchQuery) !== -1 || name.toLowerCase().indexOf(searchQuery) !== -1;
      });
      if (hasMatch) groupsToExpand.push(groupName);
    });
    if (groupsToExpand.length > 0) {
      setExpandedGroups(function(prev) {
        var updated = new Set(prev);
        groupsToExpand.forEach(function(g) { updated.add(g); });
        return updated;
      });
    }
  }, [searchQuery, groups, apiData]);

  React.useEffect(function() {
    if (editingKey || !restoreScrollRef.current) return;
    const restore = restoreScrollRef.current;
    restoreScrollRef.current = null;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
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

  React.useEffect(function() {
    if (visibleKeys.length === 0) return;
    const scroller = docsListRef.current;
    if (!scroller) return;
    let scrollFrame = null;

    const setActiveKey = function(key) {
      if (!key) return;
      setActiveSection(key);
    };

    const updateActiveFromScroll = function() {
      setShowScrollTop(scroller.scrollTop > 360);
      if (scroller.scrollTop <= 2) {
        setActiveKey(visibleKeys[0]);
        return;
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
        setActiveKey(visibleKeys[visibleKeys.length - 1]);
        return;
      }
      const scrollerTop = scroller.getBoundingClientRect().top;
      let nextActive = visibleKeys[0];
      for (var i = 0; i < visibleKeys.length; i++) {
        const key = visibleKeys[i];
        const el = document.getElementById(key);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - scrollerTop;
        if (top <= 24) nextActive = key;
        else break;
      }
      setActiveKey(nextActive);
    };

    const onScroll = function() {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(updateActiveFromScroll);
    };

    const hash = window.location.hash.replace('#', '');
    const initialKey = !initialHashHandledRef.current && hash ? resolveDocId(hash) : '';
    initialHashHandledRef.current = true;
    if (initialKey) {
      setTimeout(function() { scrollToHash(initialKey); }, 50);
      setTimeout(updateActiveFromScroll, 500);
    } else {
      updateActiveFromScroll();
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return function() {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [visibleKeys, groups, resolveDocId, scrollToHash]);

  React.useEffect(function() {
    document.body.classList.add('docs-active');
    return function() { document.body.classList.remove('docs-active'); };
  }, []);

  const searchInputRef = React.useRef(null);

  const docsCount = Object.keys(apiData).length;
  const discordDisplayName = (discordUser && (discordUser.nickname || discordUser.username)) || 'Discord';
  const discordRoleLabel = discordUser && discordUser.botAdmin ? 'Bot Admin' : (discordUser && discordUser.botEditor ? 'Bot Editor' : 'Logged in');
  const discordLoginTitle = discordAuthError === 'discord_oauth_not_configured' ? 'Discord OAuth is not configured yet' : 'Login with Discord';

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
    React.createElement('div', { className: 'docs-shell' + (sidebarOpen ? ' sidebar-open' : ' sidebar-collapsed') },
      !sidebarOpen && React.createElement('button', { id: 'sidebar-open-toggle', type: 'button', onClick: function() { setSidebarOpen(true); }, 'aria-label': 'Open docs menu' },
        React.createElement('span', null, '\u276F')
      ),
      React.createElement('div', { id: 'sidebar-overlay', className: sidebarOpen ? 'show' : '', onClick: function() { setSidebarOpen(false); } }),
      React.createElement('div', { id: 'sidebar', className: sidebarOpen ? 'show' : (isMobile ? '' : 'hidden') },
        React.createElement('div', { id: 'sidebar-header' },
          React.createElement('button', { id: 'sidebar-toggle', type: 'button', onClick: function() { setSidebarOpen(!sidebarOpen); }, className: sidebarOpen ? '' : 'collapsed', 'aria-label': sidebarOpen ? 'Collapse docs menu' : 'Open docs menu' },
            React.createElement('span', null, sidebarOpen ? '\u276E' : '\u276F')
          ),
          React.createElement('a', { className: 'docs-back-link', href: docsBackHref }, 'Back'),
          React.createElement('h2', null,
            React.createElement('a', { href: 'https://api.moreno.land/api/gscript', target: '_blank', rel: 'noopener noreferrer', className: 'docs-title-link' }, '#gscript docs')
          ),
          React.createElement('p', null, docsCount ? docsCount + ' entries' : 'Loading entries'),
          React.createElement('div', { className: 'docs-auth-row' + (canEditDocs ? ' can-add' : '') },
            React.createElement('div', { className: 'docs-search-wrapper' },
              React.createElement('input', { ref: searchInputRef, type: 'text', id: 'search', placeholder: 'Search functions...', defaultValue: searchQuery, onChange: handleSearch }),
              searchQuery && React.createElement('button', { type: 'button', className: 'docs-search-clear', onClick: function() { clearSearch(); if (searchInputRef.current) searchInputRef.current.value = ''; }, 'aria-label': 'Clear search' }, '\u00D7')
            ),
            React.createElement('div', { className: 'docs-auth-side' },
              canEditDocs && React.createElement('button', {
                type: 'button',
                className: 'docs-auth-side-action docs-create-btn' + (creatingDefinition ? ' active' : ''),
                onClick: beginCreate,
                title: 'Add definition',
                'aria-label': 'Add definition'
              }, React.createElement('span', null, '+')),
              discordUser
                ? React.createElement('button', {
                    type: 'button',
                    className: 'docs-discord-auth logged-in' + (discordUser.botAdmin ? ' is-admin' : (discordUser.botEditor ? ' is-editor' : '')),
                    onClick: function() { setLogoutConfirmOpen(function(open) { return !open; }); },
                    title: discordDisplayName + ' - ' + discordRoleLabel + '.',
                    'aria-label': 'Discord account menu',
                    'aria-expanded': logoutConfirmOpen ? 'true' : 'false'
                  },
                    discordUser.avatarUrl
                      ? React.createElement('img', { src: discordUser.avatarUrl, alt: '' })
                      : React.createElement('i', { className: 'fab fa-discord' }),
                    (discordUser.botAdmin || discordUser.botEditor) && React.createElement('span', { className: 'docs-role-badge' }, discordUser.botAdmin ? 'A' : 'E')
                  )
                : React.createElement('a', {
                    className: 'docs-discord-auth' + (discordAuthError ? ' has-error' : ''),
                    href: discordLoginUrl,
                    title: discordLoginTitle,
                    'aria-label': 'Login with Discord'
                  }, React.createElement('i', { className: 'fab fa-discord' }))
            ),
            React.createElement('button', {
              type: 'button',
              className: 'docs-sidebar-action docs-refresh-btn',
              onClick: refreshEntries,
              title: 'Refresh entries',
              'aria-label': 'Refresh entries'
            }, React.createElement('span', null, '\u21BB')),
            React.createElement('button', {
              type: 'button',
              className: 'docs-sidebar-action docs-expand-btn' + (searchQuery ? ' active' : ''),
              onClick: expandAllGroups,
              title: 'Expand all groups',
              'aria-label': 'Expand all groups'
            }, React.createElement('span', null, '\u2261')),
          ),
          discordUser && logoutConfirmOpen && React.createElement('div', { className: 'docs-logout-popover' },
            React.createElement('span', null, 'Log out ' + discordDisplayName + '?'),
            React.createElement('div', null,
              React.createElement('button', { type: 'button', onClick: handleDiscordLogout }, 'Confirm'),
              React.createElement('button', { type: 'button', onClick: function() { setLogoutConfirmOpen(false); } }, 'Cancel')
            )
          )
        ),
        React.createElement('div', { id: 'sidebar-links' },
          groups.ungrouped.map(function(key) {
            const item = apiData[key];
            const name = (item && item.name) || key;
            return React.createElement('a', {
              href: '#' + key,
              key: key,
              className: activeSection === key ? 'active' : '',
              style: { display: searchQuery && key.toLowerCase().indexOf(searchQuery) === -1 && name.toLowerCase().indexOf(searchQuery) === -1 ? 'none' : 'flex' },
              onClick: function(e) { handleSectionClick(key, e); }
            }, name);
          }),
          Object.keys(groups.grouped).sort().map(function(groupName) {
            return React.createElement(React.Fragment, { key: groupName },
              React.createElement('div', { className: 'tree-parent' + (expandedGroups.has(groupName) ? ' expanded' : ''), onClick: function(e) { toggleGroup(groupName, e); } },
                React.createElement('span', { className: 'arrow' }, '\u25B6'),
                React.createElement('span', null, groupName)
              ),
              React.createElement('div', { className: 'tree-children' + (expandedGroups.has(groupName) ? ' show' : '') },
                [].concat(Array.from(new Set(groups.grouped[groupName]))).map(function(key) {
                  return React.createElement('a', {
                    href: '#' + key,
                    key: key,
                    className: activeSection === key ? 'active' : '',
                    style: { display: searchQuery && key.toLowerCase().indexOf(searchQuery) === -1 && (!apiData[key] || !apiData[key].name || apiData[key].name.toLowerCase().indexOf(searchQuery) === -1) ? 'none' : 'flex' },
                    onClick: function(e) { handleSectionClick(key, e); }
                  }, (apiData[key] && apiData[key].name) || key);
                })
              )
            );
          })
        )
      ),
      React.createElement('main', { id: 'content', ref: contentRef, className: (sidebarOpen ? '' : 'expanded') + (editingKey ? ' docs-editing-active' : '') },
        React.createElement('div', { className: 'docs-list', ref: docsListRef },
          initialLoading ? React.createElement('p', { className: 'docs-loading' }, 'Loading documentation...') :
          orderedKeys.length === 0 ? React.createElement('p', { className: 'docs-loading' }, 'Loading documentation...') :
          React.createElement(React.Fragment, null,
            renderCreateSection(),
            searchQuery
              ? orderedKeys.filter(function(key) {
                  var item = apiData[key];
                  var name = (item && item.name) || key;
                  return key.toLowerCase().indexOf(searchQuery) !== -1 || name.toLowerCase().indexOf(searchQuery) !== -1;
                }).map(function(key) { return renderSection(key); })
              : visibleKeys.map(function(key) { return renderSection(key); })
          )
        ),
        React.createElement('button', {
          type: 'button',
          className: 'docs-scroll-top' + (showScrollTop ? ' show' : ''),
          onClick: function() { if (docsListRef.current) docsListRef.current.scrollTo({ top: 0, behavior: 'smooth' }); },
          'aria-label': 'Scroll to top'
        }, React.createElement('span', null, String.fromCharCode(8593)))
      )
    )
  );
}
