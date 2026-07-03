<template>
  <div>
    <div class="inline-flex rounded-md border border-border bg-muted p-1">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="focus-ring rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab.value === modelValue ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        type="button"
        @click="$emit('update:modelValue', tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="mt-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  tabs: Array<{ label: string; value: string }>;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
