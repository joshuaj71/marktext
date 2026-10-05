<template>
  <div
    class="editor-tabs"
    :class="{
      'in-title-bar': inTitleBar,
      'beside-window-controls': hasWindowControls,
      'beside-menu-button': hasWindowControls && !showSideBar,
      'beside-traffic-lights': isMac && inTitleBar && !showSideBar
    }"
  >
    <div
      ref="tabContainer"
      class="scrollable-tabs"
      :class="{ 'clipped-start': clippedStart, 'clipped-end': clippedEnd }"
      @scroll.passive="measureOverflow"
    >
      <ul
        ref="tabDropContainer"
        class="tabs-container"
      >
        <li
          v-for="file of tabs"
          :key="file.id"
          :title="file.pathname"
          :class="{ active: currentFile?.id === file.id, unsaved: !file.isSaved }"
          :data-id="file.id"
          @click.stop="selectFile(file)"
          @click.middle="closeTab(file.id)"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <span>{{ file.filename }}</span>
          <span class="unsaved-dot" />
          <el-icon
            class="close-icon"
            :size="12"
            @click.stop="removeFileInTab(file)"
          >
            <Close />
          </el-icon>
        </li>
      </ul>
    </div>
    <div
      class="new-file"
      @click.stop="newFile()"
    >
      <el-icon :size="16">
        <Plus />
      </el-icon>
    </div>
    <div
      v-if="clippedStart || clippedEnd"
      class="all-tabs"
      role="button"
      :title="t('contextMenu.tabs.allTabs')"
      :aria-label="t('contextMenu.tabs.allTabs')"
      @click.stop="showAllTabs($event)"
    >
      <el-icon :size="14">
        <ArrowDown />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import { isMac } from '@/util'
import { shouldShowInAppTitleBar } from '../titleBar/visibility'
import autoScroll from 'dom-autoscroller'
import dragula from 'dragula'
import { Plus, Close, ArrowDown } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { showContextMenu } from '../../contextMenu/tabs'
import { popupContextMenu } from '../../contextMenu/popupMenu'
import bus from '../../bus'
import type { IFileState } from '@shared/types/files'

const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()

const { currentFile, tabs } = storeToRefs(editorStore)
const { showSideBar } = storeToRefs(layoutStore)
const { titleBarStyle } = storeToRefs(usePreferencesStore())

// With an in-app title bar the strip sits in the title bar's own row, so it has
// to leave room for whatever that row pins to its ends: the window controls on
// the right, and — once the sidebar no longer occupies the corner — the menu
// button (Windows/Linux) or the traffic lights (macOS) on the left.
const inTitleBar = computed(() => shouldShowInAppTitleBar(titleBarStyle.value, isMac))
const hasWindowControls = computed(() => titleBarStyle.value === 'custom' && !isMac)

interface AutoScroller {
  readonly down: boolean
  destroy: (forceCleanAnimation?: boolean) => void
}

// Pointer travel, in CSS pixels, that separates a click from a tab drag.
// Matches the platform drag thresholds (Blink 3px, Win32 SM_CXDRAG 4px) with a
// little slack for trackpad drift.
const DRAG_THRESHOLD_PX = 5

const tabContainer = ref<HTMLElement | null>(null)
const tabDropContainer = ref<HTMLElement | null>(null)
let autoScroller: AutoScroller | null = null
let drake: dragula.Drake | null = null

// Whether tabs are scrolled out of sight before or after the visible part of
// the strip. Either one fades that edge and shows the "all tabs" button.
const clippedStart = ref(false)
const clippedEnd = ref(false)
let resizeObserver: ResizeObserver | null = null

const measureOverflow = () => {
  const container = tabContainer.value
  if (!container) return
  // A pixel of slack: fractional widths round differently in the two values.
  clippedStart.value = container.scrollLeft > 1
  clippedEnd.value = container.scrollLeft + container.clientWidth < container.scrollWidth - 1
}

