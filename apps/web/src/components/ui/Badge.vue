<template>
  <span :class="classes">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "destructive";
  }>(),
  {
    variant: "default",
  },
);

const variants = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border text-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
};

const classes = computed(() => [
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  variants[props.variant],
]);
</script>
