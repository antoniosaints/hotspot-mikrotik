<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Comercial</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Prospeccoes</h2>
        <p class="mt-1 text-sm text-muted-foreground">Compradores que preencheram dados durante a compra de tickets.</p>
      </div>
      <Button variant="secondary" @click="loadItems">
        <RefreshCw class="h-4 w-4" />
        Recarregar
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <Card>
      <Table>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Contato</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">CPF</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Endereco</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Plano</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Data</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="items.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma prospeccao encontrada.</td>
          </tr>
          <tr v-for="item in items" :key="item.id">
            <td class="px-4 py-3 text-sm">
              <div class="font-medium">{{ item.nome ?? "-" }}</div>
              <div class="text-xs text-muted-foreground">{{ item.telefone ?? "-" }} / {{ item.email ?? "-" }}</div>
            </td>
            <td class="px-4 py-3 text-sm">{{ item.cpf ?? "-" }}</td>
            <td class="px-4 py-3 text-sm">{{ item.endereco ?? "-" }}</td>
            <td class="px-4 py-3 text-sm">{{ item.plano?.nome ?? "-" }} / {{ item.hotspot?.nome ?? "-" }}</td>
            <td class="px-4 py-3"><Badge>{{ item.status }}</Badge></td>
            <td class="px-4 py-3 text-sm">{{ formatDate(item.criadoEm) }}</td>
          </tr>
        </tbody>
      </Table>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { onMounted, ref } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";
import type { CompraAcesso } from "@/types/hotspot";

const items = ref<CompraAcesso[]>([]);
const error = ref("");

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

async function loadItems(): Promise<void> {
  error.value = "";
  try {
    items.value = await api.get<CompraAcesso[]>("/prospeccoes");
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar prospeccoes.";
  }
}

onMounted(loadItems);
</script>
