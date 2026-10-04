<template>
  <section class="pref-compound-item">
    <div class="pref-compound-head">
      <slot name="head" />
    </div>
    <div class="pref-compound-body">
      <slot name="children" />
    </div>
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  notes?: string
}>()
</script>

<style>
.pref-compound-item {
  font-size: 14px;
  user-select: none;
  margin: 28px 0;
  color: var(--editorColor);

  & .pref-compound-head h6.title {
    padding: 0 2px 8px;
  }

  /* Each group of settings reads as one card, its rows split by hairlines. */
  & .pref-compound-body {
    padding: 2px 16px;
    border: 1px solid var(--chromeBorderColor);
    border-radius: 10px;
    & > * {
      margin: 0;
      padding: 12px 0;
    }
    & > * + * {
      border-top: 1px solid var(--chromeBorderColor);
    }
    & > .pref-separator {
      display: none;
    }
  }

  & > .notes {
    margin: 8px 2px 0;
  }

  & .description {
    & i {
      cursor: pointer;
      opacity: 0.7;
      color: var(--iconColor);
    }
    & i:hover {
      color: var(--themeColor);
    }
  }
}
</style>
