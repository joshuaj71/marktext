import { THEME_STYLE_ID } from '../config'

export interface AccentPreset {
  name: string
  // `#rrggbb`, lower case.
  color: string
}

// Proper names, so they are shown as written in every locale.
export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { name: 'Google Blue', color: '#4285f4' },
  { name: 'Azure', color: '#007fff' },
  { name: 'Nokia Blue', color: '#124191' },
  { name: 'Nokia Light Blue', color: '#00c9ff' },
  { name: 'Klein Blue', color: '#002fa7' },
  { name: 'Tiffany Blue', color: '#0abab5' },
  { name: 'MarkText Green', color: '#21b56f' },
  { name: 'Dusty Pink', color: '#d48a9a' },
  { name: 'Living Coral', color: '#ff6f61' },
  { name: 'Ferrari Red', color: '#d40000' },
  { name: 'Hermès Orange', color: '#f37021' },
  { name: 'Very Peri', color: '#6667ab' }
]

const ACCENT_STYLE_ID = 'ag-accent'

// Theme variables that a theme may or may not tie to its accent. Each one
// follows the custom accent only when the active theme coloured it with its own
// `--themeColor` or a lighter/darker tint of it, so a theme that deliberately
// uses a second hue (say, for links) keeps it.
const ACCENT_FOLLOWERS = [
  '--highlightThemeColor',
  '--focusColor',
  '--linkColor',
  '--blockquoteBorderColor',
  '--listMarkerColor',
  '--emColor',
  '--deleteColor',
  '--buttonPrimaryBgColor'
] as const

// How far, in degrees of hue, a colour may sit from the theme's accent and
// still count as a tint of it.
const TINT_HUE_TOLERANCE = 15
// Below this saturation a colour is a grey, whose hue means nothing.
const TINT_MIN_SATURATION = 0.25

const ALPHA_STEPS = [90, 80, 70, 60, 50, 40, 30, 20, 10] as const

// Below this contrast against white, text on the accent switches to dark.
const MIN_WHITE_TEXT_CONTRAST = 3

export type Rgb = [number, number, number]

export interface Hsl {
  // Degrees, [0, 360).
  h: number
  // Fractions, [0, 1].
  s: number
  l: number
}

