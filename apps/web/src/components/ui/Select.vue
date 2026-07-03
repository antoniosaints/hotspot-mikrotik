<template>
  <select
    :value="modelValue"
    class="focus-ring flex h-10 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <slot />
  </select>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    placeholder?: string;
  }>(),
  {
    modelValue: "",
  },
);

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
