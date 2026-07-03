<template>
  <button :class="classes" :type="type">
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
    size?: "sm" | "md" | "lg" | "icon";
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "default",
    size: "md",
    type: "button",
  },
);

const variants = {
  default: "bg-primary text-primary-foreground shadow-glow hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-border bg-background/40 hover:bg-secondary",
  ghost: "hover:bg-secondary hover:text-secondary-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 py-2 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10",
};

const classes = computed(() => [
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  variants[props.variant],
  sizes[props.size],
]);
</script>
