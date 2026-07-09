<template>
  <Teleport to="body">
    <div class="fixed right-4 top-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div
          v-for="item in toasts"
          :key="item.id"
          :class="toastClass(item.variant)"
          role="status"
          aria-live="polite"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">{{ item.title }}</p>
            <p v-if="item.description" class="mt-1 text-sm leading-5 opacity-90">{{ item.description }}</p>
          </div>
          <button
            class="ml-3 rounded-sm p-1 text-current opacity-70 transition-opacity hover:opacity-100"
            type="button"
            aria-label="Fechar notificacao"
            @click="remove(item.id)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from "lucide-vue-next";

import { type ToastVariant, useToasts } from "@/services/toast";

const { toasts, remove } = useToasts();

function toastClass(variant: ToastVariant): string[] {
  const base = [
    "flex",
    "items-start",
    "gap-3",
    "rounded-lg",
    "border",
    "p-4",
    "shadow-2xl",
    "shadow-black/30",
    "backdrop-blur",
  ];

  if (variant === "destructive") {
    return [...base, "border-red-500/50", "bg-red-950/95", "text-red-50"];
  }

  if (variant === "success") {
    return [...base, "border-emerald-500/50", "bg-emerald-950/95", "text-emerald-50"];
  }

  return [...base, "border-border", "bg-card/95", "text-card-foreground"];
}
</script>
