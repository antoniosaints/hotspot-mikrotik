<template>
  <div class="flex flex-col gap-3 rounded-lg border border-border bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0 flex-1">
      <input
        :value="search"
        class="focus-ring h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground"
        type="search"
        placeholder="Buscar registros..."
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{{ filteredTotal }} de {{ total }} registro(s)</span>
      <select
        :value="pageSize"
        class="focus-ring h-10 rounded-md border border-input bg-background/70 px-2 text-sm text-foreground shadow-sm"
        @change="$emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }} por pagina</option>
      </select>
      <button
        class="focus-ring h-10 rounded-md border border-border px-3 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        :disabled="page <= 1"
        @click="$emit('update:page', page - 1)"
      >
        Anterior
      </button>
      <span class="min-w-20 text-center">Pag. {{ page }} / {{ totalPages }}</span>
      <button
        class="focus-ring h-10 rounded-md border border-border px-3 text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        :disabled="page >= totalPages"
        @click="$emit('update:page', page + 1)"
      >
        Proxima
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    search: string;
    page: number;
    pageSize: number;
    total: number;
    filteredTotal: number;
    totalPages: number;
    pageSizeOptions?: number[];
  }>(),
  {
    pageSizeOptions: () => [10, 25, 50, 100],
  },
);

defineEmits<{
  "update:search": [value: string];
  "update:page": [value: number];
  "update:pageSize": [value: number];
}>();
</script>
