<template>
  <div class="pref-theme">
    <h4>{{ t('preferences.theme.title') }}</h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.theme.accentColor') }}
        </h6>
      </template>
      <template #children>
        <section class="pref-accent">
          <div class="accent-swatches">
            <button
              type="button"
              class="accent-swatch theme-default"
              :class="{ active: !accentColor }"
              :title="t('preferences.theme.accentThemeDefault')"
              :aria-label="t('preferences.theme.accentThemeDefault')"
              :style="{ '--swatchColor': themeAccent }"
              @click="commitAccent('')"
            />
            <button
              v-for="preset of ACCENT_PRESETS"
              :key="preset.color"
              type="button"
              class="accent-swatch"
              :class="{ active: shownAccent === preset.color && !!accentColor }"
              :title="preset.name"
              :aria-label="preset.name"
              :style="{ '--swatchColor': preset.color }"
              @click="commitAccent(preset.color)"
            />
          </div>
          <div class="accent-custom">
            <span class="accent-label">{{ t('preferences.theme.accentHue') }}</span>
            <input
              class="accent-hue"
              type="range"
              min="0"
              max="359"
              step="1"
              :value="shownHue"
              :aria-label="t('preferences.theme.accentHue')"
              @pointerdown="startHueDrag"
              @input="onHueInput"
              @change="onHueChange"
            >
            <el-color-picker
              :model-value="shownAccent"
              :title="t('preferences.theme.accentCustom')"
              :aria-label="t('preferences.theme.accentCustom')"
              size="small"
              color-format="hex"
              @active-change="onPickerDrag"
              @change="onPickerChange"
            />
            <code class="accent-value">{{ shownAccent.toUpperCase() }}</code>
          </div>
        </section>
      </template>
    </compound>

    <compound
      :notes="
        t(isWindows ? 'preferences.theme.appIconNotesWindows' : 'preferences.theme.appIconNotes')
      "
    >
      <template #head>
        <h6 class="title">
          {{ t('preferences.theme.appIcon') }}
        </h6>
      </template>
      <template #children>
        <section
          class="pref-app-icon"
          role="radiogroup"
          :aria-label="t('preferences.theme.appIcon')"
        >
          <button
            v-for="variant of APP_ICON_VARIANTS"
            :key="variant.id"
            type="button"
            role="radio"
            class="app-icon-option"
            :class="{ active: shownAppIcon === variant.id }"
            :aria-checked="shownAppIcon === variant.id"
            @click="onSelectChange('appIcon', variant.id)"
          >
            <span class="app-icon-images">
              <img
                :src="appIconUrl(variant.id)"
                alt=""
                width="48"
                height="48"
              >
              <img
                :src="markdownIconUrl(variant.id)"
                alt=""
                width="48"
                height="48"
              >
            </span>
            <span class="app-icon-name">{{ variant.name }}</span>
          </button>
        </section>
      </template>
    </compound>

    <section class="offcial-themes">
      <div
        v-for="themeItem of themes"
        :key="themeItem.name"
        class="theme"
        :class="[
          themeItem.name,
          {
            active: themeItem.name === theme,
            disabled: followSystemTheme
          }
        ]"
        @click="!followSystemTheme && onSelectChange('theme', themeItem.name)"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="themeItem.html" />
      </div>
    </section>
    <separator />

    <Bool
      :description="t('preferences.theme.followSystemTheme')"
      :bool="followSystemTheme"
      :on-change="(value) => onSelectChange('followSystemTheme', value)"
    />

    <compound v-if="followSystemTheme">
      <template #head>
        <h6 class="title">
          {{ t('preferences.theme.modeThemes') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          :description="t('preferences.theme.lightModeTheme')"
          :value="lightModeTheme"
          :options="themeOptions"
          :on-change="(value) => onSelectChange('lightModeTheme', value)"
        />

        <cur-select
          :description="t('preferences.theme.darkModeTheme')"
          :value="darkModeTheme"
          :options="themeOptions"
          :on-change="(value) => onSelectChange('darkModeTheme', value)"
        />
      </template>
    </compound>

    <div class="custom-css">
      <div class="description">
        {{ t('preferences.theme.customCss') }}
      </div>
      <textarea
        class="custom-css-input"
        rows="10"
        :value="customCss"
        @change="
          (event: Event) =>
            onSelectChange('customCss', (event.target as HTMLTextAreaElement).value)
        "
      />
    </div>
    <separator v-show="false" />
    <section
      v-show="false"
      class="import-themes ag-underdevelop"
    >
      <div>
        <span>{{ t('preferences.theme.openThemesFolder') }}</span>
        <el-button size="small">
          {{ t('preferences.theme.openFolder') }}
        </el-button>
      </div>

      <div>
        <span>{{ t('preferences.theme.importCustomThemes') }}</span>
        <el-button size="small">
          {{ t('preferences.theme.importTheme') }}
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import themeMd from './theme.md?raw'
import { themes as configThemes } from './config'
import markdownToHtml from '@/util/markdownToHtml'
import Bool from '../common/bool/index.vue'
import CurSelect from '../common/select/index.vue'
import Separator from '../common/separator/index.vue'
import Compound from '../common/compound/index.vue'
import type { PrefSelectOption } from '../common/types'
import {
  ACCENT_PRESETS,
  applyAccentColor,
  getThemeAccentColor,
  hexToHsl,
  hslToHex,
  isAccentColor,
  type Hsl
} from '@/util/accentColor'
import { APP_ICON_VARIANTS } from 'common/appIcon'
import { appIconUrl, markdownIconUrl, resolveAppIcon } from '@/util/appIcon'
import { isWindows } from '@/util'

interface ThemePreview {
  name: string
  html: string
}

const themes = ref<ThemePreview[]>([])

const { t } = useI18n()
const preferenceStore = usePreferencesStore()

const {
  followSystemTheme,
  lightModeTheme,
  darkModeTheme,
  theme,
  accentColor,
  appIcon,
  customCss
} = storeToRefs(preferenceStore)

const shownAppIcon = computed(() => resolveAppIcon(appIcon.value))

// How often, in ms, a colour still being dragged is written to the preferences
// so the editor windows follow along. Each write also hits the settings file.
const DRAG_COMMIT_INTERVAL_MS = 120

const themeAccent = ref(getThemeAccentColor())
// Colour under the pointer while the hue slider or the picker is being
// dragged; null otherwise. Shown in place of the stored accent so the controls
// do not jump when a throttled write echoes back mid-drag.
const draftAccent = ref<string | null>(null)
// Saturation and lightness frozen at the start of a hue drag. Re-deriving them
// from each intermediate colour would let rounding drift them off course.
let hueDragBase: Hsl | null = null
let lastDragCommit = 0

const shownAccent = computed<string>(() => {
  if (draftAccent.value) return draftAccent.value
  return isAccentColor(accentColor.value) ? accentColor.value.toLowerCase() : themeAccent.value
})
const shownHue = computed<number>(() => Math.round(hexToHsl(shownAccent.value).h))

const commitAccent = (color: string): void => {
  draftAccent.value = null
  hueDragBase = null
  onSelectChange('accentColor', color)
}

const previewAccent = (color: string): void => {
  draftAccent.value = color
  applyAccentColor(color)
  const now = Date.now()
  if (now - lastDragCommit >= DRAG_COMMIT_INTERVAL_MS) {
    lastDragCommit = now
    onSelectChange('accentColor', color)
  }
}

const startHueDrag = (): void => {
  hueDragBase = hexToHsl(shownAccent.value)
}

const hueToAccent = (event: Event): string => {
  const base = hueDragBase ?? hexToHsl(shownAccent.value)
  hueDragBase = base
  return hslToHex({ ...base, h: Number((event.target as HTMLInputElement).value) })
}

const onHueInput = (event: Event): void => {
  previewAccent(hueToAccent(event))
}

const onHueChange = (event: Event): void => {
  commitAccent(hueToAccent(event))
}

const onPickerDrag = (color: string | null): void => {
  if (isAccentColor(color)) previewAccent(color.toLowerCase())
}

const onPickerChange = (color: string | null): void => {
  commitAccent(isAccentColor(color) ? color.toLowerCase() : '')
}

// The "theme default" swatch previews the theme's own accent, which is only
// readable once the new theme's stylesheet is in place.
watch(theme, () => {
  nextTick(() => {
    themeAccent.value = getThemeAccentColor()
  })
})

onBeforeUnmount(() => {
  // Leaving mid-drag: drop the preview and fall back to the stored accent.
  if (draftAccent.value) applyAccentColor(accentColor.value)
})

// Generate dropdown options from configThemes
const themeOptions: PrefSelectOption<string>[] = configThemes.map((theme) => ({
  label: theme.name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' '),
  value: theme.name
}))

onMounted(async () => {
  themeAccent.value = getThemeAccentColor()
  const newThemes: ThemePreview[] = []
  for (const theme of configThemes) {
    const html = await markdownToHtml(themeMd.replace(/{theme}/, theme.name))
    newThemes.push({
      name: theme.name,
      html
    })
  }
  themes.value = newThemes
})

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<style>
.pref-accent {
  & .accent-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  & .accent-swatch {
    appearance: none;
    position: relative;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--swatchColor);
    cursor: pointer;
    transition: transform 0.15s ease-in-out;
    /* The gap between the dot and its selection ring is the page background. */
    outline: 2px solid transparent;
    outline-offset: 2px;
  }
  & .accent-swatch:hover {
    transform: scale(1.1);
  }
  & .accent-swatch:focus-visible {
    outline-color: var(--editorColor30);
  }
  & .accent-swatch.active {
    outline-color: var(--swatchColor);
  }
  /* Half the theme's accent, half the page: "whatever the theme uses". */
  & .accent-swatch.theme-default {
    background: linear-gradient(135deg, var(--swatchColor) 50%, var(--editorBgColor) 50%);
    box-shadow: inset 0 0 0 1px var(--chromeBorderColor);
  }
  & .accent-custom {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }
  & .accent-label {
    flex-shrink: 0;
    color: var(--editorColor);
  }
  & .accent-hue {
    appearance: none;
    flex: 1;
    min-width: 0;
    height: 10px;
    margin: 0;
    border-radius: 5px;
    background: linear-gradient(
      to right,
      hsl(0 80% 55%),
      hsl(60 80% 50%),
      hsl(120 70% 45%),
      hsl(180 75% 45%),
      hsl(240 80% 60%),
      hsl(300 75% 55%),
      hsl(359 80% 55%)
    );
    cursor: pointer;
  }
  & .accent-hue::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid #ffffff;
    background: var(--themeColor);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 1px 3px rgba(0, 0, 0, 0.3);
  }
  & .accent-value {
    flex-shrink: 0;
    width: 64px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--editorColor50);
  }
  & .el-color-picker__trigger {
    border-color: var(--chromeBorderColor);
    border-radius: var(--chromeRadius);
  }
}

