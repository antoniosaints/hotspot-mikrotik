<template>
  <input
    :class="classes"
    :value="modelValue ?? ''"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string | number | boolean | null;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

const classes =
  "focus-ring flex h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50";
</script>