// Tabs with the same file name are told apart by their folder.
const tabMenuLabel = (file: IFileState): string => {
  const sameName = tabs.value.filter((tab) => tab.filename === file.filename).length > 1
  const folder = sameName && file.pathname ? window.path.basename(window.path.dirname(file.pathname)) : ''
  const name = folder ? `${file.filename} — ${folder}` : file.filename
  return file.isSaved ? name : `${name} •`
}

const showAllTabs = (event: MouseEvent) => {
  const button = (event.currentTarget as HTMLElement).getBoundingClientRect()
  popupContextMenu(
    tabs.value.map((file) => ({
      label: tabMenuLabel(file),
      type: 'radio',
      checked: file.id === currentFile.value?.id,
      click: () => selectFile(file)
    })),
    { x: Math.round(button.left), y: Math.round(button.bottom) }
  )
}

// Computed properties

// Methods incorporated from tabsMixins
const selectFile = (file: IFileState) => {
  if (file.id !== currentFile.value?.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file: IFileState) => {
  const { isSaved } = file
  if (isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}

// Original methods
const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}

// Keep the active tab visible when the selection changes by something other
// than a direct click on a visible tab (keyboard cycle, switch-by-index, open
// from the sidebar): the strip has `overflow: hidden` and only scrolls on the
// wheel, so an off-screen tab would otherwise stay hidden (#3958).
const scrollActiveTabIntoView = () => {
  const container = tabContainer.value
  if (!container) return
  const activeTab = container.querySelector<HTMLElement>('li.active')
  if (!activeTab) return

  const containerRect = container.getBoundingClientRect()
  const tabRect = activeTab.getBoundingClientRect()
  if (tabRect.left < containerRect.left) {
    container.scrollLeft -= containerRect.left - tabRect.left
  } else if (tabRect.right > containerRect.right) {
    container.scrollLeft += tabRect.right - containerRect.right
  }
}

const handleTabScroll = (event: WheelEvent) => {
  // Use mouse wheel value first but prioritize X value more (e.g. touchpad input).
  let delta = event.deltaY
  if (event.deltaX !== 0) {
    delta = event.deltaX
  }

  const tabsEl = tabContainer.value
  if (!tabsEl) return
  const newLeft = Math.max(0, Math.min(tabsEl.scrollLeft + delta, tabsEl.scrollWidth))
  tabsEl.scrollLeft = newLeft
}

const closeTab = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab) {
    editorStore.CLOSE_TAB(tab)
  }
}

const closeOthers = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab) {
    editorStore.CLOSE_OTHER_TABS(tab)
  }
}

const closeSaved = () => {
  editorStore.CLOSE_SAVED_TABS()
}

const closeAll = () => {
  editorStore.CLOSE_ALL_TABS()
}

const changeMaxWidth = (width: unknown) => {
  layoutStore.CHANGE_SIDE_BAR_WIDTH(width as number)
}

const rename = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) {
    editorStore.RENAME_FILE(tab)
  }
}

const copyPath = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) {
    window.electron.clipboard.writeText(tab.pathname)
  }
}

const showInFolder = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) {
    window.electron.shell.showItemInFolder(tab.pathname)
  }
}

const handleContextMenu = (event: MouseEvent, tab: IFileState) => {
  if (tab.id) {
    showContextMenu(event, tab)
  }
}

watch(
  () => currentFile.value?.id,
  () => {
    nextTick(scrollActiveTabIntoView)
  }
)

watch(
  () => tabs.value.length,
  () => {
    nextTick(measureOverflow)
  }
)

