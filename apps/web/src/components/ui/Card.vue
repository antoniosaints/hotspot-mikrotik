<template>
  <section class="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
    <div v-if="$slots.header || title" class="border-b border-border px-5 py-4">
      <h3 v-if="title" class="text-base font-semibold">{{ title }}</h3>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
      <slot name="header" />
    </div>
    <div class="p-5">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-border px-5 py-4">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
}>();
</script>
