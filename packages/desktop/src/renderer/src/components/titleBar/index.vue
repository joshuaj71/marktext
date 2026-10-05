<template>
  <div>
    <div
      v-if="showTitleBar"
      class="title-bar-editor-bg"
      :class="{ 'tabs-visible': showTabBar, 'tabs-in-title-bar': tabsInTitleBar }"
    />
    <div
      v-if="showTitleBar"
      class="title-bar"
      :class="[
        { active: active },
        { 'tabs-visible': showTabBar },
        { 'tabs-in-title-bar': tabsInTitleBar },
        { frameless: titleBarStyle === 'custom' },
        { isOsx: isOsx }
      ]"
    >
      <div
        class="title"
        @dblclick.stop="toggleMaxmizeOnMacOS"
      >
        <span v-if="!filename">{{ APP_PRODUCT_NAME }}</span>
        <span v-else>
          <span
            class="save-dot"
            :class="{ show: !isSaved }"
          />
          <span class="path">
            <bdi dir="ltr">
              <span
                v-for="(path, index) of paths"
                :key="index"
                class="path-segment"
              >{{ path }}</span>
              <span
                class="filename"
                :class="{ isOsx: platform === 'darwin' }"
                @click="rename"
              >
                {{ filename }}
              </span>
            </bdi>
          </span>
        </span>
      </div>
      <div :class="showCustomTitleBar ? 'left-toolbar title-no-drag' : 'right-toolbar'">
        <div
          v-if="showCustomTitleBar"
          class="frameless-titlebar-menu title-no-drag"
          @click.stop="handleMenuClick"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
          </svg>
        </div>
        <el-tooltip
          v-if="wordCount"
          class="item"
          popper-class="word-count-tooltip"
          placement="bottom-end"
        >
          <template #content>
            <div class="title-section">
              {{ selectionWordCount ? t('menu.counter.documentSelection') : t('menu.counter.document') }}
            </div>
            <div class="title-item">
              <span class="front">{{ t('menu.counter.words') }}:</span><span class="text">{{ formatCountPair('word') }}</span>
            </div>
            <div class="title-item">
              <span class="front">{{ t('menu.counter.characters') }}:</span><span class="text">{{ formatCountPair('character') }}</span>
            </div>
            <div class="title-item">
              <span class="front">{{ t('menu.counter.paragraphs') }}:</span><span class="text">{{ formatCountPair('paragraph') }}</span>
            </div>
            <div class="title-item">
              <span class="front">{{ t('menu.counter.allCharacters') }}:</span><span class="text">{{ formatCountPair('all') }}</span>
            </div>
          </template>
          <div
            v-if="wordCount"
            class="word-count"
            @click.stop="handleWordClick"
          >
            <span class="text-center-vertical">{{ wordCountText }}</span>
          </div>
        </el-tooltip>
      </div>
      <div
        v-if="titleBarStyle === 'custom' && !isFullScreen && !isOsx && !isWindows"
        class="right-toolbar"
        :class="[{ 'title-no-drag': titleBarStyle === 'custom' }]"
      >
        <div
          class="frameless-titlebar-button frameless-titlebar-close"
          @click.stop="handleCloseClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path :d="windowIconClose" />
            </svg>
          </div>
        </div>
        <div
          class="frameless-titlebar-button frameless-titlebar-toggle"
          @click.stop="handleMaximizeClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path
                v-show="!isMaximized"
                :d="windowIconMaximize"
              />
              <path
                v-show="isMaximized"
                :d="windowIconRestore"
              />
            </svg>
          </div>
        </div>
        <div
          class="frameless-titlebar-button frameless-titlebar-minimize"
          @click.stop="handleMinimizeClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path :d="windowIconMinimize" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '@/store/preferences.js'
import { useLayoutStore } from '@/store/layout.js'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { minimizePath, restorePath, maximizePath, closePath } from '../../assets/window-controls.js'
import { PATH_SEPARATOR } from '../../config'
import { APP_PRODUCT_NAME } from 'common/appIdentity'
import { isMac as isOsxPlatform, isWindows } from '@/util'
import { shouldShowInAppTitleBar, tabsShareTitleBarRow } from './visibility'
import { useEditorStore } from '@/store/editor'
import { useI18n } from 'vue-i18n'
import type { FileWordCount } from '@shared/types/files'

interface ProjectInfo {
  name?: string
  [key: string]: unknown
}

const props = defineProps<{
  project?: ProjectInfo | null
  filename?: string
  pathname?: string
  active?: boolean
  wordCount?: FileWordCount | null
  selectionWordCount?: FileWordCount | null
  platform?: string
  isSaved?: boolean
}>()

const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const editorStore = useEditorStore()
const { t } = useI18n()

