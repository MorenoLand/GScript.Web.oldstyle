function initBytecodeConverter() {
  (function(){
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = function(...args) {
      if (typeof args[0] === 'string' && (args[0].includes('Source map error') || args[0].includes('URL constructor'))) return;
      if (typeof args[0] === 'string' && (args[0].includes('cloudflareinsights'))) return;
      originalError.apply(console, args);
    };
    console.warn = function(...args) {
      if (typeof args[0] === 'string' && (args[0].includes('Source map error') || args[0].includes('URL constructor'))) return;
      if (typeof args[0] === 'string' && (args[0].includes('cloudflareinsights'))) return;
      originalWarn.apply(console, args);
    };
  })();

  let sourceEditor;
  let outputEditor;
  const convertBtn = document.getElementById('convertBtn');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const pythonBtn = document.getElementById('pythonBtn');
  const statusInfo = document.getElementById('statusInfo');
  const saveModal = document.getElementById('saveModal');
  const pythonModal = document.getElementById('pythonModal');
  const filenameInput = document.getElementById('filenameInput');
  const confirmSaveBtn = document.getElementById('confirmSaveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const closePythonBtn = document.getElementById('closePythonBtn');
  const copyBtn = document.getElementById('copyBtn');
  const decompileMode = document.getElementById('decompileMode');
  const sourcePanelHeader = document.querySelector('.byte-panel:first-child .byte-panel-header');
  const outputPanelHeader = document.querySelector('.byte-panel:last-child .byte-panel-header');
  let currentBytecode = '';
  let isDecompileMode = false;

  function loadMonaco() {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
    monaco.languages.register({ id: 'gscript' });

    monaco.languages.setMonarchTokensProvider('gscript', {
      keywords: [
        'break', 'case', 'continue', 'default', 'do', 'else', 'elseif', 'for', 'if',
        'in', 'return', 'switch', 'while', 'with', 'join', 'leave', 'public', 'private',
        'const', 'enum', 'function', 'new', 'datablock', 'true', 'false', 'nil', 'null',
        'NULL', 'pi', 'timevar2'
      ],

      typeKeywords: [
        'join', 'leave'
      ],

      storageModifiers: [
        'public', 'private', 'const', 'enum', 'function'
      ],

      controlKeywords: [
        'break', 'case', 'continue', 'default', 'do', 'else', 'elseif', 'for', 'if',
        'in', 'return', 'switch', 'while', 'with'
      ],

      literals: [
        'true', 'false', 'nil', 'null', 'NULL', 'pi', 'timevar2'
      ],

      builtinVariables: [
        'this', 'thiso', 'temp', 'server', 'serverr', 'client', 'clientr', 'player', 'name'
      ],

      sqlKeywords: [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'FROM', 'WHERE',
        'VALUES', 'SET', 'INTO', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'AS', 'ON', 'JOIN',
        'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'OFFSET',
        'DISTINCT', 'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'PRIMARY', 'KEY', 'DEFAULT', 'INT', 'TEXT'
      ],

      operators: [
        '-', '~', '^', '@', '/', '%', '|', '=', '+', '*', '!', '?', '&', '<', '>'
      ],

      symbols: /[~\^@\/%\|=\+\*!?&<>\-\[\]\{\}\(\)\;:,.]+/,

      tokenizer: {
        root: [
          [/\s*#.*$/, 'comment'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          [/\$[a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)*/, 'variable.predefined'],
          [/\b[0-9]+/, 'number'],
          [/\b0[xX][0-9a-fA-F]+\b/, 'number.hex'],
          [/\b(break|case|continue|default|do|else|elseif|for|if|in|return|switch|while|with)\b/, 'keyword'],
          [/\b(join|leave)\b/, 'type'],
          [/\b(public|private|const|enum|function)\b/, 'storage.modifier'],
          [/\b(new|datablock)\b/, 'keyword.other'],
          [/\b(true|false|nil|null|NULL|pi|timevar2)\b/, 'constant.language'],
          [/\b(this|thiso|temp|server|serverr|client|clientr|player|name)\b/, 'variable.language'],
          [/[a-zA-Z_][a-zA-Z0-9_]*(?=\()/, 'entity.name.function'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
        ],

        comment: [
          [/[^\/*]+/, 'comment'],
          [/\/\*/, 'comment', '@push'],
          ['\\*/', 'comment', '@pop'],
          [/[\/*]/, 'comment'],
        ],

        string: [
          [/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|TABLE|FROM|WHERE|VALUES|SET|INTO|AND|OR|NOT|NULL|IS|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|BY|ORDER|LIMIT|OFFSET|DISTINCT|COUNT|AVG|SUM|MIN|MAX|PRIMARY|KEY|DEFAULT|INT|TEXT)\b/, 'keyword.other.sql'],
          [/[^\\"]+/, 'string'],
          [/"/, 'string', '@pop'],
        ],
      }
    });

    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'keyword.other', foreground: 'ff79c6' },
        { token: 'storage.modifier', foreground: 'ff79c6' },
        { token: 'type', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'string.sql', foreground: 'f1fa8c' },
        { token: 'keyword.other.sql', foreground: 'ff79c6', fontStyle: 'italic' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'number.hex', foreground: 'bd93f9' },
        { token: 'constant.language', foreground: 'bd93f9' },
        { token: 'variable.predefined', foreground: 'ffb86c' },
        { token: 'variable.language', foreground: 'ffb86c' },
        { token: 'entity.name.function', foreground: '50fa7b' },
        { token: 'identifier', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editorLineNumber.foreground': '#6272a4',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editor.selectionBackground': '#44475a',
        'editor.inactiveSelectionBackground': '#282a36',
        'editorCursor.foreground': '#f8f8f2',
        'editor.lineHighlightBorder': '#282a36',
        'editor.lineHighlightBackground': '#282a36',
      }
    });

    sourceEditor = monaco.editor.create(document.getElementById('sourceEditor'), {
      value: '',
      language: 'gscript',
      theme: 'dracula',
      automaticLayout: true,
      fontSize: 13,
      fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
      lineHeight: 21,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 4,
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      hideMarkersInOverviewRuler: true,
      scrollbar: {
        useShadows: false,
      },
    });

    outputEditor = monaco.editor.create(document.getElementById('outputEditor'), {
      value: '',
      language: 'gscript',
      theme: 'dracula',
      automaticLayout: true,
      fontSize: 13,
      fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
      lineHeight: 21,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 4,
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      hideMarkersInOverviewRuler: true,
      readOnly: true,
      stopRenderingLineAfter: -1,
      scrollbar: {
        useShadows: false,
      },
    });

    window.dispatchEvent(new Event('monaco-ready'));
  });
  }

  if (typeof require === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
    script.onload = loadMonaco;
    document.head.appendChild(script);
  } else {
    loadMonaco();
  }

  let gbfWasmLoaded = false;
  async function loadGbfWasm() {
    if (gbfWasmLoaded) return;
    try {
      await window.gbfWasmInit('js/gbf.wasm');
      gbfWasmLoaded = true;
    } catch (e) {
      console.error('Failed to load GBF WASM:', e);
      throw e;
    }
  }

  function hexToUint8Array(hex) {
    hex = hex.replace(/\s+/g, '');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  function cleanupDecompiled(code) {
    let lines = code.split('\n');
    let result = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.trim().match(/^lit\s*=\s*0;?$/)) {
        continue;
      }
      if (line.trim().match(/^return\s+lit;?$/)) {
        continue;
      }
      result.push(line);
    }
    code = result.join('\n');
    code = code.replace(/lit\s*=\s*"([^"]+)"\s*;\s*fn_call\s*=\s*echo\s*\(lit\)\s*;\s*lit\s*=\s*0;\s*return\s+lit;/g, 'echo("$1");');
    code = code.replace(/lit\s*=\s*"([^"]+)"\s*;\s*fn_call\s*=\s*echo\s*\(lit\)\s*;/g, 'echo("$1");');
    code = code.replace(/lit\s*=\s*"([^"]+)"\s*;\s*fn_call\s*=\s*([^(]+)\.([^(]+)\(lit\)\s*;/g, '$2.$3("$1");');
    code = code.replace(/lit\s*=\s*true\s*;\s*fn_call\s*=\s*([^\.]+)\.([^(]+)\(lit\)\s*;/g, '$1.$2(true);');
    code = code.replace(/lit\s*=\s*false\s*;\s*fn_call\s*=\s*([^\.]+)\.([^(]+)\(lit\)\s*;/g, '$1.$2(false);');
    code = code.replace(/lit\s*=\s*true\s*;\s*fn_call\s*=\s*([^(]+)\(lit\)\s*;/g, '$1(true);');
    code = code.replace(/lit\s*=\s*false\s*;\s*fn_call\s*=\s*([^(]+)\(lit\)\s*;/g, '$1(false);');
    code = code.replace(/lit\s*=\s*false\s*;\s*([^=]+\.visible\s*=\s*)lit\s*;/g, '$1false;');
    code = code.replace(/lit\s*=\s*true\s*;\s*([^=]+\.visible\s*=\s*)lit\s*;/g, '$1true;');
    code = code.replace(/fn_call\s*=\s*/g, '');
    code = code.replace(/function\s+(public|private)\.(\w+)/g, '$1 function $2');
    code = code.replace(/}\s*;/g, '};');
    code = code.replace(/\n\s*\n\s*\n/g, '\n\n');
    return code.trim();
  }

  function updateStatus(msg, isError = false) {
    statusInfo.textContent = msg;
    statusInfo.className = isError ? 'byte-info error' : 'byte-info';
  }

  function updateUIForMode() {
    isDecompileMode = decompileMode.checked;
    if (isDecompileMode) {
      convertBtn.textContent = 'Decompile to GS2';
      saveBtn.textContent = 'Save GS2 Code';
      sourcePanelHeader.querySelector('span').textContent = 'Bytecode Input';
      outputPanelHeader.querySelector('span').textContent = 'GS2 Output';
      statusInfo.textContent = 'Switched to decompile';
      if (sourceEditor) sourceEditor.updateOptions({ wordWrap: 'on' });
    } else {
      convertBtn.textContent = 'Convert to Bytecode';
      saveBtn.textContent = 'Save Bytecode';
      sourcePanelHeader.querySelector('span').textContent = 'GS2 Source Code';
      outputPanelHeader.querySelector('span').textContent = 'Bytecode Output';
      statusInfo.textContent = 'Switched to compile';
      if (sourceEditor) sourceEditor.updateOptions({ wordWrap: 'off' });
    }
  }

  let compilerInstance = null;
  async function getCompiler() {
    if (compilerInstance) return compilerInstance;
    if (typeof window.GS2Compiler === 'function') {
      compilerInstance = await window.GS2Compiler();
      return compilerInstance;
    }
    return null;
  }

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = isDecompileMode ? '.gs2' : '.txt';
    a.download = filename.endsWith('.gs2') || filename.endsWith('.txt') ? filename : filename + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showSaveDialog() {
    if (!currentBytecode) {
      updateStatus(isDecompileMode ? 'No GS2 code to save' : 'No bytecode to save', true);
      return;
    }
    filenameInput.value = 'output';
    saveModal.classList.add('show');
    filenameInput.focus();
    filenameInput.select();
  }

  function hideSaveDialog() {
    saveModal.classList.remove('show');
  }

  function performSave() {
    const filename = filenameInput.value.trim() || 'output';
    downloadFile(currentBytecode, filename);
    const ext = isDecompileMode ? '.gs2' : '.txt';
    updateStatus(`Saved: ${filename.endsWith('.gs2') || filename.endsWith('.txt') ? filename : filename + ext}`);
    hideSaveDialog();
  }

  function flipInputOutput() {
    const sourceValue = sourceEditor.getValue();
    const outputValue = outputEditor.getValue();
    sourceEditor.setValue(outputValue);
    outputEditor.setValue(sourceValue);
  }

  decompileMode.addEventListener('change', () => {
    updateUIForMode();
    if (currentBytecode) flipInputOutput();
  });

  const waitForGS2 = () => new Promise(r => { const check = () => window.GS2Compiler ? r() : setTimeout(check, 100); check(); });

  convertBtn.addEventListener('click', async () => {
    const code = sourceEditor.getValue().trim();
    console.log('Convert clicked, isDecompileMode:', isDecompileMode, 'decompileMode.checked:', decompileMode.checked);
    if (!code) {
      updateStatus(isDecompileMode ? 'Please enter bytecode to decompile' : 'Please enter GS2 code to convert', true);
      return;
    }
    if (isDecompileMode) {
      updateStatus('Decompiling...');
      convertBtn.disabled = true;
      try {
        await loadGbfWasm();
        const bytecode = hexToUint8Array(code);
        let decompiled = window.gbfDecompileBytecode(bytecode);
        decompiled = cleanupDecompiled(decompiled);
        currentBytecode = decompiled;
        outputEditor.setValue(decompiled);
        updateStatus('Decompilation successful!');
      } catch (error) {
        currentBytecode = '';
        const errorMsg = error.message || String(error);
        outputEditor.setValue(`Error: ${errorMsg}`);
      } finally {
        convertBtn.disabled = false;
      }
    } else {
      updateStatus('Compiling...');
      convertBtn.disabled = true;
      try {
        await waitForGS2();
        const compiler = await getCompiler();
        if (!compiler) {
          updateStatus('Error: Could not load compiler. Check console.', true);
          convertBtn.disabled = false;
          return;
        }
        const ctx = new compiler.GS2Context();
        const response = ctx.compile(code);
        if (!response.success) {
          const errVec = response.getErrors();
          const errors = [];
          for (let i = 0; i < errVec.size(); i++) errors.push(errVec.get(i));
          const errorMsg = errors.join('\n');
          currentBytecode = '';
          outputEditor.setValue(`Compilation failed:\n${errorMsg}`);
        } else {
          const bytecode = response.getBytecode();
          const hex = Array.from(bytecode).map(b => b.toString(16).padStart(2, '0')).join(' ');
          currentBytecode = hex;
          outputEditor.setValue(hex);
          updateStatus('Compilation successful! (' + bytecode.length + ' bytes)');
        }
      } catch (error) {
        currentBytecode = '';
        const errorMsg = error.message || String(error);
        outputEditor.setValue(`Error: ${errorMsg}\n\nStack:\n${error.stack || 'No stack trace'}`);
      } finally {
        convertBtn.disabled = false;
      }
    }
  });

  saveBtn.addEventListener('click', showSaveDialog);
  confirmSaveBtn.addEventListener('click', performSave);
  cancelBtn.addEventListener('click', hideSaveDialog);
  filenameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSave();
    if (e.key === 'Escape') hideSaveDialog();
  });
  saveModal.addEventListener('click', (e) => {
    if (e.target === saveModal) hideSaveDialog();
  });

  pythonBtn.addEventListener('click', () => {
    pythonModal.classList.add('show');
    const contentDiv = document.getElementById('pythonModalContent');
    if (!contentDiv.innerHTML.trim()) {
      contentDiv.innerHTML = `
        <style>
          .python-tabs { display: flex; gap: 4px; margin-bottom: 0; }
          .python-tab {
            flex: 1;
            padding: 15px 20px;
            background: rgba(0,0,0,0.4);
            color: #888;
            border: 1px solid rgba(255,255,255,0.1);
            border-bottom: none;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            font-size: 18px;
            font-weight: 500;
            transition: all 0.2s;
          }
          .python-tab:hover { background: rgba(64,255,64,0.1); color: #fff; }
          .python-tab.active {
            background: rgba(0,0,0,0.6);
            color: #40ff40;
            border-color: rgba(64,255,64,0.3);
            border-bottom: 1px solid rgba(0,0,0,0.6);
            margin-bottom: -1px;
          }
          .python-tab-content {
            background: rgba(0,0,0,0.6);
            border: 1px solid rgba(64,255,64,0.3);
            border-radius: 0 0 12px 12px;
            padding: 40px;
          }
          .python-section { display: none; }
          .python-section.active { display: block; }
          .python-desc { font-size: 16px; color: #f9f9f9; margin-bottom: 20px; line-height: 1.6; }
          .python-install-box {
            background: rgba(0,0,0,0.5);
            border: 1px solid rgba(64,255,64,0.3);
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Consolas', monospace;
            font-size: 14px;
            color: #40ff40;
          }
          .python-code {
            background: rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #f8f8f2;
            white-space: pre;
            overflow-x: auto;
            text-shadow: none !important;
          }
          .python-code .kw { color: #ff79c6; }
          .python-code .str { color: #f1fa8c; }
          .python-code .comment { color: #6272a4; }
          .python-code .func { color: #50fa7b; }
          .python-install-box { position: relative; }
          .python-code { position: relative; }
          .python-copy-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(64,255,64,0.2);
            border: 1px solid rgba(64,255,64,0.3);
            color: #40ff40;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
          }
          .python-copy-btn:hover { background: rgba(64,255,64,0.3); }
          .python-code-copy-btn { top: 10px; right: 10px; }
        </style>
        <div class="python-tabs">
            <div class="python-tab active" onclick="this.classList.add('active'); this.nextElementSibling.classList.remove('active'); document.getElementById('dec-section').classList.add('active'); document.getElementById('comp-section').classList.remove('active');">gs2decompiler</div>
            <div class="python-tab" onclick="this.classList.add('active'); this.previousElementSibling.classList.remove('active'); document.getElementById('comp-section').classList.add('active'); document.getElementById('dec-section').classList.remove('active');">gs2compiler</div>
          </div>
          <div class="python-tab-content">
            <div id="dec-section" class="python-section active">
              <p class="python-desc">Decompile GS2 bytecode (.gs2bc) files back to readable source code. Supports raw bytes, hex strings, and function extraction.</p>
              <div class="python-install-box">
                pip install gs2decompiler
                <button class="python-copy-btn" data-copy="pip install gs2decompiler">Copy</button>
              </div>
              <div class="python-code">
<span class="kw">from</span> gs2decompiler <span class="kw">import</span> decompile_bytes, decompile_file

<span class="comment"># Load from file</span>
code = decompile_file(<span class="str">"script.gs2bc"</span>)
<span class="kw">print</span>(code)

<span class="comment"># Or from hex string (real bytecode)</span>
bytecode = bytes.fromhex(
    <span class="str">"00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02"</span>
    <span class="str">"00 00 00 13 00 00 00 01 6f 6e 50 6c 61 79 65 72"</span>
    <span class="str">"45 6e 74 65 72 73 00 00 00 00 03 00 00 00 0a 74 65"</span>
    <span class="str">"73 74 00 65 63 68 6f 00 00 00 00 04 00 00 00 16 01"</span>
    <span class="str">"f4 00 0d 17 33 0a 09 17 15 f0 00 16 f0 01 06 20 14"</span>
    <span class="str">"f3 00 07 07 0a 00 00 00 00 00 00 00 00 00 00 00"</span>
)
code = decompile_bytes(bytecode)
<span class="kw">print</span>(code)

<span class="comment"># Output: function onPlayerEnters() &#123; echo("test"); &#125;</span>
<button class="python-copy-btn python-code-copy-btn" data-copy='from gs2decompiler import decompile_bytes, decompile_file

# Load from file
code = decompile_file("script.gs2bc")
print(code)

# Or from hex string (real bytecode)
bytecode = bytes.fromhex(
    "00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 02"
    "00 00 00 13 00 00 00 01 6f 6e 50 6c 61 79 65 72"
    "45 6e 74 65 72 73 00 00 00 00 03 00 00 00 0a 74 65"
    "73 74 00 65 63 68 6f 00 00 00 00 04 00 00 00 16 01"
    "f4 00 0d 17 33 0a 09 17 15 f0 00 16 f0 01 06 20 14"
    "f3 00 07 07 0a 00 00 00 00 00 00 00 00 00 00 00"
)
code = decompile_bytes(bytecode)
print(code)

# Output: function onPlayerEnters() { echo("test"); }'>Copy</button></div>
            </div>
            <div id="comp-section" class="python-section">
              <p class="python-desc">Compile GS2 source code to bytecode. Outputs raw bytecode by default for round-tripping with gs2decompiler, or add Graal file headers for .gs2bc files.</p>
              <div class="python-install-box">
                pip install gs2compiler
                <button class="python-copy-btn" data-copy="pip install gs2compiler">Copy</button>
              </div>
              <div class="python-code">
<span class="kw">from</span> gs2compiler <span class="kw">import</span> compile, compile_script
<span class="kw">from</span> gs2decompiler <span class="kw">import</span> decompile_bytes

<span class="comment"># Compile and decompile (round-trip)</span>
result = compile_script(<span class="str">'function onPlayerEnters() { echo("test"); }'</span>)

<span class="kw">if</span> result.Success:
    bytecode_hex = result.ByteCode.hex(<span class="str">' '</span>)
    bytecode = bytes.fromhex(bytecode_hex)
    decompiled = decompile_bytes(bytecode)
    <span class="kw">print</span>(decompiled)

<span class="comment"># Compile with Graal file header for .gs2bc files</span>
result = compile(
    script=<span class="str">'function onPlayerEnters() { echo("test"); }'</span>,
    type=<span class="str">"weapon"</span>,
    name=<span class="str">"myweapon"</span>,
    with_header=<span class="kw">True</span>  <span class="comment"># Include Graal file header</span>
)

<span class="kw">if</span> result.Success:
    <span class="kw">with</span> <span class="func">open</span>(<span class="str">"script.gs2bc"</span>, <span class="str">"wb"</span>) <span class="kw">as</span> f:
        f.write(result.ByteCode)
<button class="python-copy-btn python-code-copy-btn" data-copy='from gs2compiler import compile, compile_script
from gs2decompiler import decompile_bytes

# Compile and decompile (round-trip)
result = compile_script('function onPlayerEnters() { echo("test"); }')

if result.Success:
    bytecode_hex = result.ByteCode.hex(" ")
    bytecode = bytes.fromhex(bytecode_hex)
    decompiled = decompile_bytes(bytecode)
    print(decompiled)

# Compile with Graal file header for .gs2bc files
result = compile(
    script='function onPlayerEnters() { echo("test"); }',
    type="weapon",
    name="myweapon",
    with_header=True  # Include Graal file header
)

if result.Success:
    with open("script.gs2bc", "wb") as f:
        f.write(result.ByteCode)'>Copy</button></div>
            </div>
          </div>
      `;
      document.querySelectorAll('.python-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const text = btn.getAttribute('data-copy');
          navigator.clipboard.writeText(text);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      });
    }
  });

  closePythonBtn.addEventListener('click', () => {
    pythonModal.classList.remove('show');
  });

  pythonModal.addEventListener('click', (e) => {
    if (e.target === pythonModal) {
      pythonModal.classList.remove('show');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      showSaveDialog();
    }
  });

  window.addEventListener('monaco-ready', async () => {
    updateUIForMode();
    updateStatus('Loading GS2 compiler...');
    clearBtn.addEventListener('click', () => {
      sourceEditor.setValue('');
      outputEditor.setValue(isDecompileMode ? 'GS2 code will appear here...' : 'Bytecode will appear here...');
      currentBytecode = '';
      updateStatus('Cleared');
    });
    sourceEditor.onDidChangeModelContent(() => {
      if (sourceEditor.getValue().trim()) convertBtn.disabled = false;
    });
    copyBtn.addEventListener('click', async () => {
      const textToCopy = outputEditor.getValue();
      if (!textToCopy || textToCopy.includes('will appear here')) {
        updateStatus(isDecompileMode ? 'No GS2 code to copy' : 'No bytecode to copy', true);
        return;
      }
      try {
        await navigator.clipboard.writeText(textToCopy);
        updateStatus('Copied to clipboard!');
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '📋'; }, 2000);
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          updateStatus('Copied to clipboard!');
          copyBtn.textContent = '✓';
          setTimeout(() => { copyBtn.textContent = '📋'; }, 2000);
        } catch (e) {
          updateStatus('Failed to copy', true);
        }
        document.body.removeChild(textArea);
      }
    });
    await waitForGS2();
    try {
      const compiler = await getCompiler();
      if (compiler) {
        const mode = isDecompileMode ? 'decompiler' : 'compiler';
        updateStatus('Ready - GS2 ' + mode + ' loaded');
      } else {
        updateStatus('Warning: Could not load compiler. Check console.', true);
      }
    } catch (e) {
      updateStatus('Error loading compiler: ' + e.message, true);
    }
  });
}
