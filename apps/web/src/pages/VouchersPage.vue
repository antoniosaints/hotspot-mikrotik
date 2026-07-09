<template>
  <CrudPage
    ref="crud"
    title="Vouchers"
    singular-title="voucher"
    description="Emissao, edicao e acompanhamento de vouchers usados e disponiveis."
    endpoint="/vouchers"
    :columns="columns"
    :fields="fields"
    :deletable-when="canDeleteVoucher"
    :create-disabled="hotspotsLoading || hotspots.length === 0"
    :create-disabled-reason="createDisabledReason"
  >
    <template #row-actions="{ item, reload }">
      <Button
        v-if="!item.vendido"
        size="sm"
        variant="secondary"
        @click="markSold(String(item.id), reload)"
      >
        Vender
      </Button>
    </template>
    <template #toolbar>
      <Button variant="secondary" :disabled="batchUnavailable" :title="createDisabledReason" @click="batchOpen = true">
        <Plus class="h-4 w-4" />
        Gerar lote
      </Button>
    </template>
  </CrudPage>

  <Dialog v-model:open="batchOpen" title="Gerar lote de vouchers" description="Crie codigos aleatorios para um hotspot.">
    <form id="batch-form" class="space-y-4" @submit.prevent="generateBatch">
      <div>
        <Label for="hotspotId">Hotspot</Label>
        <Select id="hotspotId" v-model="batch.hotspotId" class="mt-2" :disabled="batchUnavailable" placeholder="Selecione">
          <option v-for="hotspot in hotspots" :key="hotspot.id" :value="hotspot.id">{{ hotspot.nome }}</option>
        </Select>
        <p v-if="hotspotsLoading" class="mt-2 text-sm text-muted-foreground">Carregando hotspots disponiveis.</p>
        <p v-else-if="hotspots.length === 0" class="mt-2 text-sm text-destructive">
          Nenhum hotspot disponivel. Cadastre um hotspot antes de gerar vouchers.
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <Label for="prefixo">Prefixo</Label>
          <Input id="prefixo" v-model="batch.prefixo" class="mt-2 uppercase" maxlength="12" placeholder="VIP" />
          <p class="mt-1 text-xs text-muted-foreground">Opcional. O voucher sera iniciado com este texto.</p>
        </div>
        <div>
          <Label for="quantidade">Quantidade</Label>
          <Input id="quantidade" v-model="batch.quantidade" class="mt-2" min="1" type="number" />
        </div>
        <div>
          <Label for="tempoMinutos">Tempo (minutos)</Label>
          <Input id="tempoMinutos" v-model="batch.tempoMinutos" class="mt-2" min="1" type="number" />
        </div>
        <div>
          <Label for="segmentacao">Segmentacao</Label>
          <Input id="segmentacao" v-model="batch.segmentacao" class="mt-2" placeholder="Evento, vendedor, ponto de venda" />
        </div>
      </div>
    </form>
    <template #footer>
      <Button variant="outline" @click="batchOpen = false">Cancelar</Button>
      <Button type="submit" form="batch-form" :disabled="saving || batchUnavailable">
        {{ saving ? "Gerando..." : "Gerar" }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import { computed, onMounted, reactive, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import CrudPage, { type CrudColumn, type CrudField, type CrudRecord } from "@/pages/CrudPage.vue";
import { api, ApiError } from "@/services/api";
import { toast } from "@/services/toast";
import type { Hotspot } from "@/types/hotspot";

type HotspotOption = Pick<Hotspot, "id" | "nome" | "localId" | "mikrotikId" | "ativo">;

const hotspots = ref<HotspotOption[]>([]);
const hotspotsLoading = ref(true);
const crud = ref<InstanceType<typeof CrudPage> | null>(null);
const batchOpen = ref(false);
const saving = ref(false);
const batch = reactive({
  hotspotId: "",
  prefixo: "",
  segmentacao: "",
  quantidade: 10,
  tempoMinutos: 60,
});

const columns: CrudColumn[] = [
  { key: "codigo", label: "Codigo" },
  { key: "hotspot.nome", label: "Hotspot" },
  { key: "tempoMinutos", label: "Min" },
  { key: "segmentacao", label: "Segmentacao" },
  { key: "vendido", label: "Vendido", type: "boolean" },
  { key: "usado", label: "Status", type: "status" },
  { key: "mac", label: "MAC" },
  { key: "ip", label: "IP" },
  { key: "usadoEm", label: "Usado em", type: "date" },
];

const fields = computed<CrudField[]>(() => [
  { key: "codigo", label: "Codigo", type: "text" },
  { key: "tempoMinutos", label: "Tempo (minutos)", type: "number", defaultValue: 60 },
  { key: "segmentacao", label: "Segmentacao", type: "text", defaultValue: null, placeholder: "Evento, vendedor, ponto de venda" },
  {
    key: "hotspotId",
    label: "Hotspot",
    type: "select",
    options: hotspots.value.map((hotspot) => ({ label: hotspot.nome, value: hotspot.id })),
  },
  { key: "usado", label: "Usado", type: "checkbox", defaultValue: false },
  { key: "vendido", label: "Vendido", type: "checkbox", defaultValue: false },
  { key: "vendidoEm", label: "Vendido em", type: "text", defaultValue: null, help: "Preenchido automaticamente ao marcar como vendido." },
  { key: "mac", label: "MAC", type: "text", defaultValue: null },
  { key: "ip", label: "IP", type: "text", defaultValue: null },
  { key: "usadoEm", label: "Usado em", type: "text", defaultValue: null, help: "Use formato ISO ou deixe vazio." },
]);

const createDisabledReason = computed(() => {
  if (hotspotsLoading.value) return "Carregando hotspots.";
  if (hotspots.value.length === 0) return "Cadastre um hotspot antes de criar vouchers.";
  return undefined;
});
const batchUnavailable = computed(() => hotspotsLoading.value || hotspots.value.length === 0);

async function generateBatch(): Promise<void> {
  if (!batch.hotspotId) {
    toast.error("Selecione um hotspot", "Escolha o hotspot antes de gerar o lote de vouchers.");
    return;
  }

  saving.value = true;
  try {
    await api.post("/vouchers/generate", {
      hotspotId: batch.hotspotId,
      prefixo: batch.prefixo,
      segmentacao: batch.segmentacao,
      quantidade: Number(batch.quantidade),
      tempoMinutos: Number(batch.tempoMinutos),
    });
    batchOpen.value = false;
    toast.success("Lote gerado", `${Number(batch.quantidade)} voucher(s) criado(s).`);
    await crud.value?.loadItems();
  } catch (requestError) {
    toast.error("Nao foi possivel gerar os vouchers", requestError instanceof ApiError ? requestError.message : "Nao foi possivel gerar os vouchers.");
  } finally {
    saving.value = false;
  }
}

function canDeleteVoucher(item: CrudRecord): boolean {
  return !item.usado;
}

async function markSold(id: string, reload: () => Promise<void>): Promise<void> {
  try {
    await api.post(`/vouchers/${id}/sell`);
    toast.success("Voucher vendido", "O voucher foi marcado como vendido.");
    await reload();
  } catch (requestError) {
    toast.error("Nao foi possivel vender", requestError instanceof ApiError ? requestError.message : "Nao foi possivel marcar o voucher como vendido.");
  }
}

onMounted(async () => {
  try {
    hotspots.value = await api.get<HotspotOption[]>("/hotspots-options");
    if (!batch.hotspotId && hotspots.value[0]) {
      batch.hotspotId = hotspots.value[0].id;
    }
  } finally {
    hotspotsLoading.value = false;
  }
});
</script>
