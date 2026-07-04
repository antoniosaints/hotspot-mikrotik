<template>
  <CrudPage
    title="Logins CPF"
    singular-title="login CPF"
    description="Pessoas autorizadas a acessar o hotspot usando CPF."
    endpoint="/cpf-logins"
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

type HotspotOption = Pick<Hotspot, "id" | "nome" | "localId" | "mikrotikId" | "ativo">;

const hotspots = ref<HotspotOption[]>([]);
const hotspotsLoading = ref(true);

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "cpf", label: "CPF" },
  { key: "telefone", label: "Telefone" },
  { key: "hotspot.nome", label: "Hotspot" },
  { key: "tempoMinutos", label: "Min" },
  { key: "ativo", label: "Status", type: "boolean" },
  { key: "usadoEm", label: "Ultimo uso", type: "date" },
];

const fields = computed<CrudField[]>(() => [
  { key: "nome", label: "Nome", type: "text" },
  { key: "cpf", label: "CPF", type: "text", placeholder: "000.000.000-00" },
  { key: "telefone", label: "Telefone", type: "text", defaultValue: null },
  { key: "tempoMinutos", label: "Tempo (minutos)", type: "number", defaultValue: 60 },
  {
    key: "hotspotId",
    label: "Hotspot",
    type: "select",
    options: hotspots.value.map((hotspot) => ({ label: hotspot.nome, value: hotspot.id })),
  },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
]);

const createDisabledReason = computed(() => {
  if (hotspotsLoading.value) return "Carregando hotspots.";
  if (hotspots.value.length === 0) return "Cadastre um hotspot antes de criar logins CPF.";
  return undefined;
});

onMounted(async () => {
  try {
    hotspots.value = await api.get<HotspotOption[]>("/hotspots-options");
  } finally {
    hotspotsLoading.value = false;
  }
});
</script>
