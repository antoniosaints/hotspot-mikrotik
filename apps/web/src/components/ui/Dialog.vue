<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div class="absolute inset-0" @click="$emit('update:open', false)" />
      <section
        :class="[
          'relative z-10 flex max-h-[88vh] w-full flex-col rounded-lg border border-border bg-card text-card-foreground shadow-2xl',
          widthClass,
        ]"
        role="dialog"
        aria-modal="true"
      >
        <header v-if="title || description || $slots.header" class="border-b border-border px-5 py-4">
          <slot name="header">
            <h2 class="text-lg font-semibold">{{ title }}</h2>
            <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
          </slot>
        </header>
        <div class="min-h-0 overflow-y-auto p-5">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="flex justify-end gap-2 border-t border-border px-5 py-4">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean;
  title?: string;
  description?: string;
  widthClass?: string;
}>(), {
  widthClass: "max-w-lg",
});

defineEmits<{
  "update:open": [value: boolean];
}>();
</script>
