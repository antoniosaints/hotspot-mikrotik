<template>
  <div class="relative inline-flex" @keydown.escape="open = false">
    <button
      class="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-secondary"
      type="button"
      @click="open = !open"
    >
      <slot name="trigger">Menu</slot>
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-12 z-40 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const open = ref(false);
</script>
