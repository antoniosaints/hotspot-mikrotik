<template>
  <div class="space-y-5">
    <Card title="Acesso personalizado" description="Configure o valor por minuto e os limites do slider mostrado como ultima opcao em Comprar acesso.">
      <Alert v-if="customError" variant="destructive" class="mb-4">{{ customError }}</Alert>
      <Alert v-if="customSuccess" class="mb-4">{{ customSuccess }}</Alert>

      <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Label>Hotspot</Label>
          <Select v-model="selectedCustomHotspotId" class="mt-2" placeholder="Selecione um hotspot">
            <option v-for="hotspot in hotspots" :key="hotspot.id" :value="hotspot.id">{{ hotspot.nome }}</option>
          </Select>
        </div>
        <label class="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2 text-sm font-medium text-foreground lg:mt-6">
          <input v-model="customForm.compraOnline" type="checkbox" />
          Compra online
        </label>
        <label class="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2 text-sm font-medium text-foreground lg:mt-6">
          <input v-model="customForm.compraPersonalizada" type="checkbox" />
          Personalizado
        </label>
        <div>
          <Label>Valor/min (centavos)</Label>
          <Input v-model="customForm.valorMinutoCentavos" class="mt-2" type="number" min="1" />
        </div>
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-4">
        <div>
          <Label>Minimo (min)</Label>
          <Input v-model="customForm.tempoPersonalizadoMinimo" class="mt-2" type="number" min="1" />
        </div>
        <div>
          <Label>Maximo (min)</Label>
          <Input v-model="customForm.tempoPersonalizadoMaximo" class="mt-2" type="number" min="1" />
        </div>
        <div>
          <Label>Passo (min)</Label>
          <Input v-model="customForm.tempoPersonalizadoPasso" class="mt-2" type="number" min="1" />
        </div>
        <div>
          <Label>Conexoes</Label>
          <Input v-model="customForm.conexoesPersonalizado" class="mt-2" type="number" min="1" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <Button :disabled="customSaving || !selectedCustomHotspotId" @click="saveCustomSettings">
            {{ customSaving ? "Salvando..." : "Salvar personalizado" }}
          </Button>
        </div>
      </template>
    </Card>

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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";
import { api, ApiError } from "@/services/api";
import type { Hotspot } from "@/types/hotspot";

const hotspots = ref<Hotspot[]>([]);
const hotspotsLoading = ref(true);
const selectedCustomHotspotId = ref("");
const customSaving = ref(false);
const customError = ref("");
const customSuccess = ref("");
const customForm = reactive({
  compraOnline: false,
  compraPersonalizada: false,
  valorMinutoCentavos: 10,
  tempoPersonalizadoMinimo: 10,
  tempoPersonalizadoMaximo: 240,
  tempoPersonalizadoPasso: 10,
  conexoesPersonalizado: 1,
});

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

const selectedCustomHotspot = computed(() => hotspots.value.find((hotspot) => hotspot.id === selectedCustomHotspotId.value));

watch(selectedCustomHotspot, (hotspot) => {
  customError.value = "";
  customSuccess.value = "";
  customForm.compraOnline = Boolean(hotspot?.compraOnline);
  customForm.compraPersonalizada = Boolean(hotspot?.compraPersonalizada);
  customForm.valorMinutoCentavos = hotspot?.valorMinutoCentavos ?? 10;
  customForm.tempoPersonalizadoMinimo = hotspot?.tempoPersonalizadoMinimo ?? 10;
  customForm.tempoPersonalizadoMaximo = hotspot?.tempoPersonalizadoMaximo ?? 240;
  customForm.tempoPersonalizadoPasso = hotspot?.tempoPersonalizadoPasso ?? 10;
  customForm.conexoesPersonalizado = hotspot?.conexoesPersonalizado ?? 1;
});

async function saveCustomSettings(): Promise<void> {
  const hotspot = selectedCustomHotspot.value;
  if (!hotspot) return;
  customSaving.value = true;
  customError.value = "";
  customSuccess.value = "";
  try {
    const payload = {
      compraOnline: customForm.compraOnline,
      compraPersonalizada: customForm.compraPersonalizada,
      valorMinutoCentavos: Number(customForm.valorMinutoCentavos),
      tempoPersonalizadoMinimo: Number(customForm.tempoPersonalizadoMinimo),
      tempoPersonalizadoMaximo: Number(customForm.tempoPersonalizadoMaximo),
      tempoPersonalizadoPasso: Number(customForm.tempoPersonalizadoPasso),
      conexoesPersonalizado: Number(customForm.conexoesPersonalizado),
    };

    if (payload.compraPersonalizada && payload.tempoPersonalizadoMaximo < payload.tempoPersonalizadoMinimo) {
      customError.value = "O tempo maximo deve ser maior ou igual ao tempo minimo.";
      return;
    }

    const updated = await api.put<Hotspot>(`/hotspots/${hotspot.id}`, payload);
    hotspots.value = hotspots.value.map((item) => (item.id === updated.id ? updated : item));
    customSuccess.value = "Configuracao personalizada salva.";
  } catch (requestError) {
    customError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar o personalizado.";
  } finally {
    customSaving.value = false;
  }
}

onMounted(async () => {
  try {
    hotspots.value = await api.get<Hotspot[]>("/hotspots");
    selectedCustomHotspotId.value = hotspots.value[0]?.id ?? "";
  } finally {
    hotspotsLoading.value = false;
  }
});
</script>
