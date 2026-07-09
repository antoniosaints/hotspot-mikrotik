<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Comercial</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Prospeccoes</h2>
        <p class="mt-1 text-sm text-muted-foreground">Contatos capturados em compras de tickets e no Quero contratar.</p>
      </div>
      <Button variant="secondary" @click="loadItems">
        <RefreshCw class="h-4 w-4" />
        Recarregar
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <DataTableControls
      v-model:search="searchTerm"
      v-model:page="currentPage"
      v-model:page-size="pageSize"
      :total="items.length"
      :filtered-total="filteredItems.length"
      :total-pages="totalPages"
    />

    <div>
      <Table>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Contato</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Origem</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">CPF</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Endereco</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Plano</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Data</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="filteredItems.length === 0">
            <td colspan="7" class="px-4 py-10 text-center text-sm text-muted-foreground">
              {{ items.length === 0 ? "Nenhuma prospeccao encontrada." : "Nenhuma prospeccao encontrada para a busca." }}
            </td>
          </tr>
          <tr v-for="item in paginatedItems" :key="item.id">
            <td class="px-4 py-3 text-sm">
              <div class="font-medium">{{ item.nome ?? "-" }}</div>
              <div class="text-xs text-muted-foreground">{{ item.telefone ?? item.whatsapp ?? "-" }} / {{ item.email ?? "-" }}</div>
            </td>
            <td class="px-4 py-3 text-sm">{{ item.origem ?? "Compra PIX" }}</td>
            <td class="px-4 py-3 text-sm">{{ item.cpf ?? "-" }}</td>
            <td class="px-4 py-3 text-sm">{{ [item.endereco, item.cidade, item.cep].filter(Boolean).join(" / ") || "-" }}</td>
            <td class="px-4 py-3 text-sm">{{ item.plano?.nome ?? (item.tempoMinutos ? `Personalizado ${item.tempoMinutos} min` : "-") }} / {{ item.hotspot?.nome ?? "-" }}</td>
            <td class="px-4 py-3"><Badge :class="statusBadgeClass(item.status)">{{ item.status }}</Badge></td>
            <td class="px-4 py-3 text-sm">{{ formatDate(item.criadoEm) }}</td>
          </tr>
        </tbody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { computed, onMounted, ref, watch } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import DataTableControls from "@/components/ui/DataTableControls.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";
import type { CompraAcesso } from "@/types/hotspot";

const items = ref<CompraAcesso[]>([]);
const error = ref("");
const searchTerm = ref("");
const currentPage = ref(1);
const pageSize = ref(10);

const filteredItems = computed(() => {
  const term = normalizeSearch(searchTerm.value);
  if (!term) return items.value;

  return items.value.filter((item) => searchText(item).includes(term));
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)));
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function searchText(item: CompraAcesso): string {
  return normalizeSearch(
    [
      item.nome,
      item.telefone,
      item.whatsapp,
      item.email,
      item.origem,
      item.cpf,
      item.endereco,
      item.cidade,
      item.cep,
      item.plano?.nome,
      item.hotspot?.nome,
      item.status,
      item.tempoMinutos ? `Personalizado ${item.tempoMinutos} min` : null,
      formatDate(item.criadoEm),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function statusBadgeClass(status: string): string {
  const normalized = normalizeSearch(status);

  if (["pago", "aprovado", "liberado", "concluido", "finalizado", "efetivado", "encerrada"].some((value) => normalized.includes(value))) {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
  }

  if (["pendente", "aguardando", "processando", "em analise"].some((value) => normalized.includes(value))) {
    return "border-amber-400/30 bg-amber-400/15 text-amber-200";
  }

  if (["cancelado", "expirado", "falha", "erro", "recusado"].some((value) => normalized.includes(value))) {
    return "border-red-500/30 bg-red-500/15 text-red-200";
  }

  if (["contratacao", "interesse", "contato", "novo"].some((value) => normalized.includes(value))) {
    return "border-cyan-400/30 bg-cyan-400/15 text-cyan-100";
  }

  return "border-slate-400/30 bg-slate-400/15 text-slate-200";
}

async function loadItems(): Promise<void> {
  error.value = "";
  try {
    items.value = await api.get<CompraAcesso[]>("/prospeccoes");
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar prospeccoes.";
  }
}

watch([searchTerm, pageSize], () => {
  currentPage.value = 1;
});

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages;
});

onMounted(loadItems);
</script>