const isOsx = isOsxPlatform
const HASH = {
  word: { short: 'W' },
  character: { short: 'C' },
  paragraph: { short: 'P' },
  all: { short: 'A' }
}
const windowIconMinimize = minimizePath
const windowIconRestore = restorePath
const windowIconMaximize = maximizePath
const windowIconClose = closePath

const isFullScreen = ref(false)
const isMaximized = ref(false)
const show = ref<'word' | 'paragraph' | 'character' | 'all'>('word')

onMounted(async () => {
  try {
    const [fs, max] = await Promise.all([
      window.electron.windowControl.isFullScreen(),
      window.electron.windowControl.isMaximized()
    ])
    isFullScreen.value = !!fs
    isMaximized.value = !!max
  } catch {}
})

const { titleBarStyle } = storeToRefs(preferencesStore)
const { showTabBar } = storeToRefs(layoutStore)

const paths = computed(() => {
  if (!props.pathname) return []
  const pathnameToken = props.pathname.split(PATH_SEPARATOR).filter((i) => i)
  return pathnameToken.slice(0, pathnameToken.length - 1).slice(-3)
})

const showCustomTitleBar = computed(() => {
  return titleBarStyle.value === 'custom' && !isOsx
})

const wordCountText = computed(() => {
  if (!props.wordCount) return ''

  const value = props.wordCount[show.value]
  const selectionValue = props.selectionWordCount?.[show.value]
  return selectionValue == null
    ? `${HASH[show.value].short} ${value}`
    : `${HASH[show.value].short} ${value} / ${selectionValue}`
})

const formatCountPair = (key: keyof FileWordCount) => {
  const value = props.wordCount?.[key] ?? 0
  const selectionValue = props.selectionWordCount?.[key]
  return selectionValue == null ? `${value}` : `${value} / ${selectionValue}`
}

const showTitleBar = computed(() => {
  return shouldShowInAppTitleBar(titleBarStyle.value, isOsx)
})

const tabsInTitleBar = computed(() => {
  const hasOpenFile = editorStore.currentFile?.markdown !== undefined
  return tabsShareTitleBarRow(showTitleBar.value, showTabBar.value, hasOpenFile)
})

watch(
  () => props.filename,
  (value) => {
    // Set filename when hover on dock
    const hasOpenFolder = !!(props.project && props.project.name)
    const projectName = props.project?.name ?? ''
    let title = ''
    if (value) {
      title = hasOpenFolder ? `${value} - ${projectName}` : `${value}`
    } else {
      title = hasOpenFolder ? projectName : ''
    }

    document.title = title
  }
)

const handleWordClick = () => {
  const ITEMS = ['word', 'paragraph', 'character', 'all'] as const
  const len = ITEMS.length
  let index = ITEMS.indexOf(show.value)
  index += 1
  if (index >= len) index = 0
  show.value = ITEMS[index]!
}

const handleCloseClick = () => {
  window.electron.windowControl.close()
}

const handleMaximizeClick = async () => {
  if (isFullScreen.value) {
    window.electron.windowControl.setFullScreen(false)
    return
  }
  if (isMaximized.value) window.electron.windowControl.unmaximize()
  else window.electron.windowControl.maximize()
}

const toggleMaxmizeOnMacOS = () => {
  if (isOsx) {
    handleMaximizeClick()
  }
}

const handleMinimizeClick = () => {
  window.electron.windowControl.minimize()
}

const handleMenuClick = () => {
  window.electron.windowControl.popupApplicationMenu({ x: 23, y: 20 })
}

const rename = () => {
  if (props.platform === 'darwin') {
    editorStore.RESPONSE_FOR_RENAME()
  }
}

const onMaximize = () => {
  isMaximized.value = true
}
const onUnmaximize = () => {
  isMaximized.value = false
}
const onEnterFullScreen = () => {
  isFullScreen.value = true
}
const onLeaveFullScreen = () => {
  isFullScreen.value = false
}

const offMaximize = window.electron.ipcRenderer.on('mt::window-maximize', onMaximize)
const offUnmaximize = window.electron.ipcRenderer.on('mt::window-unmaximize', onUnmaximize)
const offEnterFullScreen = window.electron.ipcRenderer.on(
  'mt::window-enter-full-screen',
  onEnterFullScreen
)
const offLeaveFullScreen = window.electron.ipcRenderer.on(
  'mt::window-leave-full-screen',
  onLeaveFullScreen
)

onBeforeUnmount(() => {
  offMaximize()
  offUnmaximize()
  offEnterFullScreen()
  offLeaveFullScreen()
})
</script>

<style scoped>
.title-bar-editor-bg {
  height: var(--titleBarHeight);
  flex-shrink: 0;
  background: var(--editorBgColor);
  position: relative;
  left: 0;
  top: 0;
  right: 0;
}
/* The tab strip takes over this row, so the spacer that normally reserves it
   must not push the tabs down. */
