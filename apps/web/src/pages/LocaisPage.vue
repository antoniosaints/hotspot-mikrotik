<template>
  <CrudPage
    title="Locais"
    singular-title="local"
    description="Cadastro dos locais fisicos atendidos pelos hotspots."
    endpoint="/locais"
    :columns="columns"
    :fields="fields"
  />
</template>

<script setup lang="ts">
import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "descricao", label: "Descricao" },
  { key: "ativo", label: "Status", type: "boolean" },
  { key: "criadoEm", label: "Criado em", type: "date" },
];

const fields: CrudField[] = [
  { key: "nome", label: "Nome", type: "text", full: true },
  { key: "descricao", label: "Descricao", type: "text", defaultValue: null, full: true },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
];
</script>
