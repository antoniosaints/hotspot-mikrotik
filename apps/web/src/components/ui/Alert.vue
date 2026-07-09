<template>
  <div :class="classes" role="alert">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "destructive";
  }>(),
  {
    variant: "default",
  },
);

const classes = computed(() => [
  "rounded-lg border p-4 text-sm",
  props.variant === "destructive"
    ? "border-destructive/50 bg-destructive/10 text-red-900 dark:text-red-200"
    : "border-border bg-card text-card-foreground",
]);
</script>