.title-bar-editor-bg.tabs-in-title-bar {
  display: none;
}
.title-bar {
  -webkit-app-region: drag;
  user-select: none;
  background: transparent;
  height: var(--titleBarHeight);
  box-sizing: border-box;
  font-family: var(--uiFontFamily);
  color: var(--editorColor50);
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  z-index: 2;
  transition: color 0.4s ease-in-out;
  cursor: default;
}
/* This bar overlays the tab strip. It stays a window drag region (the tabs opt
   out with no-drag), but must not swallow the clicks meant for the tabs. */
.title-bar.tabs-in-title-bar {
  pointer-events: none;
  & .title > span {
    visibility: hidden;
  }
  & .left-toolbar,
  & .right-toolbar,
  & .word-count {
    pointer-events: auto;
  }
}
.active {
  color: var(--editorColor);
}
img {
  height: 90%;
  margin-top: 1px;
  vertical-align: top;
}
.title {
  padding: 0 148px;
  height: 100%;
  line-height: var(--titleBarHeight);
  font-size: 13px;
  text-align: center;
  transition: all 0.25s ease-in-out;
  & .filename {
    transition: all 0.25s ease-in-out;
  }
  &::after {
    content: '';
    position: absolute;
    top: 0;
    height: 1px;
    width: 100%;
    z-index: 1;
    -webkit-app-region: no-drag;
  }
}
div.title > span {
  display: flex;
  align-items: baseline;
  justify-content: center;
}

/* Workaround for GH#339: the RTL context clips an over-long path from the left
   so the filename stays visible. The save dot is a sibling rather than a child
   so that clipping can never swallow it. */
div.title > span > .path {
  direction: rtl;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
  min-width: 0;
}

/* The RTL context above only exists to clip long paths from the left. Isolating
   each segment keeps an RTL folder name from dragging its separator — or the
   segments around it — out of order. */
div.title > span > .path > bdi > span {
  unicode-bidi: isolate;
}

.path-segment {
  color: var(--editorColor40);
}
/* Generated content, so a segment's text stays exactly the folder name. */
.path-segment::after {
  content: '/';
  margin: 0 6px;
  color: var(--editorColor30);
}

.title-bar .title .filename.isOsx:hover {
  color: var(--themeColor);
}

.active .save-dot {
  flex: none;
  align-self: center;
  margin-right: 6px;
  width: 6px;
  height: 6px;
  display: inline-block;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  visibility: hidden;
}
.active .save-dot.show {
  visibility: visible;
}

.left-toolbar {
  padding: 0 6px;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}
.right-toolbar {
  height: 100%;
  position: absolute;
  top: 0;
  right: 0;
  width: 138px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  & .item {
    margin-right: 10px;
  }
}

.title-section {
  font-weight: 600;
  margin: 2px 0 4px;
}

/* Pinned to the window's bottom-right corner like a status readout, so the
   title bar row holds nothing but the menu button, the title or tabs, and the
   window controls. */
.word-count {
  -webkit-app-region: no-drag;
  position: fixed;
  right: 20px;
  bottom: 10px;
  cursor: pointer;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--editorColor40);
  line-height: 24px;
  padding: 0 8px;
  border-radius: var(--chromeRadius);
  background: color-mix(in srgb, var(--editorBgColor) 88%, transparent);
  transition:
    color 0.15s ease-in-out,
    background 0.15s ease-in-out;
  &:hover {
    color: var(--editorColor);
    background: color-mix(in srgb, var(--editorColor) 7%, var(--editorBgColor));
  }
}

.title-no-drag {
  -webkit-app-region: no-drag;
}
/* frameless window controls */
.frameless-titlebar-button {
  position: relative;
  display: block;
  width: 46px;
  height: var(--titleBarHeight);
}
.frameless-titlebar-button > div {
  position: absolute;
  display: inline-flex;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
}
.frameless-titlebar-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border-radius: var(--chromeRadius);
  color: var(--sideBarIconColor);
  & svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
  }
  &:hover {
    background: var(--chromeHoverBgColor);
    color: var(--editorColor);
  }
}
.frameless-titlebar-close:hover {
  background-color: #e5484d;
}
.frameless-titlebar-minimize:hover,
.frameless-titlebar-toggle:hover {
  background-color: var(--chromeHoverBgColor);
}
.frameless-titlebar-button svg {
  fill: var(--editorColor);
}
.frameless-titlebar-close:hover svg {
  fill: #ffffff;
}

.text-center-vertical {
  display: inline-block;
  vertical-align: middle;
  line-height: normal;
}
</style>

<style>
.title-item {
  height: 28px;
  line-height: 28px;
  & .front {
    opacity: 0.7;
  }
  & .text {
    margin-left: 10px;
  }
}
</style>
