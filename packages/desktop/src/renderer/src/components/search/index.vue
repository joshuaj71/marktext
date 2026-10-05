<template>
  <div
    v-show="showSearch"
    class="search-bar"
  >
    <div
      class="left-arrow"
      @click="toggleSearchType"
    >
      <el-icon
        :size="14"
        :class="{ 'arrow-right': type === 'search' }"
      >
        <ArrowDown />
      </el-icon>
    </div>
    <div class="right-controls">
      <section class="search">
        <div
          class="input-wrapper"
          :class="{ error: !!searchErrorMsg }"
        >
          <input
            ref="search"
            v-model="searchValue"
            type="text"
            :placeholder="t('search.searchPlaceholder')"
            @keyup="handleEnterKey"
          >
          <div class="controls">
            <span class="search-result">{{ highlightIndex + 1 }} /
              {{ highlightCount }}
            </span>
            <span
              :title="t('search.caseSensitive')"
              class="is-case-sensitive"
              :class="{ active: isCaseSensitive }"
              @click="toggleCtrl('isCaseSensitive')"
            >
              <FindCaseIcon aria-hidden="true" />
            </span>
            <span
              :title="t('search.wholeWord')"
              class="is-whole-word"
              :class="{ active: isWholeWord }"
              @click="toggleCtrl('isWholeWord')"
            >
              <FindWordIcon aria-hidden="true" />
            </span>
            <span
              :title="t('search.useRegex')"
              class="is-regex"
              :class="{ active: isRegexp }"
              @click="toggleCtrl('isRegexp')"
            >
              <FindRegexIcon aria-hidden="true" />
            </span>
          </div>
          <div
            v-if="searchErrorMsg"
            class="error-msg"
          >
            {{ searchErrorMsg }}
          </div>
        </div>
        <div class="button-group">
          <button
            class="find-button find-previous"
            @click="find('previous')"
          >
            <el-icon :size="14">
              <ArrowUp />
            </el-icon>
          </button>
          <button
            class="find-button find-next"
            @click="find('next')"
          >
            <el-icon :size="14">
              <ArrowDown />
            </el-icon>
          </button>
        </div>
      </section>
      <section
        v-if="type === 'replace'"
        class="replace"
      >
        <div class="input-wrapper replace-input">
          <input
            v-model="replaceValue"
            type="text"
            :placeholder="t('search.replacementPlaceholder')"
          >
        </div>
        <div class="button-group">
          <el-tooltip
            class="item"
            effect="dark"
            :content="t('search.replaceAll')"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button
              class="find-button replace-all"
              @click="replace(false)"
            >
              <el-icon :size="14">
                <RefreshRight />
              </el-icon>
            </button>
          </el-tooltip>
          <el-tooltip
            class="item"
            effect="dark"
            :content="t('search.replaceSingle')"
            placement="top"
            :visible-arrow="false"
            :open-delay="1000"
          >
            <button
              class="find-button replace-single"
              @click="replace(true)"
            >
              <el-icon :size="14">
                <Switch />
              </el-icon>
            </button>
          </el-tooltip>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import bus from '../../bus'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import debounce from 'lodash/debounce'
import { ArrowDown, ArrowUp, RefreshRight, Switch } from '@element-plus/icons-vue'

const { t } = useI18n()

const editorStore = useEditorStore()

const showSearch = ref(false)
const isCaseSensitive = ref(false)
const isWholeWord = ref(false)
const isRegexp = ref(false)
const type = ref('search')
const searchValue = ref('')
const replaceValue = ref('')
const searchErrorMsg = ref('')
const search = ref<HTMLInputElement | null>(null)

const { currentFile } = storeToRefs(editorStore)
const searchMatches = computed(() => currentFile.value?.searchMatches)

watch(searchValue, () => {
  if (!showSearch.value) return // make sure search box is actually open
  debouncedSearchFn()
})

watch(searchMatches, (newValue, oldValue) => {
  // Once the search bar is open it owns the query. Ignore editor
  // selection-changes while open — notably the spurious selection-change the
  // engine emits when the bar steals editor focus, which would otherwise
  // clobber the just-prefilled value (e.g. leaving a stale single character).
  if (showSearch.value) return
  if (!newValue || !oldValue) return
  const { value } = newValue
  if (value !== oldValue.value) {
    searchValue.value = value
  }
})

// Seed the find input from the current selection synchronously, before the bar
// opens and steals focus. Relying on the reactive `searchMatches` watch alone
// races with the focus-steal selection-change and can drop the prefill.
const prefillFromSelection = () => {
  const selected = searchMatches.value?.value
  if (selected) {
    searchValue.value = selected
  }
}

const highlightIndex = computed(() => {
  if (searchMatches.value) {
    return searchMatches.value.index
  } else {
    return -1
  }
})

const highlightCount = computed(() => {
  if (searchMatches.value) {
    return searchMatches.value.matches.length
  } else {
    return 0
  }
})

onMounted(() => {
  bus.on('find', listenFind)
  bus.on('replace', listenReplace)
  bus.on('findNext', listenFindNext)
  bus.on('findPrev', listenFindPrev)
  document.addEventListener('click', docClick)
  document.addEventListener('keyup', docKeyup)
  bus.on('search-blur', blurSearch)
})

onBeforeUnmount(() => {
  bus.off('find', listenFind)
  bus.off('replace', listenReplace)
  bus.off('findNext', listenFindNext)
  bus.off('findPrev', listenFindPrev)
  document.removeEventListener('click', docClick)
  document.removeEventListener('keyup', docKeyup)
  bus.off('search-blur', blurSearch)
})