.pref-app-icon {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  & .app-icon-option {
    appearance: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 18px 10px;
    border: 1px solid var(--chromeBorderColor);
    border-radius: 10px;
    background: transparent;
    color: var(--editorColor);
    font: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
  }
  & .app-icon-option:hover {
    background: var(--editorColor04);
  }
  & .app-icon-option:focus-visible {
    outline: 2px solid var(--editorColor30);
    outline-offset: 2px;
  }
  /* Inset ring, so the border keeps its width when selected. */
  & .app-icon-option.active {
    border-color: var(--themeColor);
    box-shadow: inset 0 0 0 1px var(--themeColor);
  }
  & .app-icon-images {
    display: flex;
    gap: 10px;
  }
  & .app-icon-name {
    font-size: 13px;
  }
}

.offcial-themes {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  & .theme {
    cursor: pointer;
    width: 100%;
    height: 110px;
    margin: 0;
    padding: 16px 18px 16px 32px;
    overflow: hidden;
    background: var(--editorBgColor);
    color: var(--editorColor);
    box-sizing: border-box;
    box-shadow: 0 9px 28px -9px rgba(0, 0, 0, 0.4);
    border-radius: 5px;
    transition: opacity 0.2s ease;

    &.dark {
      color: rgba(255, 255, 255, 0.7);
      background: #282828;
      & a {
        color: #409eff;
      }
    }
    &.light {
      color: rgba(0, 0, 0, 0.7);
      background: rgba(255, 255, 255, 1);
      & a {
        color: rgba(23, 133, 91, 1);
      }
    }
    &.graphite {
      color: rgba(43, 48, 50, 0.7);
      background: #f7f7f7;
      & a {
        color: rgb(104, 134, 170);
      }
    }
    &.material-dark {
      color: rgba(171, 178, 191, 0.8);
      background: #34393f;
      & a {
        color: #f48237;
      }
    }
    &.one-dark {
      color: #9da5b4;
      background: #282c34;
      & a {
        color: rgba(226, 192, 141, 1);
      }
    }
    &.ulysses {
      color: rgba(101, 101, 101, 0.7);
      background: #f3f3f3;
      & a {
        color: rgb(12, 139, 186);
      }
    }

    /* New gogh themes - Dark */
    &.dracula {
      color: #f8f8f2;
      background: #282a36;
      & a {
        color: #bd93f9;
      }
    }
    &.nord {
      color: #d8dee9;
      background: #2e3440;
      & a {
        color: #81a1c1;
      }
    }
    &.catppuccin-mocha {
      color: #cdd6f4;
      background: #1e1e2e;
      & a {
        color: #89b4fa;
      }
    }
    &.gruvbox-dark {
      color: #ebdbb2;
      background: #282828;
      & a {
        color: #83a598;
      }
    }
    &.tokyo-night {
      color: #c0caf5;
      background: #1a1b26;
      & a {
        color: #7aa2f7;
      }
    }
    &.tokyo-night-storm {
      color: #c0caf5;
      background: #24283b;
      & a {
        color: #7aa2f7;
      }
    }
    &.solarized-dark {
      color: #839496;
      background: #002b36;
      & a {
        color: #268bd2;
      }
    }
    &.ayu-dark {
      color: #b3b1ad;
      background: #0a0e14;
      & a {
        color: #39bae6;
      }
    }
    &.ayu-mirage {
      color: #cbccc6;
      background: #1f2430;
      & a {
        color: #ffcc66;
      }
    }
    &.everforest-dark {
      color: #d3c6aa;
      background: #2d353b;
      & a {
        color: #a7c080;
      }
    }
    &.rose-pine {
      color: #e0def4;
      background: #191724;
      & a {
        color: #c4a7e7;
      }
    }
    &.rose-pine-moon {
      color: #e0def4;
      background: #232136;
      & a {
        color: #c4a7e7;
      }
    }
    &.monokai-pro {
      color: #fcfcfa;
      background: #2d2a2e;
      & a {
        color: #ffd866;
      }
    }
    &.synthwave-84 {
      color: #ffffff;
      background: #262335;
      & a {
        color: #ff7edb;
      }
    }
    &.horizon-dark {
      color: #d5d8da;
      background: #1c1e26;
      & a {
        color: #e95678;
      }
    }
    &.palenight {
      color: #a6accd;
      background: #292d3e;
      & a {
        color: #82aaff;
      }
    }
    &.oxocarbon-dark {
      color: #f2f4f8;
      background: #161616;
      & a {
        color: #78a9ff;
      }
    }
    &.kanagawa {
      color: #dcd7ba;
      background: #1f1f28;
      & a {
        color: #7e9cd8;
      }
    }
    &.nightfox {
      color: #cdcecf;
      background: #192330;
      & a {
        color: #719cd6;
      }
    }
    &.cyberdream {
      color: #ffffff;
      background: #16181a;
      & a {
        color: #5ea1ff;
      }
    }

    /* New gogh themes - Light */
    &.catppuccin-latte {
      color: #4c4f69;
      background: #eff1f5;
      & a {
        color: #1e66f5;
      }
    }
    &.gruvbox-light {
      color: #3c3836;
      background: #fbf1c7;
      & a {
        color: #458588;
      }
    }
    &.tokyo-night-light {
      color: #343b58;
      background: #d5d6db;
      & a {
        color: #34548a;
      }
    }
    &.solarized-light {
      color: #657b83;
      background: #fdf6e3;
      & a {
        color: #268bd2;
      }
    }
    &.ayu-light {
      color: #575f66;
      background: #fafafa;
      & a {
        color: #399ee6;
      }
    }
    &.everforest-light {
      color: #5c6a72;
      background: #fdf6e3;
      & a {
        color: #8da101;
      }
    }
    &.rose-pine-dawn {
      color: #575279;
      background: #faf4ed;
      & a {
        color: #907aa9;
      }
    }

    /* Disabled state when followSystemTheme is on */
    &.disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Active theme - use outline instead of border to avoid layout shift? */
    &.active {
      box-shadow: var(--floatShadow);
      outline: 2px solid var(--themeColor);
      outline-offset: -2px;
    }

    /* Active + disabled: slightly more visible */
    &.disabled.active {
      opacity: 0.7;
    }
  }
  & h3 {
    position: relative;
    margin: 0;
    font-size: 16px;
    color: currentColor;
    cursor: pointer;
    &::before {
      content: 'h3';
      position: absolute;
      top: 4px;
      left: -20px;
      display: block;
      width: 10px;
      height: 10px;
      font-size: 12px;
      opacity: 0.5;
    }
  }
  & p {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.custom-css {
  margin: 20px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .description {
    margin-bottom: 10px;
  }
  & .custom-css-input {
    width: 100%;
    background: transparent;
    color: var(--editorColor);
    border: 1px solid var(--editorColor10);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: 'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    box-sizing: border-box;
    resize: vertical;
  }
  & .custom-css-input:focus {
    outline: none;
    border-color: var(--themeColor);
  }
}

.import-themes {
  padding: 10px 0;
  display: flex;
  justify-content: space-around;
  color: var(--editorColor);
  & > div {
    display: flex;
    flex-direction: column;
    & > span {
      display: inline-block;
      margin-bottom: 20px;
    }
  }
}
</style>
