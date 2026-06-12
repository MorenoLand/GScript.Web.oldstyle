const fileFormatTabs = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'fas fa-compass',
    title: 'Format map',
    lead: 'A practical reference for the level, map, and animation files used by the classic tools.',
    chips: ['.nw', '.gmap', '.zelda', '.graal', '.gani'],
    sections: [
      {
        title: 'What the formats carry',
        points: [
          'Levels are 64 by 64 tiles. Tiles are 16x16 pixels from a packed tileset atlas, usually pics1.png.',
          'Level data can include links, baddies, signs, treasure boxes, and programmable NPCs.',
          '.nw is the modern text level format: tile board rows plus links, signs, chests, baddies, NPCs, and tileset metadata.',
          '.gmap stitches many 64x64 .nw levels into one larger map by listing a grid of level filenames.',
          '.zelda and .graal are the old compact binary level formats. They use a packed tile stream, then object sections.',
          '.gani is the animation format: sprite definitions, optional effects/default images, frame rows, sounds, and script blocks.'
        ]
      },
      {
        title: 'Level object basics',
        rows: [
          ['Links', 'Rectangles that move the player to another level and destination coordinate.'],
          ['Baddies', 'Enemy entries with x, y, type, and three optional verse strings.'],
          ['Signs', 'Indexed text strings used for signs, dialog, and other message boxes.'],
          ['Treasure boxes', '2x2 chests with an item type and optional sign/message index.'],
          ['NPCs', 'Self-contained scripted objects with x/y, optional image, and source code.']
        ]
      },
      {
        title: 'Tile coordinate rule',
        code: 'atlasX = floor(index / 512) * 16 + index % 16\natlasY = floor(index / 16) % 32\n\n// Editor-side decode from a two-char .nw tile value:\ng = (base64A << 6) + base64B\ntileX = (g & 0xF) + 16 * floor((g >> 4) / 32)\ntileY = (g >> 4) % 32',
        note: 'The old document and the Suite level editor agree on the same packed atlas coordinate math.'
      }
    ]
  },
  {
    id: 'nw',
    label: '.nw',
    icon: 'fas fa-border-all',
    title: '.nw level files',
    lead: 'Text levels begin with GLEVNW01 and are made from command lines plus block sections.',
    sections: [
      {
        title: 'File skeleton',
        code: 'GLEVNW01\nBOARD 0 0 64 0 <128 base64 chars>\n...\nBOARD 0 63 64 0 <128 base64 chars>\n\nLINK level2.nw 10 20 4 2 30 40\nSIGN 12 18\nText shown by the sign.\nSIGNEND\n\nCHEST 8 9 greenrupee 0\nNPC image.png 20 22\n// script\nNPCEND\nTILESET pics1.png',
        note: 'The editor writes one BOARD line per row for layer 0. Extra layers are written only where tiles exist.'
      },
      {
        title: 'Why .nw is larger but easier',
        points: [
          'The old binary formats use run-length encoded tile packets, so tiny/simple levels can be very small.',
          '.nw writes text. A normal 64x64 base layer alone is 64 BOARD lines and about 9.3 KB before objects.',
          'That sounds wasteful, but text compresses well with lz/gzip and is much easier for tools and people to inspect.'
        ]
      },
      {
        title: 'Tile base64 encoding',
        code: 'base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"\n\n// Each .nw tile is two characters.\nvalue = base64.indexOf(char1) * 64 + base64.indexOf(char2)\n\n// Convert packed value to the classic tileset atlas coordinate.\ntileX = (value & 0xF) + 16 * floor((value >> 4) / 32)\ntileY = (value >> 4) % 32\n\n// Convert atlas coordinate back to a two-character .nw tile.\nvalue = floor(tileX / 16) * 512 + (tileX % 16) + tileY * 16\nchar1 = base64[value >> 6]\nchar2 = base64[value & 0x3F]',
        note: 'A BOARD row with width 64 has 128 characters because every tile is exactly two base64 characters.'
      },
      {
        title: 'Commands',
        rows: [
          ['BOARD x y width layer data', 'Tile run. Each tile is two base64 characters. The default board is usually 64 rows of width 64 on layer 0.'],
          ['LINK nextLevel x y width height nextX nextY [nextLayer layer]', 'Warp rectangle. Suite also accepts destination names with spaces by reading until the first numeric field.'],
          ['SIGN x y [layer]', 'Text block ending at SIGNEND.'],
          ['CHEST x y item signIndex [layer]', 'Treasure chest. Item names use the editor item table.'],
          ['BADDY x y type [layer]', 'Baddy block with up to three verse lines, ending at BADDYEND.'],
          ['NPC image x y [layer]', 'NPC block ending at NPCEND. Use - for no image.'],
          ['TILESET filename [type]', 'Tileset metadata, commonly pics1.png.']
        ]
      }
    ]
  },
  {
    id: 'gmap',
    label: '.gmap',
    icon: 'fas fa-map',
    title: '.gmap maps',
    lead: 'A GMAP is a text manifest that arranges level files into a larger world grid.',
    sections: [
      {
        title: 'Core shape',
        code: 'GRMAP001\nWIDTH 3\nHEIGHT 2\nTILESET pics1.png\nLEVELNAMES\nlevel_a.nw,level_b.nw,level_c.nw\nlevel_d.nw,level_e.nw,level_f.nw\nLEVELNAMESEND',
        note: 'Suite reads WIDTH, HEIGHT, TILESET, and LEVELNAMES. The grid rows are comma-separated filenames.'
      },
      {
        title: 'How editors merge it',
        points: [
          'Each grid cell is one 64x64 level.',
          'The editor loads the referenced .nw files, offsets their tiles by cellX * 64 and cellY * 64, and merges objects the same way.',
          'Missing levels leave empty cells instead of invalidating the whole map.'
        ]
      }
    ]
  },
  {
    id: 'classic',
    label: '.zelda / .graal',
    icon: 'fas fa-box-archive',
    title: '.zelda and .graal binary levels',
    lead: 'The compact legacy formats store a header, a packed 4096-tile board, then object sections.',
    sections: [
      {
        title: 'Known headers',
        rows: [
          ['Z3-V1.03', '12-bit tiles. Links and signs are known; baddy support is uncertain in the source document; no treasure or NPCs.'],
          ['Z3-V1.04', '12-bit tiles. Links, LttP baddies, and signs; no treasure or NPCs. Suite saves .zelda as this header.'],
          ['GR-V1.00', '12-bit tiles. Links, LttP baddies, and signs. Treasure/NPC support is unclear; files include an extra # after the baddy stop code.'],
          ['GR-V1.01', '12-bit tiles. Links, LttP baddies, signs, treasure, and NPCs. Some NPC entries may contain garbage data that the game still accepts.'],
          ['GR-V1.02', '13-bit tiles. Links, all baddies, signs, treasure, and NPCs. Adds golden soldier and two lizard baddy types.'],
          ['GR-V1.03', '13-bit tiles. Final .graal revision seen in the document. Adds golden rupee, electric bombs, and horses. Suite saves .graal as this header.']
        ]
      },
      {
        title: 'Tile stream',
        code: 'bits = header is GR-V1.02 or GR-V1.03 ? 13 : 12\ncontrolBit = bits == 13 ? 0x1000 : 0x800\n\nwhile board has fewer than 4096 tiles:\n  packet = read next 12 or 13 bits, little-endian from the byte stream\n\n  if packet has controlBit:\n    repeatCount = packet & 0xFF\n    doubleRepeat = packet has bit 0x100\n    continue\n\n  if repeatCount == 1:\n    append decodeTile(packet)\n  else if doubleRepeat:\n    read two tile packets A and B\n    append A, B, A, B... repeatCount times\n  else:\n    append decodeTile(packet) repeatCount times',
        note: 'The packed stream starts immediately after the 8-byte header and stops once the 64x64 board is filled.'
      },
      {
        title: 'Binary object sections',
        rows: [
          ['Links', 'ASCII lines until #. Parameters are destination, width, height, x, y, newX, newY in the old document; Suite reads/writes destination, x, y, width, height, newX, newY for its own exports and tolerates destination names with spaces.'],
          ['Baddies', 'Three raw bytes for x, y, type, then one line of three verse strings. The document describes quote separators; Suite reads/writes backslash separators. Ends with FF FF FF and a newline.'],
          ['NPCs', '.graal only. Each line starts with x+32 and y+32 bytes, then optional image, #, and source code. NPC line breaks are stored as byte A7. Ends with #.'],
          ['Chests', 'GR-V1.02/1.03. Each line stores x+32, y+32, itemIndex+32, signIndex+32, then newline. Ends with #; some versions may also include a null chest FF FF FF 00.'],
          ['Signs', 'Run until EOF. Each line starts with x+32 and y+32, then encoded sign text. Sign text is not ASCII; it uses the old sign character table.']
        ]
      },
      {
        title: 'Chest sign index',
        code: 'no sign = 31\n\n// Decode chest sign parameter from old binary files:\nsignIndex = (param + 224) % 256\n\n// Encode a sign index for a chest:\nparam = (signIndex + 32) % 256'
      },
      {
        title: 'Sign character table',
        rows: [
          ['32-57', 'A-Z'],
          ['58-83', 'a-z'],
          ['84-93', '0-9'],
          ['94-102', '! ? - . , ... > ( )'],
          ['103-106', 'Ancient 1, Ancient 2, Ancient 3, Head'],
          ['107-117', '" arrows, apostrophe, colon, slash, tilde, ampersand, #'],
          ['118-126', 'Yinyang, space, <, bold A/B/X/Y, semicolon, newline']
        ]
      },
      {
        title: 'Old corruption note',
        points: [
          'Some old accepted levels have corrupted-looking sections, especially around early NPC support.',
          'The old document notes that NPC text could look like extra baddy definitions or nonsense source code, probably from uncleared editor memory.',
          'A reader should be forgiving after the tile stream and not assume every weird object tail means the whole file is invalid.'
        ]
      },
      {
        title: 'Object order',
        code: 'links, terminated by "#\\n"\nbaddies, terminated by FF FF FF + newline\nNPCs, terminated by "#\\n" (.graal only)\nchests, terminated by "#\\n" (.graal GR-V1.02/1.03)\nsigns, until end of file',
        note: 'NPC code stores line breaks as byte 0xA7. Sign characters use the old sign sprite-sheet table instead of plain ASCII.'
      }
    ]
  },
  {
    id: 'gani',
    label: '.gani',
    icon: 'fas fa-person-running',
    title: '.gani animation files',
    lead: 'GANI files define reusable animation sprites, frame pieces, optional effects, sounds, and script code.',
    sections: [
      {
        title: 'File skeleton',
        code: 'GANI0001\nSPRITE 0001 BODY 0 0 32 48 body\nDEFAULTHEAD head19.png\nDEFAULTBODY body.png\nLOOP\nANI\n 1 0 0,2 16 0\n 1 0 0,2 16 0\n 1 0 0,2 16 0\n 1 0 0,2 16 0\nWAIT 1\nANIEND\nSCRIPT\n// optional script\nSCRIPTEND',
        note: 'The animation editor saves GANI0001. It can load the bad GANI0FP4 watermark header and resave it cleanly.'
      },
      {
        title: 'Commands parsed by the Suite editor',
        rows: [
          ['SPRITE index source left top width height [comment]', 'Defines a cropped sprite. Source can be HEAD, BODY, SWORD, SHIELD, SPRITES, HORSE, PICS, ATTR1-ATTR19, PARAM1-PARAM10, or a custom image filename.'],
          ['DEFAULTTYPE filename', 'Overrides default art for a type, for example DEFAULTHEAD head0.png or DEFAULTSPRITES sprites.png.'],
          ['ATTACHSPRITE parent child x y', 'Attaches a sprite to a parent after the parent in draw order.'],
          ['ATTACHSPRITE2 parent child x y', 'Attaches a sprite before/behind the parent in draw order.'],
          ['ZOOMEFFECT index scale', 'Uniform scale.'],
          ['STRETCHXEFFECT / STRETCHYEFFECT index scale', 'Axis-specific scale.'],
          ['ROTATEEFFECT index radians', 'Rotation is stored in radians in the file.'],
          ['COLOREFFECT index r g b a', 'Color channels are 0.0 to 1.0 floats.'],
          ['EFFECTMODE index mode', 'Stores the numeric render/effect mode.'],
          ['LOOP / CONTINUOUS / SETBACKTO name', 'Playback flags and fallback animation.'],
          ['SINGLEDIR or SINGLEDIRECTION', 'Animation has one direction row per frame instead of four.'],
          ['ANI ... ANIEND', 'Frame rows. Four-direction animations group every four rows into one frame.'],
          ['WAIT n', 'Adds n 50ms ticks to the previous frame.'],
          ['PLAYSOUND file x y', 'Sound event on the current frame, with tile-space offsets.'],
          ['SCRIPT ... SCRIPTEND', 'Optional script payload after ANIEND.']
        ]
      },
      {
        title: 'Frame pieces',
        code: 'spriteIndex xOffset yOffset\nspriteIndex xOffset yOffset,spriteIndex xOffset yOffset\n\n// Four-direction frame:\n up pieces\n left pieces\n down pieces\n right pieces',
        note: 'The level editor renderer groups raw rows in sets of four for up, left, down, and right. Single-direction ganis use one row per frame.'
      }
    ]
  }
];

