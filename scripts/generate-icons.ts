/**
 * Draws the application icon and the Markdown file icon in every colour
 * variant of packages/desktop/src/common/appIcon.ts and writes every file the
 * packager and the running app read. Run it after changing the artwork or the
 * variants, and commit what it writes:
 *
 *   pnpm run generate-icons
 *
 * Both icons are drawn as SVG and rasterised with sharp. From 40 px up the art
 * is one vector drawing on a 256-unit canvas. Below that, every size has its
 * own drawing on the pixel grid (and the smallest are pixel art), because a
 * scaled-down vector blurs its strokes across pixel boundaries.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  APP_ICON_VARIANTS,
  DEFAULT_APP_ICON,
  appIconFileName,
  macDockIconFileName,
  markdownIconFileName,
  type AppIconId
} from '../packages/desktop/src/common/appIcon'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/desktop')

// ---------------------------------------------------------------- colour

interface Hsl {
  h: number
  s: number
  l: number
}

const hexToHsl = (hex: string): Hsl => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
    number,
    number,
    number
  ]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}

const hslToHex = ({ h, s, l }: Hsl): string => {
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const value = Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
    return value.toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

// `dl` in lightness fractions, `dh` in degrees.
const shade = (hex: string, dl: number, dh = 0): string => {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex({ h: (h + dh + 360) % 360, s, l: Math.max(0, Math.min(1, l + dl)) })
}

interface Palette {
  top: string
  bottom: string
  /** The accent drawn on white: the file icon's heading line. */
  ink: string
  /** Shadow under the white glyph, which keeps its edge on the lightest blues. */
  glyphShadow: string
}

// The hue drifts a little towards blue as the gradient darkens, the way a
// lit surface does; a pure lightness ramp looks flat.
const paletteFor = (color: string): Palette => ({
  top: shade(color, 0.07, -2),
  bottom: shade(color, -0.13, 4),
  ink: shade(color, -0.08, 2),
  glyphShadow: shade(color, -0.32, 6)
})

// ---------------------------------------------------------------- drawing

const PAGE_BORDER = '#b4bac3'
const PAGE_FOLD = '#e3e7ec'
const PAGE_TEXT = '#c3c8cf'
const PAGE_TEXT_LARGE = '#cdd2d9'

/**
 * The glyph: an M whose right stem carries on down into an arrow, merging the
 * M and the arrow of the Markdown mark. Coordinates are in the drawing's own
 * units; `vy` is the bottom of the M's V and `wing` the arrowhead's reach.
 */
interface GlyphGeometry {
  l: number
  r: number
  top: number
  vy: number
  lb: number
  tip: number
  wing: number
  sw: number
}

const glyph = (g: GlyphGeometry, attributes = ''): string =>
  `<path d="M${g.l} ${g.lb} V${g.top} L${(g.l + g.r) / 2} ${g.vy} L${g.r} ${g.top} V${g.tip} ` +
  `M${g.r - g.wing} ${g.tip - g.wing} L${g.r} ${g.tip} L${g.r + g.wing} ${g.tip - g.wing}" ` +
  `fill="none" stroke="#fff" stroke-width="${g.sw}" stroke-linecap="round" stroke-linejoin="round" ${attributes}/>`

/** Centred on (128, 128) of the 256-unit canvas. */
const GLYPH_256: GlyphGeometry = { l: 61, r: 169, top: 77, vy: 123, lb: 165, tip: 179, wing: 26, sw: 26 }

// One row per pixel row, `X` for a white pixel.
type PixelArt = readonly string[]

const pixels = (art: PixelArt, x0: number, y0: number): string =>
  art
    .flatMap((row, y) =>
      [...row].map((cell, x) =>
        cell === 'X' ? `<rect x="${x0 + x}" y="${y0 + y}" width="1" height="1" fill="#fff"/>` : ''
      )
    )
    .join('')

