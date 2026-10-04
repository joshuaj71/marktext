<script setup lang="ts">
import { computed } from 'vue'
import '@marktext/file-icons/build/index.css'
import { getFileIconClasses } from './fileIconClass'

const props = defineProps<{
  name: string
}>()

const className = computed<string[]>(() => getFileIconClasses(props.name))
</script>

<template>
  <span
    :class="className"
    class="file-icon"
  />
</template>

<style scoped>
.file-icon {
  flex-shrink: 0;
  width: 16px;
  margin-right: 4px;
  text-align: center;
}
/* file-icons colours each type individually; in the tree a single muted tone
   keeps the icons from competing with the file names. */
.file-icon::before {
  color: var(--sideBarTextColor);
  margin-right: 0;
}
/* Nearly every row is a markdown file, so its badge carries no information.
   The slot stays, which lines file names up with folder names. */
.file-icon.markdown-icon::before {
  visibility: hidden;
}
</style>