onMounted(() => {
  bus.on('TABS::close-this', closeTab)
  bus.on('TABS::close-others', closeOthers)
  bus.on('TABS::close-saved', closeSaved)
  bus.on('TABS::close-all', closeAll)
  bus.on('TABS::rename', rename)
  bus.on('TABS::copy-path', copyPath)
  bus.on('TABS::show-in-folder', showInFolder)
  bus.on('EDITOR_TABS::change-max-width', changeMaxWidth)

  const tabsEl = tabContainer.value
  if (!tabsEl || !tabDropContainer.value) return

  // Allow to scroll through the tabs by mouse wheel or touchpad.
  tabsEl.addEventListener('wheel', handleTabScroll)

  // The strip narrows with the window and the sidebar; the list widens with
  // longer names. Either can start or end the overflow.
  resizeObserver = new ResizeObserver(measureOverflow)
  resizeObserver.observe(tabsEl)
  resizeObserver.observe(tabDropContainer.value)
  measureOverflow()

  // Allow tab drag and drop to reorder tabs.
  drake = dragula([tabDropContainer.value], {
    direction: 'horizontal',
    revertOnSpill: true,
    mirrorContainer: tabDropContainer.value,
    ignoreInputTextSelection: false,
    // dragula's own default is 0, i.e. a single pixel of pointer drift between
    // press and release turns a click into a drag. The drag then swallows the
    // `click` entirely — its mirror element takes the mouseup and is removed
    // before the browser can retarget — so `selectFile` never runs and the tab
    // refuses to activate (#4895). Require a deliberate movement instead.
    slideFactorX: DRAG_THRESHOLD_PX,
    slideFactorY: DRAG_THRESHOLD_PX
  }).on('drop', (el, _target, _source, sibling) => {
    // Current tab that was dropped and need to be reordered.
    const droppedId = el?.getAttribute('data-id')
    // This should be the next tab (tab | ... | el | sibling | tab | ...) but may be
    // the mirror image or null (tab | ... | el | sibling or null) if last tab.
    const nextTabId = sibling ? sibling.getAttribute('data-id') : null
    const isLastTab = !sibling || sibling.classList.contains('gu-mirror')
    if (!droppedId || (sibling && !nextTabId)) {
      console.error('Tab reorder error: invalid tab IDs')
      return
    }

    editorStore.EXCHANGE_TABS_BY_ID({
      fromId: droppedId,
      toId: isLastTab ? null : nextTabId
    })
  })

  // Scroll when dragging a tab to the beginning or end of the tab container.
  autoScroller = autoScroll([tabsEl], {
    margin: 20,
    maxSpeed: 6,
    scrollWhenOutside: false,
    autoScroll: () => {
      return autoScroller!.down && drake?.dragging
    }
  })
})

onBeforeUnmount(() => {
  const tabsEl = tabContainer.value
  if (tabsEl) {
    tabsEl.removeEventListener('wheel', handleTabScroll)
  }
  resizeObserver?.disconnect()

  if (autoScroller) {
    // Force destroy
    autoScroller.destroy(true)
  }
  if (drake) {
    drake.destroy()
  }

  // Remove event listeners
  bus.off('TABS::close-this', closeTab)
  bus.off('TABS::close-others', closeOthers)
  bus.off('TABS::close-saved', closeSaved)
  bus.off('TABS::close-all', closeAll)
  bus.off('TABS::rename', rename)
  bus.off('TABS::copy-path', copyPath)
  bus.off('TABS::show-in-folder', showInFolder)
  bus.off('EDITOR_TABS::change-max-width', changeMaxWidth)
})
</script>

<style scoped>
.close-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.15s ease-in-out;
}

.close-icon:hover {
  background: var(--chromeActiveBgColor);
  color: var(--editorColor);
}

