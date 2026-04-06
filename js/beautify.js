function BeautifyTool() {
  const [language, setLanguage] = React.useState('graalscript');
  const [stripComments, setStripComments] = React.useState(true);
  const [stripSpaces, setStripSpaces] = React.useState(false);
  const [beautify, setBeautify] = React.useState(false);
  const [indentSize, setIndentSize] = React.useState('2');
  const [copySuccess, setCopySuccess] = React.useState(false);
  const [monacoReady, setMonacoReady] = React.useState(false);
  const inputEditorRef = React.useRef(null);
  const outputEditorRef = React.useRef(null);
  const inputContainerRef = React.useRef(null);
  const outputContainerRef = React.useRef(null);

  const processCode = () => {
    if (!inputEditorRef.current) return;
    const code = inputEditorRef.current.getValue();
    if (!code.trim()) return;
    let processedCode = code;
    if (stripComments) {
      const directives = [];
      processedCode = processedCode.replace(/^\/\/#CLIENTSIDE\s*$/gm, (match) => { directives.push(match); return `__DIRECTIVE_${directives.length - 1}__`; });
      const lang = { javascript: { singleLine: ['//', '///'], multiLine: [['/*', '*/']], stringDelimiters: ['"', "'", '`'] } };
      const l = lang.javascript;
      const single = l.singleLine || [];
      const multi = l.multiLine || [];
      const strings = l.stringDelimiters || ['"', "'"];
      const lines = processedCode.split('\n');
      const result = [];
      let inMulti = false;
      let inString = false;
      let strDelim = '';
      let escaped = false;
      for (const line of lines) {
        let res = '';
        let j = 0;
        let hasCode = false;
        while (j < line.length) {
          if (inMulti) {
            if (line.substring(j, j + 2) === '*/') {
              j += 2;
              inMulti = false;
            } else {
              j++;
            }
            continue;
          }
          if (inString) {
            if (line[j] === '\\' && !escaped) {
              res += line[j];
              escaped = true;
              j++;
              continue;
            }
            if (line.substring(j, j + strDelim.length) === strDelim && !escaped) {
              res += strDelim;
              j += strDelim.length;
              inString = false;
              hasCode = true;
              continue;
            }
            res += line[j];
            if (escaped) escaped = false;
            j++;
            continue;
          }
          let strMatch = false;
          for (const delim of strings) {
            if (line.substring(j, j + delim.length) === delim) {
              res += delim;
              j += delim.length;
              inString = true;
              strDelim = delim;
              hasCode = true;
              strMatch = true;
              break;
            }
          }
          if (strMatch) continue;
          let multiMatch = false;
          for (const [start, end] of multi) {
            if (line.substring(j, j + start.length) === start) {
              inMulti = true;
              j += start.length;
              if (line.indexOf(end, j) !== -1) {
                j = line.indexOf(end, j) + end.length;
                inMulti = false;
              }
              multiMatch = true;
              break;
            }
          }
          if (multiMatch) continue;
          let singleMatch = false;
          for (const start of single) {
            if (line.substring(j, j + start.length) === start) {
              j = line.length;
              singleMatch = true;
              break;
            }
          }
          if (singleMatch) continue;
          if (!(/^\s*$/.test(line[j]))) hasCode = true;
          res += line[j];
          j++;
        }
        result.push(res);
      }
      processedCode = result.join('\n');
      directives.forEach((dir, i) => { processedCode = processedCode.replace(`__DIRECTIVE_${i}__`, dir); });
    }
    if (stripSpaces) { const lines = processedCode.split('\n').filter(line => line.trim() !== ''); processedCode = lines.map(line => line.trimRight()).join('\n'); }
    if (beautify) {
      try {
        processedCode = js_beautify(processedCode, { indent_size: indentSize === 'tab' ? 1 : parseInt(indentSize), indent_char: indentSize === 'tab' ? '\t' : ' ', 'wrap_line_length': 0, 'brace_style': 'collapse', 'preserve_newlines': false, 'max_preserve_newlines': 0 });
      } catch (e) { }
    }
    if (outputEditorRef.current) outputEditorRef.current.setValue(processedCode);
  };

  const copyToClipboard = () => { if (!outputEditorRef.current) return; navigator.clipboard.writeText(outputEditorRef.current.getValue()).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 1500); }); };
  const clearInput = () => { if (inputEditorRef.current) inputEditorRef.current.setValue(''); };
  const clearOutput = () => { if (outputEditorRef.current) outputEditorRef.current.setValue(''); };
  const clearBoth = () => { clearInput(); clearOutput(); };

  React.useEffect(() => {
    const loadMonaco = () => {
      require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
      require(['vs/editor/editor.main'], function() {
        monaco.languages.register({ id: 'graalscript' });
        monaco.languages.setMonarchTokensProvider('graalscript', {
        keywords: [
          'break', 'case', 'continue', 'default', 'do', 'else', 'elseif', 'for', 'if',
          'in', 'return', 'switch', 'while', 'with', 'join', 'leave', 'public', 'private',
          'const', 'enum', 'function', 'new', 'datablock', 'true', 'false', 'nil', 'null',
          'NULL', 'pi', 'timevar2', 'this', 'thiso', 'temp', 'server', 'serverr', 'client',
          'clientr', 'player', 'name'
        ],
        sqlKeywords: [
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'FROM', 'WHERE',
          'VALUES', 'SET', 'INTO', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'AS', 'ON', 'JOIN',
          'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'OFFSET',
          'DISTINCT', 'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'PRIMARY', 'KEY', 'DEFAULT', 'INT', 'TEXT'
        ],
        operators: [
          '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
          '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
          '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
          '%=', '<<=', '>>=', '>>>=', '~', '@', '/'
        ],
        symbols: /[=><!~?:&|+\-*\/\^%@]+/,
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        tokenizer: {
          root: [
            [/\$[a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)*/, 'variable.parameter'],
            [/[a-z_$][\w$]*/, {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
            { include: '@whitespace' },
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': ''
              }
            }],
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\b\d+\b/, 'number'],
            [/[;,.]/, 'delimiter'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string.sql', '@sqlstring'],
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
          ],
          sqlstring: [
            [/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|TABLE|FROM|WHERE|VALUES|SET|INTO|AND|OR|NOT|NULL|IS|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|BY|ORDER|LIMIT|OFFSET|DISTINCT|COUNT|AVG|SUM|MIN|MAX|PRIMARY|KEY|DEFAULT|INT|TEXT)\b/, 'keyword.other.sql'],
            [/[^\\"]+/, 'string'],
            [/"/, 'string', '@pop'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid']
          ],
          whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/\/\/.*$/, 'comment'],
            [/^\s*#.*$/, 'comment'],
            [/(?:^|\s)\/\*/, 'comment', '@comment']
          ],
          comment: [
            [/[^\/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            ['\\*/', 'comment', '@pop'],
            [/[\/*]/, 'comment']
          ],
        }
      });
      monaco.editor.defineTheme('dracula', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'ff79c6' },
          { token: 'keyword.other.sql', foreground: 'ff79c6', fontStyle: 'italic' },
          { token: 'string.sql', foreground: 'f1fa8c' },
          { token: 'string', foreground: 'f1fa8c' },
          { token: 'number', foreground: 'bd93f9' },
          { token: 'type', foreground: 'ff79c6' },
          { token: 'identifier', foreground: 'f8f8f2' },
          { token: 'variable.parameter', foreground: 'ffb86c' },
        ],
        colors: {
          'editor.background': '#282a36',
          'editor.foreground': '#f8f8f2',
          'editorLineNumber.foreground': '#6272a4cc',
          'editorLineNumber.activeForeground': '#f8f8f2',
          'editor.selectionBackground': '#44475a',
          'editorCursor.foreground': '#f8f8f2',
          'editor.lineHighlightBorder': '#282a36',
          'editor.lineHighlightBackground': '#282a3644',
        }
      });
      if (inputContainerRef.current) {
        inputEditorRef.current = monaco.editor.create(inputContainerRef.current, {
          value: '',
          language: 'javascript',
          theme: 'dracula',
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
          lineHeight: 21,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
          renderLineHighlight: 'all',
          overviewRulerLanes: 0,
          scrollbar: { useShadows: false },
          renderValidationDecorations: 'off',
        });
      }
      if (outputContainerRef.current) {
        outputEditorRef.current = monaco.editor.create(outputContainerRef.current, {
          value: '',
          language: 'javascript',
          theme: 'dracula',
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
          lineHeight: 21,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
          renderLineHighlight: 'all',
          overviewRulerLanes: 0,
          readOnly: true,
          scrollbar: { useShadows: false },
          renderValidationDecorations: 'off',
        });
      }
      setMonacoReady(true);
      });
    };

    if (typeof require === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
      script.onload = loadMonaco;
      document.head.appendChild(script);
    } else {
      loadMonaco();
    }
  }, []);

  React.useEffect(() => { if (monacoReady && inputEditorRef.current) { monaco.editor.setModelLanguage(inputEditorRef.current.getModel(), language); if (outputEditorRef.current) monaco.editor.setModelLanguage(outputEditorRef.current.getModel(), language); } }, [language, monacoReady]);

  return React.createElement('div', { style: { width: '100%', maxWidth: '95%', margin: '40px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
    React.createElement('div', { style: { display: 'flex', gap: '25px', width: '100%', height: '75vh' } },
      React.createElement('div', { style: { flex: 1, background: 'rgba(30, 30, 46, 0.85)', borderRadius: '8px', border: '1px solid #44475a', display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
        React.createElement('div', { style: { position: 'relative', padding: '10px 15px', borderBottom: '1px solid #44475a', color: '#bd93f9', fontSize: '14px' } }, 'Input ', React.createElement('button', { onClick: clearInput, style: { position: 'absolute', right: '10px', top: '7px', fontSize: '14px', padding: '2px 4px', backgroundColor: 'transparent', color: '#ff79c6', border: 'none', cursor: 'pointer' } }, '✕')),
        React.createElement('div', { ref: inputContainerRef, style: { flex: 1, overflow: 'hidden' }, className: 'monaco-editor-container' })
      ),
      React.createElement('div', { style: { flex: 1, background: 'rgba(30, 30, 46, 0.85)', borderRadius: '8px', border: '1px solid #44475a', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' } },
        React.createElement('div', { style: { position: 'relative', padding: '10px 15px', borderBottom: '1px solid #44475a', color: '#bd93f9', fontSize: '14px' } }, 'Output ', React.createElement('button', { onClick: clearOutput, style: { position: 'absolute', right: '10px', top: '7px', fontSize: '14px', padding: '2px 4px', backgroundColor: 'transparent', color: '#ff79c6', border: 'none', cursor: 'pointer' } }, '✕'), React.createElement('button', { onClick: copyToClipboard, style: { position: 'absolute', right: '35px', top: '7px', fontSize: '16px', padding: '2px 4px', backgroundColor: 'transparent', color: copySuccess ? '#50fa7b' : '#bd93f9', border: 'none', cursor: 'pointer' } }, copySuccess ? '✓' : '📋')),
        React.createElement('div', { ref: outputContainerRef, style: { flex: 1, overflow: 'hidden' }, className: 'monaco-editor-container' })
      )
    ),
    React.createElement('div', { style: { padding: '20px 0', display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', flexWrap: 'wrap' } },
      React.createElement('select', { value: language, onChange: (e) => setLanguage(e.target.value), style: { backgroundColor: '#282a36', color: '#f8f8f2', border: '1px solid #44475a', borderRadius: '4px', padding: '8px 12px', outline: 'none', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px', textShadow: '1px 1px 1px rgba(0, 0, 255, 1)' } },
        React.createElement('option', { value: 'javascript', style: { fontFamily: '"Tempus Sans ITC", sans-serif' } }, 'JavaScript'),
        React.createElement('option', { value: 'graalscript', style: { fontFamily: '"Tempus Sans ITC", sans-serif' } }, 'Graal Script')
      ),
      React.createElement('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px', textShadow: '1px 1px 1px rgba(0, 0, 255, 1)' } }, React.createElement('input', { type: 'checkbox', checked: stripComments, onChange: (e) => setStripComments(e.target.checked), style: { margin: 0, accentColor: '#40ff40' } }), ' Strip Comments'),
        React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px', textShadow: '1px 1px 1px rgba(0, 0, 255, 1)' } }, React.createElement('input', { type: 'checkbox', checked: stripSpaces, onChange: (e) => setStripSpaces(e.target.checked), style: { margin: 0, accentColor: '#40ff40' } }), ' Strip Spaces'),
        React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px', textShadow: '1px 1px 1px rgba(0, 0, 255, 1)' } }, React.createElement('input', { type: 'checkbox', checked: beautify, onChange: (e) => setBeautify(e.target.checked), style: { margin: 0, accentColor: '#40ff40' } }), ' Beautify Code'),
        React.createElement('select', { value: indentSize, onChange: (e) => setIndentSize(e.target.value), style: { marginLeft: '4px', backgroundColor: '#282a36', color: '#f8f8f2', border: '1px solid #44475a', borderRadius: '4px', padding: '8px 12px', outline: 'none', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px', textShadow: '1px 1px 1px rgba(0, 0, 255, 1)' } },
          React.createElement('option', { value: '2', style: { fontFamily: '"Tempus Sans ITC", sans-serif' } }, '2 Spaces'),
          React.createElement('option', { value: '4', style: { fontFamily: '"Tempus Sans ITC", sans-serif' } }, '4 Spaces'),
          React.createElement('option', { value: 'tab', style: { fontFamily: '"Tempus Sans ITC", sans-serif' } }, 'Tab')
        )
      ),
      React.createElement('button', { onClick: processCode, style: { backgroundColor: 'rgba(64, 255, 64, 0.3)', color: '#40ff40', border: '1px solid rgba(64, 255, 64, 0.3)', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontWeight: '500', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px' } }, 'Process Code'),
      React.createElement('button', { onClick: clearBoth, style: { backgroundColor: 'rgba(255, 121, 198, 0.2)', color: '#ff79c6', border: '1px solid rgba(255, 121, 198, 0.3)', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontWeight: '500', fontFamily: '"Tempus Sans ITC", sans-serif', fontSize: '18px' } }, 'Clear Both')
    )
  );
}