const svg = (px: number, viewBox: number, defs: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${viewBox} ${viewBox}">` +
  `<defs>${defs}</defs>${body}</svg>`

const gradient = (p: Palette): string =>
  '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
  `<stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/></linearGradient>`

const dropShadow = (blur: number, dy: number, opacity: number): string =>
  '<filter id="sh" x="-20%" y="-20%" width="140%" height="140%">' +
  `<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/><feOffset dy="${dy}"/>` +
  `<feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>` +
  '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'

const glyphShadow = (blur: number, dy: number, color: string, opacity: number): string =>
  '<filter id="gs" x="-20%" y="-20%" width="140%" height="140%">' +
  `<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/><feOffset dy="${dy}"/>` +
  `<feFlood flood-color="${color}" flood-opacity="${opacity}"/>` +
  '<feComposite operator="in" in2="SourceAlpha"/><feComposite operator="in"/>' +
  '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'

// ---------------------------------------------------------------- app icon

// Only pixel art keeps the V and the arrowhead apart in 16 pixels.
const GLYPH_16: PixelArt = [
  'XX.....XX..',
  'XXXX.XXXX..',
  'XX.XXX.XX..',
  'XX..X..XX..',
  'XX.....XX..',
  'XX.....XX..',
  'XX...XXXXXX',
  'XX....XXXX.',
  '.......XX..'
]

// In pixels. `tile` is [x, y, size, corner radius]; even stroke widths sit on
// whole-pixel centres and odd ones on half-pixel centres, so stems stay sharp.
const APP_SMALL: Record<number, { tile: [number, number, number, number]; glyph: GlyphGeometry | [number, number] }> = {
  16: { tile: [0, 0, 16, 3.5], glyph: [2, 3] },
  20: { tile: [1, 1, 18, 4], glyph: { l: 5, r: 12, top: 5, vy: 8.5, lb: 15, tip: 16, wing: 3.5, sw: 2 } },
  24: { tile: [1, 1, 22, 5], glyph: { l: 6, r: 14, top: 6, vy: 10, lb: 17, tip: 18, wing: 3.5, sw: 2 } },
  32: { tile: [1, 1, 30, 7], glyph: { l: 7.5, r: 19.5, top: 8, vy: 14.5, lb: 22.5, tip: 24.5, wing: 4.5, sw: 3 } }
}

/**
 * `mac` follows Apple's icon grid (a tile of 824 on a 1024 canvas) and never
 * uses the pixel drawings, which macOS would only ever show scaled.
 */
const appIcon = (id: AppIconId, px: number, mac = false): string => {
  const p = paletteFor(variantColor(id))
  const small = mac ? undefined : APP_SMALL[px]
  if (small) {
    const [x, y, size, rx] = small.tile
    const art = Array.isArray(small.glyph)
      ? pixels(GLYPH_16, small.glyph[0], small.glyph[1])
      : glyph(small.glyph)
    return svg(px, px, gradient(p), `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>${art}`)
  }
  // The tile sits a little above centre to leave room for its shadow.
  const pad = mac ? 25 : 16
  const top = mac ? 22 : 12
  const size = 256 - pad * 2
  const rx = mac ? 46 : 54
  const scale = size / 224
  return svg(
    px,
    256,
    gradient(p) + dropShadow(px >= 128 ? 5 : 3, px >= 128 ? 4 : 3, 0.3) + glyphShadow(4, 4, p.glyphShadow, 0.35),
    `<rect x="${pad}" y="${top}" width="${size}" height="${size}" rx="${rx}" fill="url(#bg)" filter="url(#sh)"/>` +
      // A faint inner rim, which keeps the tile's edge on a background of a
      // similar blue.
      `<rect x="${pad + 1.5}" y="${top + 1.5}" width="${size - 3}" height="${size - 3}" rx="${rx - 1.5}" ` +
      'fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>' +
      `<g transform="translate(128 ${top + size / 2 + 1}) scale(${scale}) translate(-128 -128)">` +
      `${glyph(GLYPH_256, 'filter="url(#gs)"')}</g>`
  )
}

// ---------------------------------------------------------------- .md icon

// Page outline with a folded top-right corner.
const pagePath = (x0: number, y0: number, x1: number, y1: number, fold: number, r: number): string =>
  `M${x0 + r} ${y0} H${x1 - fold} L${x1} ${y0 + fold} V${y1 - r} Q${x1} ${y1} ${x1 - r} ${y1} ` +
  `H${x0 + r} Q${x0} ${y1} ${x0} ${y1 - r} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} Z`

const foldPath = (x1: number, y0: number, fold: number, r: number): string =>
  `M${x1 - fold} ${y0} V${y0 + fold - r} Q${x1 - fold} ${y0 + fold} ${x1 - fold + r} ${y0 + fold} H${x1}`

// Below 40 px the file icon shows the plain Markdown mark, M and arrow apart:
// on a badge a third of the icon's height, the merged glyph turns to a blob.
const MARK_5: PixelArt = ['XX.XX....X..', 'X.X.X....X..', 'X...X..XXXXX', 'X...X...XXX.', 'X...X....X..']
const MARK_6: PixelArt = [
  'XX...XX....X..',
  'X.X.X.X....X..',
  'X..X..X....X..',
  'X.....X..XXXXX',
  'X.....X...XXX.',
  'X.....X....X..'
]
const MARK_7: PixelArt = [
  'XX...XX.....X...',
  'X.X.X.X.....X...',
  'X..X..X.....X...',
  'X.....X..XXXXXXX',
  'X.....X...XXXXX.',
  'X.....X....XXX..',
  'X.....X.....X...'
]
const MARK_9: PixelArt = [
  'XX......XX.....XX...',
  'XXX....XXX.....XX...',
  'XXXX..XXXX.....XX...',
  'XX.XXXX.XX.....XX...',
  'XX..XX..XX.....XX...',
  'XX......XX..XXXXXXXX',
  'XX......XX...XXXXXX.',
  'XX......XX....XXXX..',
  'XX......XX.....XX...'
]

interface SmallPage {
  /** [x0, y0, x1, y1, fold, corner radius], on half-pixel centres for the 1 px border. */
  page: [number, number, number, number, number, number]
  /** [x, y, width, height, corner radius]; wider than the page, like a label. */
  badge: [number, number, number, number, number]
  mark: PixelArt
  /** Text lines as [x, y, width]; the first is the heading. */
  lines: [number, number, number][]
}

const MD_SMALL: Record<number, SmallPage> = {
  16: { page: [2.5, 0.5, 13.5, 15.5, 4, 1], badge: [1, 7, 14, 9, 1.5], mark: MARK_5, lines: [[4, 3, 4]] },
  20: { page: [3.5, 0.5, 16.5, 19.5, 5, 1], badge: [2, 9, 16, 11, 2], mark: MARK_6, lines: [[5, 3, 5], [5, 5, 7]] },
  24: {
    page: [4.5, 0.5, 19.5, 23.5, 6, 1.5],
    badge: [2, 11, 20, 12, 2],
    mark: MARK_7,
    lines: [[6, 3, 6], [6, 6, 9], [6, 8, 7]]
  },
  32: {
    page: [4.5, 0.5, 27.5, 31.5, 8, 2],
    badge: [3, 15, 26, 15, 3],
    mark: MARK_9,
    lines: [[7, 4, 8], [7, 8, 14], [7, 11, 11]]
  }
}

const markdownIcon = (id: AppIconId, px: number): string => {
  const p = paletteFor(variantColor(id))
  const small = MD_SMALL[px]
  if (small) {
    const [x0, y0, x1, y1, fold, r] = small.page
    const [bx, by, bw, bh, brx] = small.badge
    const lines = small.lines
      .map(([x, y, w], i) => {
        const heading = i === 0
        return `<rect x="${x}" y="${y}" width="${w}" height="${heading && px >= 24 ? 2 : 1}" fill="${heading ? p.ink : PAGE_TEXT}"/>`
      })
      .join('')
    const markX = bx + Math.floor((bw - small.mark[0]!.length) / 2)
    const markY = by + Math.floor((bh - small.mark.length) / 2)
    return svg(
      px,
      px,
      gradient(p),
      `<path d="${pagePath(x0, y0, x1, y1, fold, r)}" fill="#fff" stroke="${PAGE_BORDER}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="${foldPath(x1, y0, fold, r)}" fill="${PAGE_FOLD}" stroke="${PAGE_BORDER}" stroke-width="1" stroke-linejoin="round"/>` +
        lines +
        `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${brx}" fill="url(#bg)"/>` +
        pixels(small.mark, markX, markY)
    )
  }
  const [x0, y0, x1, y1, fold, r] = [44, 10, 212, 246, 58, 14]
  // A 4-unit border is under a pixel wide at 48 px.
  const border = px <= 48 ? 6 : 4
  const [bw, bh] = [148, 100]
  const bx = 128 - bw / 2
  const by = y1 - bh - 22
  return svg(
    px,
    256,
    gradient(p) + dropShadow(px >= 128 ? 4 : 2.5, px >= 128 ? 3 : 2, 0.22) + glyphShadow(3, 3, p.glyphShadow, 0.3),
    `<path d="${pagePath(x0, y0, x1, y1, fold, r)}" fill="#fff" stroke="${PAGE_BORDER}" stroke-width="${border}" stroke-linejoin="round" filter="url(#sh)"/>` +
      `<path d="${foldPath(x1, y0, fold, r)}" fill="${PAGE_FOLD}" stroke="${PAGE_BORDER}" stroke-width="${border}" stroke-linejoin="round"/>` +
      `<rect x="${x0 + 26}" y="${y0 + 34}" width="62" height="13" rx="6.5" fill="${p.ink}"/>` +
      `<rect x="${x0 + 26}" y="${y0 + 64}" width="112" height="9" rx="4.5" fill="${PAGE_TEXT_LARGE}"/>` +
      `<rect x="${x0 + 26}" y="${y0 + 84}" width="88" height="9" rx="4.5" fill="${PAGE_TEXT_LARGE}"/>` +
      `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="20" fill="url(#bg)"/>` +
      `<g transform="translate(128 ${by + bh / 2 + 2}) scale(0.56) translate(-128 -128)">` +
      `${glyph({ ...GLYPH_256, sw: px <= 48 ? 32 : 28 }, 'filter="url(#gs)"')}</g>`
  )
}

const variantColor = (id: AppIconId): string => APP_ICON_VARIANTS.find((v) => v.id === id)!.color

// ---------------------------------------------------------------- containers

const rasterize = (svgSource: string): Promise<Buffer> => sharp(Buffer.from(svgSource)).png().toBuffer()

// Every size Explorer, the taskbar and the shell ask for at 100–200 % scaling.
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
// Up to here entries are stored as bitmaps rather than PNG, which some
// consumers of small icons (resource editors, older shell code) still expect.
const ICO_BITMAP_MAX = 48

/** A 32-bit DIB with its AND mask, as an ICO entry stores it. */
const icoBitmap = async(png: Buffer): Promise<Buffer> => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(width, 4)
  // The height counts the XOR bitmap and the AND mask together.
  header.writeInt32LE(height * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const pixelsBuf = Buffer.alloc(width * height * 4)
  const maskStride = Math.ceil(width / 32) * 4
  const mask = Buffer.alloc(maskStride * height)
  for (let y = 0; y < height; y++) {
    // Bottom-up rows, BGRA.
    const row = height - 1 - y
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = (row * width + x) * 4
      pixelsBuf[dst] = data[src + 2]!
      pixelsBuf[dst + 1] = data[src + 1]!
      pixelsBuf[dst + 2] = data[src]!
      pixelsBuf[dst + 3] = data[src + 3]!
      if (data[src + 3] === 0) {
        const byte = row * maskStride + (x >> 3)
        mask[byte] = mask[byte]! | (0x80 >> (x & 7))
      }
    }
  }
  header.writeUInt32LE(pixelsBuf.length + mask.length, 20)
  return Buffer.concat([header, pixelsBuf, mask])
}

