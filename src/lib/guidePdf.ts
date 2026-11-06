import type { BuildPack, PackBuild, PackItem } from './buildpack'

// Guide PDF in the look of the full guide: three sheets per character ("1 · Level und Build", "2 · Ausrüstung", "3 · Kampf und Offenes"),
// tab bar with working links, header card, gold-on-charcoal palette (screen) or a light print variant.
// The document definition is pure and testable; pdfmake and the fonts are loaded only when a file is created.
// pdfmake writes layout data into the nodes it is given, so every node is built fresh (never share an object between nodes).

type Node = Record<string, unknown>
export type PdfTheme = 'screen' | 'print'
export interface PdfOptions { theme?: PdfTheme }

const ACT_TITLE: Record<string, string> = {
  'Act 1': '6. Ausrüstung Akt 1 – Wildnis, Underdark, Grymforge',
  'Act 1.5': '7. Ausrüstung Akt 1.5 – Bergpass, Rosymorn, Crèche Y’llek',
  'Act 2': '8. Ausrüstung Akt 2 – Schattenverfluchte Lande, Moonrise Towers',
  'Act 3': '9. Ausrüstung Akt 3 und Endgame-Sets',
}
const SLOT_LABEL: Record<string, string> = {
  mainhand: 'Hauptwaffe', offhand: 'Nebenhand', head: 'Kopf', body: 'Körper', gloves: 'Handschuhe', boots: 'Schuhe', cloak: 'Umhang',
  amulet: 'Amulett', ring1: 'Ring 1', ring2: 'Ring 2', ranged: 'Fernkampf', quiver: 'Köcher',
}
const SECTION_TITLE: Record<string, string> = {
  '1': '1. Build-Übersicht', '2': '2. Attribute', '4': '4. Feat-Plan', '5': '5. Klassenmechaniken, Zauber und Metamagie', '10': '10. Kampfrotation und Strategie',
}
const SHEETS = ['Level und Build', 'Ausrüstung', 'Kampf und Offenes']

export interface Palette { bg: string | null; panel: string; head: string; thead: string; ink: string; muted: string; faint: string; accent: string; gold: string; line: string; tab: string; tabOn: string }
export const PALETTES: Record<PdfTheme, Palette> = {
  // screen: taken from the full guide (#ffa03c accent, #f2f2f2 text, #b07a1a gold, dark panels #1f1e1e / #211e1c / #141011)
  screen: { bg: '#1b1a19', panel: '#211e1c', head: '#2b2016', thead: '#141011', ink: '#f2f2f2', muted: '#b9b4ad', faint: '#9a958e', accent: '#ffa03c', gold: '#b07a1a', line: '#3a3633', tab: '#26211c', tabOn: '#3a2a14' },
  print: { bg: null, panel: '#f6f1e7', head: '#ede3cf', thead: '#e6dcc6', ink: '#1f1a14', muted: '#4f4940', faint: '#5c554b', accent: '#9a4a00', gold: '#8a6d1d', line: '#cfc7b6', tab: '#f6f1e7', tabOn: '#ede3cf' },
}

