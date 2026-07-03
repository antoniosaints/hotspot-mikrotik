<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-primary">{{ eyebrow }}</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">{{ title }}</h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{{ description }}</p>
      </div>
      <Badge variant="outline">Placeholder</Badge>
    </div>

    <Card>
      <div class="grid gap-4 md:grid-cols-3">
        <div v-for="item in summary" :key="item.label" class="rounded-lg border border-border bg-background/50 p-4">
          <p class="text-sm text-muted-foreground">{{ item.label }}</p>
          <p class="mt-2 text-2xl font-semibold">{{ item.value }}</p>
        </div>
      </div>
    </Card>

    <Alert>
      Esta rota esta pronta para receber a tela completa na proxima task.
    </Alert>
  </div>
</template>

<script setup lang="ts">
import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    eyebrow?: string;
  }>(),
  {
    description: "Estrutura visual temporaria para validar layout, navegacao e build.",
    eyebrow: "Modulo",
  },
);

const summary = [
  { label: "Estado", value: "Pronto" },
  { label: "UI", value: "Base" },
  { label: "Escopo", value: "Task 4" },
];
</script>