const buildIco = async(draw: (px: number) => string): Promise<Buffer> => {
  const images: Buffer[] = []
  for (const px of ICO_SIZES) {
    const png = await rasterize(draw(px))
    images.push(px <= ICO_BITMAP_MAX ? await icoBitmap(png) : png)
  }
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach((image, i) => {
    const px = ICO_SIZES[i]!
    const entry = 6 + 16 * i
    // 0 stands for 256.
    header.writeUInt8(px >= 256 ? 0 : px, entry)
    header.writeUInt8(px >= 256 ? 0 : px, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })
  return Buffer.concat([header, ...images])
}

// OSType and pixel size of each PNG entry; the @2x types reuse a larger render.
const ICNS_ENTRIES: [string, number][] = [
  ['icp4', 16],
  ['icp5', 32],
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic13', 256],
  ['ic08', 256],
  ['ic14', 512],
  ['ic09', 512],
  ['ic10', 1024]
]

const buildIcns = async(draw: (px: number) => string): Promise<Buffer> => {
  const chunks: Buffer[] = []
  for (const [type, px] of ICNS_ENTRIES) {
    const png = await rasterize(draw(px))
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    chunks.push(head, png)
  }
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

// ---------------------------------------------------------------- output

const write = (relativePath: string, data: Buffer | string): void => {
  const target = path.join(desktopRoot, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, data)
  console.log(`  ${relativePath}`)
}

const main = async(): Promise<void> => {
  for (const { id } of APP_ICON_VARIANTS) {
    // Switched to at runtime: window and shortcut icons, the Markdown file
    // type's icon in Explorer, and the macOS Dock / Linux window icon.
    write(`static/icons/${appIconFileName(id, 'ico')}`, await buildIco((px) => appIcon(id, px)))
    write(`static/icons/${markdownIconFileName(id, 'ico')}`, await buildIco((px) => markdownIcon(id, px)))
    write(`static/icons/${appIconFileName(id, 'png')}`, await rasterize(appIcon(id, 512)))
    write(`static/icons/${macDockIconFileName(id)}`, await rasterize(appIcon(id, 512, true)))
    // Shown in Preferences and the About dialog.
    write(`src/renderer/src/assets/images/appIcons/${appIconFileName(id, 'svg')}`, appIcon(id, 256))
    write(`src/renderer/src/assets/images/appIcons/${markdownIconFileName(id, 'svg')}`, markdownIcon(id, 256))
  }

  // Built into the packages: the executable and installer, the macOS bundle,
  // the Linux packages and the file associations electron-builder registers.
  const id = DEFAULT_APP_ICON
  const appIco = await buildIco((px) => appIcon(id, px))
  const mdIco = await buildIco((px) => markdownIcon(id, px))
  write('static/icon.ico', appIco)
  write('static/icon.icns', await buildIcns((px) => appIcon(id, px, true)))
  write('static/icon.png', await rasterize(appIcon(id, 512)))
  write('build/icons/icon.ico', appIco)
  write('build/icons/icon.icns', await buildIcns((px) => appIcon(id, px, true)))
  write('build/icons/icon.png', await rasterize(appIcon(id, 1024)))
  write('build/icons/md.ico', mdIco)
  write('build/icons/md.icns', await buildIcns((px) => markdownIcon(id, px)))
  write('build/icons/md.svg', markdownIcon(id, 256))
  for (const px of [16, 24, 32, 48, 64, 128, 256, 512]) {
    write(`build/icons/${px}x${px}/marktext.png`, await rasterize(appIcon(id, px)))
    write(`build/icons/${px}x${px}/md.png`, await rasterize(markdownIcon(id, px)))
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