.editor-tabs {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
  height: 36px;
  padding: 0 6px;
  box-sizing: border-box;
  font-family: var(--uiFontFamily);
  user-select: none;
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px solid var(--chromeBorderColor);
  }
}
.editor-tabs.in-title-bar {
  height: var(--titleBarHeight);
}
.editor-tabs.beside-window-controls {
  padding-right: 146px;
}
.editor-tabs.beside-menu-button {
  padding-left: 46px;
}
.editor-tabs.beside-traffic-lights {
  padding-left: 80px;
}
.scrollable-tabs {
  flex: 0 1 auto;
  height: 100%;
  overflow: hidden;
  --fadeStart: 0px;
  --fadeEnd: 0px;
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 var(--fadeStart),
    #000 calc(100% - var(--fadeEnd)),
    transparent
  );
}
.scrollable-tabs.clipped-start {
  --fadeStart: 28px;
}
.scrollable-tabs.clipped-end {
  --fadeEnd: 28px;
}
.tabs-container {
  min-width: min-content;
  list-style: none;
  margin: 0;
  padding: 0;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  overflow-y: hidden;
  z-index: 2;
  &::-webkit-scrollbar:horizontal {
    display: none;
  }
  /* The bundled themes draw a second divider under the tab list alone, in
     their own colour; the strip's ::after above already spans the full row. */
  &::after {
    content: none !important;
  }
  & > li {
    -webkit-app-region: no-drag;
    transition: color 0.15s ease-in-out;
    position: relative;
    /* Own stacking context, so the ::before pill below paints over the tab's
       background but under its label. */
    z-index: 0;
    padding: 0 5px 0 10px;
    color: var(--editorColor50);
    font-size: 13px;
    line-height: 28px;
    height: 28px;
    max-width: 220px;
    border-radius: var(--chromeRadius);
    display: flex;
    align-items: center;
    /* The hover/active pill is a pseudo-element rather than the tab's own
       background because the bundled themes force that background to the
       editor colour with !important. */
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: inherit;
      transition: background 0.15s ease-in-out;
    }
    &[aria-grabbed='true'] {
      color: var(--editorColor30) !important;
    }
    & > .close-icon {
      opacity: 0;
    }
    &:focus {
      outline: none;
    }
    &:hover {
      color: var(--editorColor);
    }
    &:hover::before {
      background: var(--chromeHoverBgColor);
    }
    &:hover > .close-icon {
      opacity: 1;
    }
    &:hover > .unsaved-dot {
      display: none;
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 4px;
    }
    & > .unsaved-dot {
      display: none;
      width: 6px;
      height: 6px;
      margin: 0 6px;
      border-radius: 50%;
      background: var(--themeColor);
      flex-shrink: 0;
    }
  }
  & > li.unsaved:not(.active) {
    & > .close-icon {
      display: none;
    }
    & > .unsaved-dot {
      display: block;
    }
    &:hover > .close-icon {
      display: inline-flex;
      opacity: 1;
    }
    &:hover > .unsaved-dot {
      display: none;
    }
  }
  & > li.active {
    color: var(--editorColor);
    z-index: 3;
    &::before {
      background: var(--chromeActiveBgColor);
    }
    & > .close-icon {
      opacity: 1;
    }
    & > .unsaved-dot {
      display: none;
    }
  }
}
.editor-tabs > .new-file {
  -webkit-app-region: no-drag;
  position: relative;
  z-index: 2;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  margin-left: 2px;
  border-radius: var(--chromeRadius);
  display: flex;
  align-items: center;
  justify-content: space-around;
  cursor: pointer;
  color: var(--editorColor40);
  transition:
    color 0.15s ease-in-out,
    background 0.15s ease-in-out;
}

.editor-tabs > .new-file:hover,
.editor-tabs > .all-tabs:hover {
  color: var(--editorColor);
  background: var(--chromeHoverBgColor);
}
.editor-tabs > .all-tabs {
  -webkit-app-region: no-drag;
  position: relative;
  z-index: 2;
  flex: 0 0 24px;
  height: 28px;
  margin-left: auto;
  border-radius: var(--chromeRadius);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--editorColor50);
  transition:
    color 0.15s ease-in-out,
    background 0.15s ease-in-out;
}

/* dragula effects */
.gu-mirror {
  position: fixed !important;
  margin: 0 !important;
  z-index: 9999 !important;
  opacity: 0.8;
  cursor: grabbing;
}
.gu-hide {
  display: none !important;
}
.gu-unselectable {
  user-select: none !important;
}
.gu-transit {
  opacity: 0.2;
}
</style>