/** Glyphs the embedded fonts cannot draw (link arrows of the source, warning sign, private-use icon glyphs) are removed or replaced. */
export function pdfText(s: string): string {
  return s
    .replace(/(\d)\s*→\s*(\d)/g, '$1\ue000$2') // a real arrow between numbers («DEX +2 → 20») stays
    .replace(/→/g, '')
    .replace(/\ue000/g, ' → ')
    .replace(/⚠/g, '!')
    .replace(/[-]/g, '')
    .replace(/‐\s+(?=[a-zäöüß])/g, '')
    .replace(/‐/g, '-')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([;,.:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Joins the wrapped lines of a section into paragraphs (soft hyphens, full lines continue, short lines end a paragraph). */
export function paragraphs(lines: string[]): string[] {
  const out: string[] = []
  let cur = ''
  let prevLen = 0
  let prevSoft = false
  for (const raw of lines) {
    const l = pdfText(raw)
    if (!l || /^(Alle Haken|gramm Formulare|Haken werden nur)/.test(l) || /Level und Build.*Kampf und Offenes/.test(l) || /Blatt \d von 3$/.test(l)) continue
    if (cur && prevSoft) cur = cur.slice(0, -1) + l
    else if (cur && prevLen >= 68) cur += ' ' + l
    else {
      if (cur) out.push(cur)
      cur = l
    }
    prevLen = raw.trim().length
    prevSoft = /[‐]$/.test(raw.trim())
  }
  if (cur) out.push(cur)
  return out
}

export interface Block { kind: 'p' | 'field'; key?: string; text: string }
const FIELD_RE = /^([A-ZÄÖÜ]{3,}(?: [A-ZÄÖÜ-]{2,})*) · (.+)$/
/** Entry titles inside a field list: «Gesamtlevel 4 · Alert (Bonus)» or «Fire Eater (Harlequin 9)». */
const TITLE_RE = /^(Gesamtlevel \d|.{3,60} \([A-Za-zÄÖÜ][^)]{0,40}\)$)/

/** Like paragraphs(), but recognises «SCHLÜSSEL · Wert» field lines (WIRKUNG, ZAUBER, ZWECK, AKTION, RESSOURCE …) as their own blocks. */
export function blocks(lines: string[]): Block[] {
  const out: Block[] = []
  let cur: Block | null = null
  let prevLen = 0
  let prevSoft = false
  const flush = () => { if (cur && cur.text) out.push(cur); cur = null }
  for (const raw of lines) {
    const l = pdfText(raw)
    if (!l || /^(Alle Haken|gramm Formulare|Haken werden nur)/.test(l) || /Level und Build.*Kampf und Offenes/.test(l) || /Blatt \d von 3$/.test(l)) continue
    const m = FIELD_RE.exec(l)
    const title = TITLE_RE.test(l)
    if (m) { flush(); cur = { kind: 'field', key: m[1], text: m[2] } }
    else if (cur && prevSoft) cur.text = cur.text.slice(0, -1) + l
    else if (cur && !title && /[A-Za-zÄÖÜäöü]-$/.test(cur.text)) cur.text += l
    else if (cur && !title && (prevLen >= 68 || (cur.kind === 'field' && (/^[a-zäöüß(„"]/.test(l) || !/[.!?)]$/.test(cur.text))))) cur.text += ' ' + l
    else { flush(); cur = { kind: 'p', text: l } }
    prevLen = raw.trim().length
    prevSoft = /‐$/.test(raw.trim())
  }
  flush()
  return out
}

const FEAT_RE =/Feat:\s*.+?\((?:Bonus-Feat|Klassen-Feat)[^)]*\)/g
const monogram = (character: string) =>
  character.replace(/[^A-Za-zÄÖÜäöüé' ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

function build(pack: BuildPack, buildIds: string[], theme: PdfTheme): Record<string, unknown> {
  const P = PALETTES[theme]
  const screen = theme === 'screen'
  const builds = buildIds.map((id) => {
    const b = pack.builds.find((x) => x.id === id)
    if (!b) throw new Error(`Unknown build: ${id}`)
    return b
  })
  const sheetId = (b: PackBuild, n: number) => (n === 1 ? `build-${b.id}` : `build-${b.id}-s${n}`)

  // ---- small builders (each call returns fresh nodes) ----
  const txt = (text: string, o: Node = {}): Node => ({ text, ...o })
  const serif = (text: string, size: number, o: Node = {}): Node => ({ text, font: 'Alegreya', fontSize: size, color: P.ink, ...o })
  const box = (): Node => ({ canvas: [{ type: 'rect', x: 0, y: 1, w: 7.5, h: 7.5, r: 1.2, lineWidth: 0.9, lineColor: P.accent }], width: 9 })
  const bordered = (fill: string, border: string, pad: [number, number, number, number], width = 0.7) => ({
    hLineWidth: () => width, vLineWidth: () => width, hLineColor: () => border, vLineColor: () => border,
    paddingLeft: () => pad[0], paddingTop: () => pad[1], paddingRight: () => pad[2], paddingBottom: () => pad[3], fillColor: () => fill,
  })
  const panelHead = (title: string): Node => ({
    table: { widths: ['*'], body: [[serif(title, 11.5)]] }, layout: bordered(P.head, P.line, [10, 6, 10, 6]), margin: [0, 10, 0, 0],
  })
  const label = (t: string): Node => txt(t.toUpperCase(), { fontSize: 6.3, bold: true, color: P.faint, characterSpacing: 0.8, margin: [0, 7, 0, 2] })
  const linked = (name: string, url: string | null): Node[] =>
    url
      ? [txt(name, { link: url, bold: true, color: P.accent, decoration: 'underline', decorationColor: P.accent }), txt(' ↗', { color: P.accent, fontSize: 7, link: url })]
      : [txt(name, { bold: true, color: P.ink })]
  const bullets = (items: string[], size = 8.3): Node => ({ ul: items.map((i) => txt(i, { color: P.ink, fontSize: size })), markerColor: P.accent, margin: [4, 2, 0, 4] })
  const prose = (lines: string[], size = 8.4): Node[] => {
    const bl = blocks(lines)
    return bl.map((b, i) => {
      if (b.kind === 'field') {
        return { columns: [txt(b.key === 'WIRKUNG MIT FEATS OVERHAUL' ? 'WIRKUNG' : (b.key ?? ''), { width: 62, fontSize: 6.3, bold: true, color: P.faint, characterSpacing: 0.6, margin: [0, 1.6, 0, 0] }), txt(b.text, { width: '*', fontSize: size, color: P.ink, lineHeight: 1.25 })], columnGap: 6, margin: [8, 0, 0, 2.2] }
      }
      const caps = b.text.length < 44 && /[A-ZÄÖÜ]/.test(b.text) && b.text === b.text.toUpperCase()
      if (caps) return label(b.text)
      if (bl[i + 1]?.kind === 'field' && b.text.length < 80) return txt(b.text, { bold: true, fontSize: size + 0.6, color: P.ink, margin: [0, 7, 0, 2.5] })
      return txt(b.text, { fontSize: size, color: P.ink, lineHeight: 1.28, margin: [0, 0, 0, 3.5] })
    })
  }
  const section = (key: string, lines: string[] | undefined): Node[] => {
    const body = prose(lines ?? [])
    return body.length ? [panelHead(SECTION_TITLE[key]), { stack: body, margin: [2, 6, 2, 2] }] : []
  }

  const tabBar = (b: PackBuild, current: number): Node => ({
    columns: SHEETS.map((name, i) => ({
      table: {
        widths: ['*'],
        body: [[{ text: `${i + 1} · ${name}`, alignment: 'center', bold: true, fontSize: 7.6, color: P.accent, linkToDestination: sheetId(b, i + 1) }]],
      },
      layout: bordered(i + 1 === current ? P.tabOn : P.tab, i + 1 === current ? P.accent : P.gold, [4, 6, 4, 6], i + 1 === current ? 1.2 : 0.7),
    })),
    columnGap: 6, margin: [0, 8, 0, 8],
  })

  const header = (b: PackBuild, n: number): Node[] => {
    const meta = txt(`Gesamtlevel 20 · DIQ-Collection · Blatt ${n} von 3`, { fontSize: 6.8, color: P.faint, margin: [0, 7, 0, 0] })
    const first = (node: Node): Node => ({ ...node, id: sheetId(b, n), ...(builds[0] === b && n === 1 && builds.length === 1 ? {} : { pageBreak: 'before' }) })
    if (n === 1) {
      const badge: Node = {
        table: { widths: [42], heights: [42], body: [[txt(monogram(b.character), { font: 'Alegreya', fontSize: 19, color: P.accent, alignment: 'center', margin: [0, 7, 0, 0] })]] },
        layout: bordered(P.thead, P.gold, [0, 0, 0, 0], 1),
      }
      return [
        first({
          table: {
            widths: [42, '*'],
            body: [[badge, { stack: [serif(pdfText(`${b.character} – ${b.title}`), 17), txt(pdfText(b.subtitle), { fontSize: 8.2, color: P.muted, margin: [0, 3, 0, 0] })], margin: [4, 2, 0, 0] }]],
          },
          layout: bordered(P.panel, P.line, [8, 8, 8, 8], 0.8),
        }),
        meta,
        tabBar(b, 1),
      ]
    }
    return [first(serif(pdfText(`${b.character} – ${b.title}`), 13.5)), meta, tabBar(b, n)]
  }

  // ---- sheet 1: level and build ----
  const levelTable = (b: PackBuild): Node => {
    const th = (t: string): Node => txt(t, { bold: true, fontSize: 6.4, color: P.ink, characterSpacing: 0.6, margin: [0, 1, 0, 1] })
    const body: Node[][] = [[th('LV'), th('KLASSE (LEVEL)'), th('AUSWAHL')]]
    for (const l of b.levels) {
      const main = pdfText(l.text.replace(FEAT_RE, ' '))
      const featLines = l.feats.map((f): Node => ({
        text: [
          txt('Feat: ', { bold: true, color: P.ink }),
          txt(pdfText(f.name), { bold: true, color: P.accent }),
          txt(` (${f.kind === 'bonus' ? 'Bonus-Feat' : 'Klassen-Feat'}${f.sourceClass ? `, ${pdfText(f.sourceClass)}` : ''})`, { color: P.muted }),
        ],
        fontSize: 8.2, margin: [0, 1.5, 0, 0],
      }))
      body.push([
        txt(String(l.totalLevel), { color: P.muted, fontSize: 8.4 }),
        txt(`${l.cls} ${l.classLevel}`, { bold: true, color: P.ink, fontSize: 8.4 }),
        { stack: [...(main ? [txt(main, { fontSize: 8.2, color: P.ink, lineHeight: 1.25 })] : []), ...featLines] },
      ])
    }
    return {
      table: { headerRows: 1, widths: [17, 54, '*'], body, dontBreakRows: true },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0.7 : 0.5),
        vLineWidth: (i: number, node: { table: { widths: unknown[] } }) => (i === 0 || i === node.table.widths.length ? 0.7 : 0),
        hLineColor: () => P.line, vLineColor: () => P.line, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4.2, paddingBottom: () => 4.2,
        fillColor: (r: number) => (r === 0 ? P.thead : P.panel),
      },
    }
  }
  // ---- attribute tables (base values + growth per level) ----
  const attrTable = (b: PackBuild): Node[] => {
    const at = b.attributes
    const th = (t: string, align = 'center'): Node => txt(pdfText(t), { bold: true, fontSize: 6.4, color: P.ink, characterSpacing: 0.7, alignment: align, margin: [0, 1, 0, 1] })
    const layout = () => ({
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0.7 : 0.4),
      vLineWidth: (i: number, node: { table: { widths: unknown[] } }) => (i === 0 || i === node.table.widths.length ? 0.7 : 0),
      hLineColor: () => P.line, vLineColor: () => P.line, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 3.4, paddingBottom: () => 3.4,
      fillColor: (r: number) => (r === 0 ? P.thead : r % 2 === 0 ? P.tab : P.panel),
    })
    const out: Node[] = []
    const cols = at.base.columns.slice(1)
    const numeric = (v: string) => /^[+–−-]?\d*[–−-]?\d*$/.test(v.trim()) && v.trim() !== ''
    out.push({
      table: {
        headerRows: 1, widths: [44, ...cols.map((_, i) => (i === cols.length - 1 && cols.length > 3 ? '*' : '*'))], dontBreakRows: true,
        body: [
          [th(at.base.columns[0], 'left'), ...cols.map((c) => th(c))],
          ...at.base.rows.map((r): Node[] => [
            txt(r.stat, { bold: true, fontSize: 8.6, color: P.ink, characterSpacing: 0.6 }),
            ...cols.map((c, i): Node => {
              const v = pdfText(r.cells[c] ?? '')
              const start = /START|ZIELWERT/.test(c.toUpperCase())
              return txt(v, { alignment: numeric(v) ? 'center' : 'left', fontSize: 8.6, bold: start && i < 4, color: start ? P.accent : /^[+]/.test(v) ? P.ink : P.muted })
            }),
          ]),
        ],
      },
      layout: layout(), margin: [0, 2, 0, 0],
    })
    if (at.progress) {
      const pr = at.progress
      const prev: Record<string, number | null> = {}
      const body: Node[][] = [[th('LV'), th('QUELLE', 'left'), ...pr.columns.map((c) => th(c))]]
      for (const r of pr.rows) {
        body.push([
          txt(String(r.lv), { alignment: 'center', color: P.muted, fontSize: 8.4 }),
          txt(pdfText(r.source), { fontSize: 8.2, color: P.ink, lineHeight: 1.2 }),
          ...pr.columns.map((c): Node => {
            const v = r.values[c]
            const changed = v !== null && prev[c] !== undefined && prev[c] !== v
            prev[c] = v
            return {
              text: v === null ? '' : String(v), alignment: 'center', fontSize: 8.6, bold: changed || r.lv === 1, color: changed ? P.accent : P.ink,
              ...(changed ? { fillColor: P.tabOn } : {}),
            }
          }),
        ])
      }
      out.push(label('Verlauf: nur Level mit Änderung · orange = Wert steigt'))
      out.push({ table: { headerRows: 1, widths: [22, '*', ...pr.columns.map(() => 30)], body, dontBreakRows: true }, layout: layout() })
    }
    return out
  }
  const attrSection = (b: PackBuild): Node[] => {
    const at = b.attributes
    return [
      panelHead(SECTION_TITLE['2']),
      { stack: [...prose(at.intro), ...attrTable(b), { stack: prose(at.note), margin: [0, 8, 0, 0] }], margin: [2, 6, 2, 2] },
    ]
  }
  const sheet1 = (b: PackBuild): Node[] => [
    ...header(b, 1),
    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            serif('Levelverlauf auf einen Blick', 11.5),
            txt('Lv = Gesamtlevel (1–20); die Klasse zeigt, welche Klasse du dort steigerst, mit ihrem Klassenlevel. Alle Entscheidungen pro Level: Zauber, Subklasse und Feats.', { fontSize: 8, color: P.muted, margin: [0, 3, 0, 0], lineHeight: 1.25 }),
          ],
        }]],
      },
      layout: bordered(P.head, P.line, [10, 7, 10, 7]),
    },
    levelTable(b),
    ...section('1', b.sections['1']), ...attrSection(b), ...section('4', b.sections['4']), ...section('5', b.sections['5']),
  ]

  // ---- sheet 2: gear ----
  const optionRow = (rank: number, item: PackItem | undefined, notes: string[], inherited: boolean): Node => {
    const note = pdfText(notes.join(' '))
    const name: Node[] = item ? linked(pdfText(item.name), item.found.base[0]?.wiki ?? null) : [txt('–', { color: P.faint })]
    return {
      columns: [
        txt(String(rank), { width: 11, bold: true, color: rank === 1 ? P.accent : P.faint, fontSize: 8.6 }),
        item ? box() : { text: '', width: 9 },
        { width: '*', stack: [{ text: name.map((n) => (inherited ? { ...n, italics: true } : n)), fontSize: 8.8 }, ...(note ? [txt(note, { fontSize: 7.2, color: P.muted, lineHeight: 1.2, margin: [0, 1, 0, 0] })] : [])] },
      ],
      columnGap: 5, margin: [0, 1.8, 0, 1.8],
    }
  }
  const gearAct = (b: PackBuild, act: string): Node[] => {
    const g = b.gear[act as keyof typeof b.gear]
    if (!g || g.slots.length === 0) return []
    const out: Node[] = [panelHead(ACT_TITLE[act] ?? act)]
    const intro = paragraphs(g.notes.filter((n) => !/Haken|PDF-?Pro|Formulare|gramm Formulare/.test(n)))
    for (const p of intro) out.push(txt(p, { fontSize: 7.4, color: P.muted, lineHeight: 1.25, margin: [2, 5, 2, 0] }))
    for (const s of g.slots) {
      const rows: Node[] = []
      for (let rank = 1; rank <= 3; rank++) {
        const o = s.options.find((x) => x.rank === rank)
        if (o) rows.push(optionRow(rank, pack.items[o.itemId], o.notes, Boolean(o.inherited)))
        else if (s.guideStatesOnly !== undefined && rank > s.guideStatesOnly) rows.push(txt(`${rank}   im Guide nicht genannt`, { fontSize: 7.2, italics: true, color: P.faint, margin: [0, 1.8, 0, 1.8] }))
      }
      out.push({ unbreakable: true, stack: [label(SLOT_LABEL[s.slot] ?? s.label), ...rows], margin: [4, 0, 0, 0] })
    }
    return out
  }
  const endgame = (b: PackBuild): Node[] => {
    const sets = Object.entries(b.endgameSets)
    if (!sets.length) return []
    const out: Node[] = [panelHead('Endgame-Sets')]
    for (const [name, slots] of sets) {
      out.push({
        unbreakable: true, margin: [0, 6, 0, 0],
        table: {
          widths: ['*'],
          body: [
            [serif(pdfText(name), 10, { color: P.accent })],
            [{
              stack: Object.entries(slots).map(([k, v]) => ({
                columns: [txt(pdfText(k), { width: 78, fontSize: 7.4, color: P.muted }), txt(pdfText(Array.isArray(v) ? v.join(', ') : v), { fontSize: 8, color: P.ink, width: '*' })],
                margin: [0, 1.4, 0, 1.4],
              })),
            }],
          ],
        },
        layout: { ...bordered(P.panel, P.line, [9, 5, 9, 5]), hLineWidth: (i: number) => (i === 1 ? 0.4 : 0.7) },
      })
    }
    return out
  }
  const sheet2 = (b: PackBuild): Node[] => [
    ...header(b, 2),
    txt('Option 1 ist die Empfehlung; Haken = besorgt bzw. erledigt. Orange Namen mit ↗ führen zu bg3.wiki.', { fontSize: 7.4, color: P.muted }),
    ...pack.acts.flatMap((a) => gearAct(b, a)),
    ...endgame(b),
  ]

  // ---- sheet 3: combat and open points ----
  const warn = (): Node => ({ canvas: [{ type: 'polyline', closePath: true, lineWidth: 1, lineColor: P.accent, points: [{ x: 5.5, y: 0.5 }, { x: 10.5, y: 9.5 }, { x: 0.5, y: 9.5 }] }], width: 12 })
  const sheet3 = (b: PackBuild): Node[] => {
    const out: Node[] = [...header(b, 3), ...section('10', b.sections['10'])]
    if (b.missables.length) {
      out.push(panelHead('Verpassbare Teile'))
      out.push(txt('Nur unter der genannten Bedingung oder bis zum genannten Akt erhältlich; danach kann es dauerhaft fehlen.', { fontSize: 7.4, color: P.muted, margin: [2, 4, 2, 4] }))
      out.push({
        table: {
          widths: ['*', 26], dontBreakRows: true,
          body: b.missables.map((m): Node[] => [
            { stack: [txt(pdfText(m.items ?? ''), { bold: true, color: P.accent, fontSize: 8.4 }), txt(pdfText(m.bedingung), { fontSize: 7.8, color: P.ink, lineHeight: 1.22, margin: [0, 1, 0, 0] })] },
            txt(m.akt ?? '', { bold: true, color: P.muted, fontSize: 8, alignment: 'right' }),
          ]),
        },
        layout: {
          hLineWidth: (i: number, n: { table: { body: unknown[] } }) => (i === 0 || i === n.table.body.length ? 0 : 0.5),
          vLineWidth: () => 0, hLineColor: () => P.line, paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 4, paddingBottom: () => 4,
        },
      })
    }
    if (b.openPoints.length) {
      out.push({ columns: [warn(), serif('Noch im Spiel zu prüfen', 11.5, { width: '*' })], columnGap: 6, margin: [0, 12, 0, 3] })
      out.push(bullets(paragraphs(b.openPoints)))
    }
    const s11 = b.sections['11'] ?? []
    const qi = s11.findIndex((l) => /^Quellen/.test(l))
    if (qi >= 0) {
      out.push(label('Quellen'))
      out.push(...prose(s11.slice(qi + 1), 7.4))
    }
    return out
  }

  // ---- cover for several guides ----
  const cover = (): Node[] => [
    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            serif('BG3 DIQ R150 – Build-Guides', 20, { color: P.accent }),
            txt(`Gesamtlevel 20 · Party mit vier Charakteren · Stand ${pack.meta.dataDate} · Paket ${pack.packHash.slice(0, 8)}`, { fontSize: 7.4, color: P.muted, margin: [0, 4, 0, 0] }),
          ],
        }]],
      },
      layout: bordered(P.panel, P.line, [12, 12, 12, 12], 0.8),
    },
    panelHead('Inhalt'),
    {
      table: {
        widths: ['*'],
        body: builds.map((b): Node[] => [{
          columns: [
            {
              width: 26,
              table: { widths: [26], heights: [26], body: [[txt(monogram(b.character), { font: 'Alegreya', fontSize: 11.5, color: P.accent, alignment: 'center', margin: [0, 5, 0, 0] })]] },
              layout: bordered(P.thead, P.gold, [0, 0, 0, 0], 0.8),
            },
            {
              width: '*',
              stack: [
                txt(pdfText(`${b.character} – ${b.title}`), { bold: true, color: P.accent, fontSize: 9.4, linkToDestination: sheetId(b, 1) }),
                txt(pdfText(b.subtitle), { fontSize: 7.4, color: P.muted, margin: [0, 1.5, 0, 0] }),
              ],
            },
          ],
          columnGap: 8,
        }]),
      },
      layout: {
        hLineWidth: (i: number, n: { table: { body: unknown[] } }) => (i === 0 || i === n.table.body.length ? 0 : 0.5),
        vLineWidth: () => 0, hLineColor: () => P.line, paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 6, paddingBottom: () => 6,
      },
    },
    label('So liest du die Guides'),
    txt('Jeder Guide besteht aus drei Blättern, zwischen denen du oben umschaltest: 1 Level und Build, 2 Ausrüstung, 3 Kampf und Offenes. Option 1 jeder Ausrüstungsangabe ist die Empfehlung; Haken = besorgt. Orange Namen mit ↗ führen zu bg3.wiki. Zeilen mit «im Guide nicht genannt» sind Lücken der Quelle, keine Fehler.', { fontSize: 8, color: P.ink, lineHeight: 1.3 }),
  ]

  const content: Node[] = []
  if (builds.length > 1) content.push(...cover())
  for (const b of builds) content.push(...sheet1(b), ...sheet2(b), ...sheet3(b))

  return {
    info: { title: builds.length === 1 ? `${builds[0].character} – ${builds[0].title}` : 'BG3 DIQ R150 – Build-Guides', author: 'BG3 DIQ Checkliste', subject: `Paket ${pack.packHash.slice(0, 16)}` },
    pageSize: screen ? { width: 482, height: 857 } : 'A4',
    pageMargins: screen ? [18, 16, 18, 30] : [34, 36, 34, 40],
    defaultStyle: { font: 'AlegreyaSans', fontSize: 8.6, color: P.ink, lineHeight: 1.2 },
    ...(P.bg ? { background: (_page: number, s: { width: number; height: number }): Node => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: s.width, h: s.height, color: P.bg }] }) } : {}),
    footer: (page: number, pages: number): Node => ({ text: `BG3 DIQ R150 · Paket ${pack.packHash.slice(0, 8)} · Seite ${page} / ${pages}`, alignment: 'center', fontSize: 6.4, color: P.faint, margin: [0, 12, 0, 0] }),
    content,
  }
}

