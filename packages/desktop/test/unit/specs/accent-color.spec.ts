import { afterEach, describe, expect, it, vi } from 'vitest'

// `@/config` reads `window.path.sep` at module load; stub it before the
// hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string } } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
})

import {
  ACCENT_PRESETS,
  accentFollowerValue,
  applyAccentColor,
  buildAccentCss,
  hexToHsl,
  hexToRgb,
  hslToHex,
  isAccentColor,
  readableTextOn,
  rgbToHex
} from '@/util/accentColor'
import { THEME_STYLE_ID } from '@/config'
import schema from '../../../src/main/preferences/schema.json'

describe('accent colour', () => {
  afterEach(() => {
    document.head.querySelectorAll('style').forEach((style) => style.remove())
  })

  it('accepts #rrggbb only', () => {
    expect(isAccentColor('#4285f4')).toBe(true)
    expect(isAccentColor('#4285F4')).toBe(true)
    expect(isAccentColor('')).toBe(false)
    expect(isAccentColor('#fff')).toBe(false)
    expect(isAccentColor('4285f4')).toBe(false)
    expect(isAccentColor('#4285f4ff')).toBe(false)
    expect(isAccentColor(null)).toBe(false)
  })

  it('stores what the preference schema allows', () => {
    const pattern = new RegExp(schema.accentColor.pattern)
    expect(pattern.test('')).toBe(true)
    for (const preset of ACCENT_PRESETS) {
      expect(isAccentColor(preset.color)).toBe(true)
      expect(pattern.test(preset.color)).toBe(true)
    }
  })

  it('ships twelve distinct presets', () => {
    expect(ACCENT_PRESETS).toHaveLength(12)
    expect(new Set(ACCENT_PRESETS.map((preset) => preset.color)).size).toBe(12)
    expect(new Set(ACCENT_PRESETS.map((preset) => preset.name)).size).toBe(12)
  })

  it('converts between hex and rgb', () => {
    expect(hexToRgb('#4285f4')).toEqual([66, 133, 244])
    expect(rgbToHex([66, 133, 244])).toBe('#4285f4')
    expect(rgbToHex([0, 9, 255])).toBe('#0009ff')
  })

  it('round-trips every preset through hsl', () => {
    for (const { color } of ACCENT_PRESETS) {
      expect(hslToHex(hexToHsl(color))).toBe(color)
    }
  })

  it('reads hue, saturation and lightness', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 1, l: 0.5 })
    expect(hexToHsl('#00ff00').h).toBe(120)
    expect(hexToHsl('#0000ff').h).toBe(240)
    expect(hexToHsl('#808080').s).toBe(0)
  })

  it('moves only the hue when the hue changes', () => {
    const base = hexToHsl('#4285f4')
    const shifted = hexToHsl(hslToHex({ ...base, h: 300 }))
    expect(Math.round(shifted.h)).toBe(300)
    expect(shifted.s).toBeCloseTo(base.s, 1)
    expect(shifted.l).toBeCloseTo(base.l, 1)
  })

  it('wraps hues outside [0, 360)', () => {
    expect(hslToHex({ h: 360, s: 1, l: 0.5 })).toBe('#ff0000')
    expect(hslToHex({ h: -120, s: 1, l: 0.5 })).toBe('#0000ff')
  })

  it('keeps button text legible on the accent', () => {
    expect(readableTextOn('#124191')).toBe('#ffffff')
    expect(readableTextOn('#4285f4')).toBe('#ffffff')
    expect(readableTextOn('#00c9ff')).toBe('#1f1f1f')
    expect(readableTextOn('#ffffff')).toBe('#1f1f1f')
  })

  it('follows the accent only where the theme used it', () => {
    // dark theme: links are the accent itself, emphasis a lighter tint of it
    expect(accentFollowerValue('#409eff', '#409eff', '#d40000')).toBe('var(--themeColor)')
    const tint = accentFollowerValue('#409eff', '#66b1ff', '#d40000')
    expect(tint).not.toBeNull()
    expect(Math.round(hexToHsl(tint!).h)).toBe(0)
    expect(hexToHsl(tint!).l).toBeGreaterThan(hexToHsl('#d40000').l)
    // a second hue, or a grey, is the theme's own choice
    expect(accentFollowerValue('#409eff', '#e06c75', '#d40000')).toBeNull()
    expect(accentFollowerValue('#409eff', '#808080', '#d40000')).toBeNull()
  })

  it('builds the theme colour ramp', () => {
    const css = buildAccentCss('#4285f4', [['--linkColor', 'var(--themeColor)']])
    expect(css).toContain('--themeColor: rgba(66, 133, 244, 1);')
    expect(css).toContain('--themeColor10: rgba(66, 133, 244, 0.1);')
    expect(css).toContain('--themeColor90: rgba(66, 133, 244, 0.9);')
    expect(css).toContain('--linkColor: var(--themeColor);')
    expect(css).not.toContain('--listMarkerColor')
    expect(css.startsWith('@media not print')).toBe(true)
  })

  it('inserts the accent sheet right after the theme sheet', () => {
    const theme = document.createElement('style')
    theme.id = THEME_STYLE_ID
    const custom = document.createElement('style')
    custom.id = 'custom-styles'
    document.head.append(theme, custom)

    applyAccentColor('#4285F4')

    const accent = document.getElementById('ag-accent')
    expect(accent).not.toBeNull()
    expect(theme.nextElementSibling).toBe(accent)
    expect(accent?.nextElementSibling).toBe(custom)
    expect(accent?.textContent).toContain('rgba(66, 133, 244, 1)')
  })

  it('reuses one sheet and removes it for the theme default', () => {
    applyAccentColor('#4285f4')
    applyAccentColor('#d40000')
    expect(document.querySelectorAll('#ag-accent')).toHaveLength(1)
    expect(document.getElementById('ag-accent')?.textContent).toContain('rgba(212, 0, 0, 1)')

    applyAccentColor('')
    expect(document.getElementById('ag-accent')).toBeNull()

    applyAccentColor('#4285f4')
    applyAccentColor('not-a-colour')
    expect(document.getElementById('ag-accent')).toBeNull()
  })
})