/** Whether `value` is an accent the preference accepts: `#rrggbb`, any case. */
export const isAccentColor = (value: unknown): value is string => {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

export const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

export const rgbToHex = ([r, g, b]: Rgb): string => {
  return '#' + [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')
}

export const hexToHsl = (hex: string): Hsl => {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

export const hslToHex = ({ h, s, l }: Hsl): string => {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const sector = (((h % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((sector % 2) - 1))
  const m = l - chroma / 2
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x]
  ][Math.floor(sector) % 6]!
  return rgbToHex([r!, g!, b!].map((channel) => Math.round((channel + m) * 255)) as Rgb)
}

// WCAG 2 relative luminance, [0, 1].
const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Text colour to put on top of an accent-coloured surface such as a primary
 * button: white where it stays legible, near-black on light accents.
 */
export const readableTextOn = (hex: string): string => {
  const contrastWithWhite = 1.05 / (relativeLuminance(hex) + 0.05)
  return contrastWithWhite >= MIN_WHITE_TEXT_CONTRAST ? '#ffffff' : '#1f1f1f'
}

/**
 * How a theme variable relates to the theme's accent, and so what it becomes
 * under a custom accent.
 *
 * @param themeAccent The theme's own accent, `#rrggbb`.
 * @param themeValue The colour the theme gave the variable, `#rrggbb`.
 * @param accent The custom accent, `#rrggbb`.
 * @returns `var(--themeColor)` when the theme used its accent as is, the
 *   equivalent tint of `accent` when it used a tint, null when the variable has
 *   a colour of its own.
 */
export const accentFollowerValue = (
  themeAccent: string,
  themeValue: string,
  accent: string
): string | null => {
  if (themeValue === themeAccent) return 'var(--themeColor)'

  const from = hexToHsl(themeAccent)
  const tint = hexToHsl(themeValue)
  const hueDistance = Math.abs(((tint.h - from.h + 540) % 360) - 180)
  if (
    from.s < TINT_MIN_SATURATION ||
    tint.s < TINT_MIN_SATURATION ||
    hueDistance > TINT_HUE_TOLERANCE
  ) {
    return null
  }

  const to = hexToHsl(accent)
  const clamp = (value: number): number => Math.min(1, Math.max(0, value))
  return hslToHex({ h: to.h, s: to.s, l: clamp(to.l + (tint.l - from.l)) })
}

/**
 * The rule set that swaps a theme's accent for `hex`.
 *
 * @param hex Accent as `#rrggbb`.
 * @param followers Extra theme variables to restate, as `[name, value]`; see
 *   `accentFollowerValue`.
 */
export const buildAccentCss = (
  hex: string,
  followers: ReadonlyArray<readonly [string, string]> = []
): string => {
  const rgb = hexToRgb(hex).join(', ')
  const lines = [
    `--themeColor: rgba(${rgb}, 1);`,
    ...ALPHA_STEPS.map((step) => `--themeColor${step}: rgba(${rgb}, ${step / 100});`),
    `--highlightColor: rgba(${rgb}, 0.4);`,
    ...followers.map(([name, value]) => `${name}: ${value};`),
    `--buttonPrimaryFontColor: ${readableTextOn(hex)};`,
    '--buttonPrimaryBgColorHover: color-mix(in srgb, var(--themeColor) 88%, #ffffff);',
    '--buttonPrimaryBgColorActive: color-mix(in srgb, var(--themeColor) 88%, #000000);'
  ]
  // Themes are scoped the same way, so print and export keep their own colours.
  return `@media not print {\n:root {\n  ${lines.join('\n  ')}\n}\n}`
}

// Resolves any CSS colour — or a custom property holding one — to the
// `rgb()`/`rgba()` string the browser computes, so colours written in
// different notations can be compared.
export const resolveColor = (value: string): string => {
  const probe = document.createElement('span')
  probe.style.color = value
  document.documentElement.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved
}

export const rgbStringToHex = (value: string): string | null => {
  const channels = value.match(/\d+(\.\d+)?/g)
  if (!channels || channels.length < 3) return null
  return rgbToHex(channels.slice(0, 3).map((channel) => Math.round(Number(channel))) as Rgb)
}

/**
 * The active theme's own accent as `#rrggbb`, ignoring any custom accent in
 * effect. Falls back to `fallback` outside a rendered document.
 */
export const getThemeAccentColor = (fallback = '#17855b'): string => {
  const accentStyle = document.getElementById(ACCENT_STYLE_ID) as HTMLStyleElement | null
  const css = accentStyle?.textContent ?? ''
  if (accentStyle) accentStyle.textContent = ''
  const hex = rgbStringToHex(resolveColor('var(--themeColor)'))
  if (accentStyle) accentStyle.textContent = css
  return hex ?? fallback
}

/**
 * Replace the active theme's accent with `color`, or restore the theme's own
 * accent when `color` is empty or not a valid accent. Call it again after the
 * theme changes: which variables follow the accent depends on the theme.
 */
export const applyAccentColor = (color: string | null | undefined): void => {
  let style = document.getElementById(ACCENT_STYLE_ID) as HTMLStyleElement | null
  if (!isAccentColor(color)) {
    style?.remove()
    return
  }

  if (!style) {
    style = document.createElement('style')
    style.id = ACCENT_STYLE_ID
  }
  const accent = color.toLowerCase()
  // Emptied before measuring, so the comparison sees the theme's own values.
  style.textContent = ''
  const themeAccent = rgbStringToHex(resolveColor('var(--themeColor)'))
  const followers: Array<readonly [string, string]> = []
  for (const name of ACCENT_FOLLOWERS) {
    const themeValue = rgbStringToHex(resolveColor(`var(${name})`))
    if (!themeAccent || !themeValue) continue
    const value = accentFollowerValue(themeAccent, themeValue, accent)
    if (value) followers.push([name, value])
  }
  style.textContent = buildAccentCss(accent, followers)

  // Directly after the theme sheet: late enough to override it, early enough
  // that the user's custom CSS still has the last word.
  const themeStyle = document.getElementById(THEME_STYLE_ID)
  if (themeStyle) themeStyle.after(style)
  else document.head.appendChild(style)
}