function FileFormatsGuide() {
  const h = React.createElement;
  const [active, setActive] = React.useState('overview');
  const tab = fileFormatTabs.find(item => item.id === active) || fileFormatTabs[0];
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('format');
    if (requested && fileFormatTabs.some(item => item.id === requested)) setActive(requested);
  }, []);

  React.useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [active]);

  const renderSection = (section, index) => h('section', { className: 'formats-section', key: `${tab.id}-${index}` },
    h('h3', null, section.title),
    section.points && h('ul', { className: 'formats-points' }, section.points.map((point, i) => h('li', { key: i }, point))),
    section.rows && h('div', { className: 'formats-table' }, section.rows.map((row, i) => h('div', { className: 'formats-row', key: i },
      h('strong', null, row[0]),
      h('span', null, row[1])
    ))),
    section.code && h('pre', { className: 'formats-code' }, h('code', null, section.code)),
    section.note && h('p', { className: 'formats-note' }, section.note)
  );

  return h('main', { className: 'formats-guide' },
    h('header', { className: 'formats-hero' },
      h('div', null,
        h('p', { className: 'formats-lede' }, 'Notes for reading and writing .nw, .gmap, .zelda, .graal, and .gani level, map, and animation files.')
      )
    ),
    h('nav', { className: 'formats-tabs', 'aria-label': 'File format sections' },
      fileFormatTabs.map(item => h('button', {
        key: item.id,
        type: 'button',
        className: item.id === active ? 'active' : '',
        onClick: () => {
          setActive(item.id);
          const url = new URL(window.location.href);
          url.searchParams.set('formats', '');
          url.searchParams.set('format', item.id);
          window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString().replace('formats=', 'formats')}`);
        }
      }, h('i', { className: item.icon }), h('span', null, item.label)))
    ),
    h('article', { className: 'formats-panel', ref: panelRef },
      h('div', { className: 'formats-panel-head' },
        h('div', null,
          h('h2', null, tab.title),
          h('p', null, tab.lead)
        ),
        tab.chips && h('div', { className: 'formats-chips' }, tab.chips.map(chip => h('span', { key: chip }, chip)))
      ),
      tab.sections.map(renderSection)
    )
  );
}
