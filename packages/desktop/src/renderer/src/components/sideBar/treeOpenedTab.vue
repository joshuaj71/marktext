<template>
  <div
    class="opened-file"
    :title="file.pathname"
    :class="[{ active: currentFile?.id === file.id, unsaved: !file.isSaved }]"
    @click="selectFile(file)"
  >
    <el-icon
      class="close-icon"
      :size="10"
      @click.stop="removeFileInTab(file)"
    >
      <Close />
    </el-icon>
    <span class="name">{{ file.filename }}</span>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'
import { Close } from '@element-plus/icons-vue'
import type { TabDescriptor } from './types'

defineProps<{
  file: TabDescriptor
}>()

const editorStore = useEditorStore()

const { currentFile } = storeToRefs(editorStore)

const selectFile = (file: TabDescriptor): void => {
  if (file.id !== currentFile.value?.id) {
    editorStore.UPDATE_CURRENT_FILE(file)
  }
}

const removeFileInTab = (file: TabDescriptor): void => {
  const { isSaved } = file
  if (isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}
</script>

<style scoped>
.opened-file {
  display: flex;
  align-items: center;
  user-select: none;
  height: 28px;
  margin: 1px 6px;
  padding: 0 8px 0 26px;
  border-radius: var(--chromeRadius);
  position: relative;
  color: var(--sideBarColor);
  & > .close-icon {
    display: none;
    position: absolute;
    top: 6px;
    left: 5px;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    cursor: pointer;
  }
  & > .close-icon:hover {
    background: var(--chromeActiveBgColor);
  }
  &:hover > .close-icon {
    display: inline-flex;
  }
  &:hover {
    background: var(--chromeHoverBgColor);
  }
  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.opened-file.active {
  background: var(--chromeActiveBgColor);
  color: var(--sideBarTitleColor);
  font-weight: 500;
}
.unsaved.opened-file::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  position: absolute;
  top: 11px;
  left: 10px;
}
.unsaved.opened-file:hover::before {
  content: none;
}
</style>