export function guideDocument(pack: BuildPack, buildIds: string[], options: PdfOptions = {}): Record<string, unknown> {
  return build(pack, buildIds, options.theme ?? 'screen')
}

export function guideFileName(pack: BuildPack, buildIds: string[], options: PdfOptions = {}): string {
  const day = pack.meta.dataDate
  const suffix = (options.theme ?? 'screen') === 'print' ? '-druck' : ''
  if (buildIds.length === 1) return `BG3-DIQ-Guide-${buildIds[0]}-${day}${suffix}.pdf`
  return buildIds.length === pack.builds.length ? `BG3-DIQ-Guides-alle-${day}${suffix}.pdf` : `BG3-DIQ-Guides-${buildIds.join('+')}-${day}${suffix}.pdf`
}

// Fonts (SIL OFL, see src/assets/fonts): the BG3 UI uses Quadraat (commercial, typeby.com, cannot be embedded without a licence),
// with Alegreya (headings) and Alegreya Sans (body) as its documented secondary/tertiary faces. Loaded on demand; cached offline by the service worker.
const FONT_FILES = {
  AlegreyaSans: { normal: 'AlegreyaSans_400Regular.ttf', bold: 'AlegreyaSans_700Bold.ttf', italics: 'AlegreyaSans_400Regular_Italic.ttf', bolditalics: 'AlegreyaSans_700Bold_Italic.ttf' },
  Alegreya: { normal: 'Alegreya_400Regular.ttf', bold: 'Alegreya_700Bold.ttf', italics: 'Alegreya_400Regular_Italic.ttf', bolditalics: 'Alegreya_700Bold_Italic.ttf' },
}
export const FONT_URLS: Record<string, URL> = {
  'AlegreyaSans_400Regular.ttf': new URL('../assets/fonts/AlegreyaSans_400Regular.ttf', import.meta.url),
  'AlegreyaSans_700Bold.ttf': new URL('../assets/fonts/AlegreyaSans_700Bold.ttf', import.meta.url),
  'AlegreyaSans_400Regular_Italic.ttf': new URL('../assets/fonts/AlegreyaSans_400Regular_Italic.ttf', import.meta.url),
  'AlegreyaSans_700Bold_Italic.ttf': new URL('../assets/fonts/AlegreyaSans_700Bold_Italic.ttf', import.meta.url),
  'Alegreya_400Regular.ttf': new URL('../assets/fonts/Alegreya_400Regular.ttf', import.meta.url),
  'Alegreya_700Bold.ttf': new URL('../assets/fonts/Alegreya_700Bold.ttf', import.meta.url),
  'Alegreya_400Regular_Italic.ttf': new URL('../assets/fonts/Alegreya_400Regular_Italic.ttf', import.meta.url),
  'Alegreya_700Bold_Italic.ttf': new URL('../assets/fonts/Alegreya_700Bold_Italic.ttf', import.meta.url),
}
export type FontLoader = (url: URL) => Promise<ArrayBuffer>
const fetchFont: FontLoader = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font could not be loaded (${res.status})`)
  return res.arrayBuffer()
}
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Generates the PDF. pdfmake and the fonts (about 1.4 MB) are loaded only when this is called. */
export async function createGuidePdf(pack: BuildPack, buildIds: string[], options: PdfOptions = {}, loadFont: FontLoader = fetchFont): Promise<Blob> {
  const { default: pdfMake } = await import('pdfmake/build/pdfmake')
  const vfs: Record<string, string> = {}
  await Promise.all(Object.entries(FONT_URLS).map(async ([name, url]) => { vfs[name] = toBase64(await loadFont(url)) }))
  pdfMake.addVirtualFileSystem(vfs)
  pdfMake.addFonts(FONT_FILES)
  return pdfMake.createPdf(guideDocument(pack, buildIds, options)).getBlob()
}

/** Saves via the browser's download. The returned blob URL stays valid until the caller revokes it (so the PDF can also be opened in a tab). */
export async function saveGuidePdf(pack: BuildPack, buildIds: string[], options: PdfOptions = {}): Promise<{ name: string; bytes: number; url: string }> {
  const blob = await createGuidePdf(pack, buildIds, options)
  const name = guideFileName(pack, buildIds, options)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  return { name, bytes: blob.size, url }
}