const toggleCtrl = (ctrl: 'isCaseSensitive' | 'isWholeWord' | 'isRegexp') => {
  switch (ctrl) {
    case 'isCaseSensitive':
      isCaseSensitive.value = !isCaseSensitive.value
      break
    case 'isWholeWord':
      isWholeWord.value = !isWholeWord.value
      break
    case 'isRegexp':
      isRegexp.value = !isRegexp.value
      break
  }
  searchFn()
}

const listenFind = () => {
  prefillFromSelection()
  showSearch.value = true
  type.value = 'search'
  nextTick(() => {
    search.value?.focus()
    // Select the existing term so re-opening Find types over it instead of
    // appending to the previous query (#3458).
    search.value?.select()
    if (searchValue.value) {
      searchFn()
    }
  })
}

const listenReplace = () => {
  prefillFromSelection()
  showSearch.value = true
  type.value = 'replace'
}

const listenFindNext = () => {
  find('next')
}

const listenFindPrev = () => {
  find('previous')
}

const docKeyup = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emptySearch(true)
  }
}

const docClick = (event: MouseEvent) => {
  if (!showSearch.value) return
  // Replaces the @click.stop that used to swallow these clicks from every other
  // document-level listener.
  const target = event.target as HTMLElement | null
  if (target && target.closest('.search-bar')) return
  emptySearch(true)
}

const blurSearch = () => {
  emptySearch(true)
}

const emptySearch = (selectHighlight = false) => {
  showSearch.value = false
  searchValue.value = ''
  replaceValue.value = ''
  bus.emit('searchValue', { value: searchValue.value, opt: { selectHighlight } })
}

const toggleSearchType = () => {
  type.value = type.value === 'search' ? 'replace' : 'search'
}

/** Find the previous or next search result. */
const find = (action: 'previous' | 'next') => {
  bus.emit('find-action', action)
}

const handleEnterKey = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    find('next')
  }
}

const searchFn = () => {
  if (isRegexp.value) {
    // Handle invalid regexp.
    try {
      RegExp(searchValue.value)
      searchErrorMsg.value = ''
    } catch {
      searchErrorMsg.value = t('search.invalidRegex', { pattern: searchValue.value })
      return
    }
    // Handle match empty string, no need to search.
    try {
      const SEARCH_REG = new RegExp(searchValue.value)
      if (searchValue.value && SEARCH_REG.test('')) {
        throw new Error()
      }
      searchErrorMsg.value = ''
    } catch {
      searchErrorMsg.value = t('search.regexMatchEmpty', { pattern: searchValue.value })
      return
    }
  }

  bus.emit('searchValue', {
    value: searchValue.value,
    opt: {
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}

const debouncedSearchFn = debounce(searchFn, 150)

const replace = (isSingle = true) => {
  bus.emit('replaceValue', {
    value: replaceValue.value,
    opt: {
      isSingle,
      isCaseSensitive: isCaseSensitive.value,
      isWholeWord: isWholeWord.value,
      isRegexp: isRegexp.value
    }
  })
}
</script>

<style scoped>
.search-bar {
  position: absolute;
  top: 8px;
  right: 24px;
  width: 420px;
  padding: 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  gap: 4px;
  font-family: var(--uiFontFamily);
  border-radius: var(--surfaceRadius);
  box-shadow: var(--surfaceShadow);
  background: var(--floatBgColor);
}
.search-bar .left-arrow {
  flex-shrink: 0;
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--iconColor);
  cursor: pointer;
  transition: background-color 0.12s ease-in-out;
}
.search-bar .left-arrow:hover {
  background: var(--chromeHoverBgColor);
}
.search-bar .left-arrow .arrow-right {
  transform: rotate(-90deg);
}

.search-bar .right-controls {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.search,
.replace {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
}

.button-group {
  display: flex;
  gap: 2px;
}
.find-button {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  outline: none;
  background: transparent;
  color: var(--iconColor);
  cursor: pointer;
  transition: background-color 0.12s ease-in-out;
}
.find-button:hover {
  background: var(--chromeHoverBgColor);
  color: var(--editorColor);
}
.find-button:active {
  background: var(--chromeActiveBgColor);
}
.find-button:focus-visible {
  box-shadow: 0 0 0 2px var(--themeColor50);
}

.input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  box-sizing: border-box;
  border: 1px solid var(--chromeBorderColor);
  border-radius: 6px;
  background: transparent;
  overflow: visible;
  transition:
    border-color 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}
.input-wrapper:focus-within {
  border-color: var(--themeColor);
  box-shadow: 0 0 0 3px var(--themeColor20);
}
.input-wrapper.error {
  border-color: var(--notificationErrorBg);
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}
.input-wrapper .controls {
  position: absolute;
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 1px;
  font-size: 12px;
  color: var(--editorColor50);
  & > span.search-result {
    margin-right: 4px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  & > span:not(.search-result) {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    & > svg {
      fill: var(--iconColor);
    }
    &:hover {
      background: var(--chromeHoverBgColor);
    }
    &.active {
      background: var(--themeColor20);
      & > svg {
        fill: var(--themeColor);
      }
    }
  }
}

.input-wrapper .error-msg {
  position: absolute;
  top: calc(100% + 1px);
  left: -1px;
  width: calc(100% + 2px);
  padding: 4px 8px;
  box-sizing: border-box;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  background: var(--notificationErrorBg);
  color: #ffffff;
  font-size: 12px;
  line-height: 18px;
  z-index: 1;
}

.input-wrapper input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  box-sizing: border-box;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--editorColor);
}
/* Room for the match count and the three toggles. */
.search .input-wrapper input {
  padding-right: 122px;
}
</style>
