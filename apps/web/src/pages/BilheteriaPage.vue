<template>
  <CrudPage
    title="Bilheteria"
    singular-title="plano"
    description="Planos vendidos no portal de compra de acesso."
    endpoint="/planos"
    :columns="columns"
    :fields="fields"
    :create-disabled="hotspotsLoading || hotspots.length === 0"
    :create-disabled-reason="createDisabledReason"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";
import { api } from "@/services/api";
import type { Hotspot } from "@/types/hotspot";

const hotspots = ref<Hotspot[]>([]);
const hotspotsLoading = ref(true);

const columns: CrudColumn[] = [
  { key: "nome", label: "Plano" },
  { key: "hotspot.nome", label: "Hotspot" },
  { key: "tempoMinutos", label: "Min" },
  { key: "conexoesSimultaneas", label: "Conexoes" },
  { key: "valorCentavos", label: "Valor centavos" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const fields = computed<CrudField[]>(() => [
  { key: "nome", label: "Nome do plano", type: "text" },
  {
    key: "hotspotId",
    label: "Hotspot",
    type: "select",
    options: hotspots.value.map((hotspot) => ({ label: hotspot.nome, value: hotspot.id })),
  },
  { key: "tempoMinutos", label: "Tempo de sessao (min)", type: "number", defaultValue: 60 },
  { key: "conexoesSimultaneas", label: "Conexoes simultaneas", type: "number", defaultValue: 1 },
  { key: "valorCentavos", label: "Valor em centavos", type: "number", defaultValue: 1000 },
  { key: "coletarNome", label: "Coletar nome", type: "checkbox-card", defaultValue: false },
  { key: "coletarTelefone", label: "Coletar telefone", type: "checkbox-card", defaultValue: false },
  { key: "coletarEmail", label: "Coletar email", type: "checkbox-card", defaultValue: false },
  { key: "coletarCpf", label: "Coletar CPF", type: "checkbox-card", defaultValue: true },
  { key: "coletarEndereco", label: "Coletar endereco", type: "checkbox-card", defaultValue: false },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
]);

const createDisabledReason = computed(() => {
  if (hotspotsLoading.value) return "Carregando hotspots.";
  if (hotspots.value.length === 0) return "Cadastre um hotspot antes de criar planos.";
  return undefined;
});

onMounted(async () => {
  try {
    hotspots.value = await api.get<Hotspot[]>("/hotspots");
  } finally {
    hotspotsLoading.value = false;
  }
});
</script>
