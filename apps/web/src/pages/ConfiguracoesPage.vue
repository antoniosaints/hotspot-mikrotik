<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Sistema</p>
      <h2 class="mt-1 text-2xl font-semibold tracking-tight">Configuracoes</h2>
      <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
        Termos de uso, politica de privacidade e conformidade LGPD do portal. Estes textos sao o padrao de todos os
        hotspots; cada hotspot pode sobrescreve-los na aba Personalizacao.
      </p>
    </div>

    <div class="flex flex-wrap gap-1 rounded-md border border-border bg-muted p-1">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="focus-ring rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
        :class="activeTab === tab.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        type="button"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Termos & LGPD -->
    <Card v-if="activeTab === 'lgpd'">
      <div v-if="loading" class="py-10 text-center text-sm text-muted-foreground">Carregando configuracoes...</div>
      <form v-else class="grid gap-5" @submit.prevent="save">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <Label for="empresaNome">Empresa (controladora)</Label>
            <Input id="empresaNome" v-model="form.empresaNome" class="mt-2" placeholder="CAS Internet LTDA" />
          </div>
          <div>
            <Label for="empresaDocumento">CNPJ</Label>
            <Input id="empresaDocumento" v-model="form.empresaDocumento" class="mt-2" placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <Label for="encarregadoNome">Encarregado de dados (DPO)</Label>
            <Input id="encarregadoNome" v-model="form.encarregadoNome" class="mt-2" placeholder="Nome do responsavel" />
          </div>
          <div>
            <Label for="encarregadoEmail">Email do encarregado</Label>
            <Input id="encarregadoEmail" v-model="form.encarregadoEmail" class="mt-2" placeholder="privacidade@empresa.com.br" />
          </div>
        </div>

        <div>
          <Label for="termosUso">Termos de uso</Label>
          <textarea id="termosUso" v-model="form.termosUso" :class="textareaClass" rows="8" placeholder="Texto completo dos termos de uso do portal..."></textarea>
        </div>

        <div>
          <Label for="politicaPrivacidade">Politica de privacidade</Label>
          <textarea id="politicaPrivacidade" v-model="form.politicaPrivacidade" :class="textareaClass" rows="8" placeholder="Texto completo da politica de privacidade..."></textarea>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <Label for="lgpdConsentimentoTexto">Texto do consentimento (checkbox)</Label>
            <Input id="lgpdConsentimentoTexto" v-model="form.lgpdConsentimentoTexto" class="mt-2" />
            <p class="mt-1 text-xs text-muted-foreground">Frase exibida ao lado da caixa de aceite no portal.</p>
          </div>
          <div>
            <Label for="lgpdVersao">Versao dos termos</Label>
            <Input id="lgpdVersao" v-model="form.lgpdVersao" class="mt-2" placeholder="1" />
            <p class="mt-1 text-xs text-muted-foreground">Incremente ao alterar os textos; e gravada em cada aceite.</p>
          </div>
          <label class="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-primary/60">
            <input v-model="form.exigirConsentimento" class="mt-1 h-4 w-4 flex-none accent-blue-500" type="checkbox" />
            <span>
              <span class="block text-sm font-semibold text-foreground">Exigir consentimento no portal</span>
              <span class="mt-1 block text-xs leading-5 text-muted-foreground">Bloqueia o login ate o cliente aceitar os termos.</span>
            </span>
          </label>
        </div>

        <div class="flex justify-end">
          <Button type="submit" :disabled="saving">{{ saving ? "Salvando..." : "Salvar configuracoes" }}</Button>
        </div>
      </form>
    </Card>

    <!-- Consentimentos -->
    <template v-else-if="activeTab === 'consentimentos'">
      <div class="flex justify-end">
        <Button variant="secondary" @click="loadConsentimentos">
          <RefreshCw class="h-4 w-4" />
          Recarregar
        </Button>
      </div>
      <Card>
        <div v-if="consentimentosLoading" class="py-10 text-center text-sm text-muted-foreground">Carregando registros...</div>
        <Table v-else>
          <thead class="bg-muted/60">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Hotspot</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Data/Hora</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Versao</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">IP</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">MAC</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="consentimentos.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum consentimento registrado ainda.</td>
            </tr>
            <tr v-for="registro in consentimentos" :key="registro.id" class="bg-card/40">
              <td class="px-4 py-3 text-sm text-foreground">{{ registro.hotspot?.nome ?? "-" }}</td>
              <td class="px-4 py-3 text-sm">{{ formatDate(registro.aceitoEm) }}</td>
              <td class="px-4 py-3 text-sm"><Badge variant="secondary">v{{ registro.versaoTermos }}</Badge></td>
              <td class="px-4 py-3 text-sm text-muted-foreground">{{ registro.ip ?? "-" }}</td>
              <td class="px-4 py-3 text-sm text-muted-foreground">{{ registro.mac ?? "-" }}</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </template>

    <!-- Dados / manutencao -->
    <template v-else-if="activeTab === 'dados'">
      <Alert variant="destructive">
        As acoes abaixo sao <strong>irreversiveis</strong>. Os dados removidos nao podem ser recuperados. Use com cuidado.
      </Alert>

      <Card>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold">Apagar acessos</h3>
            <p class="mt-1 max-w-xl text-sm text-muted-foreground">
              Remove todo o historico de conexoes (logins por voucher, CPF, IXC, compra e contratacao). Nao afeta hotspots,
              vouchers nem dispositivos.
            </p>
          </div>
          <Button variant="destructive" class="sm:flex-none" @click="openReset('acessos')">Apagar acessos</Button>
        </div>
      </Card>

      <Card>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold">Apagar prospeccoes</h3>
            <p class="mt-1 max-w-xl text-sm text-muted-foreground">
              Remove os leads do "Quero contratar" e as compras/prospeccoes de tickets.
            </p>
          </div>
          <Button variant="destructive" class="sm:flex-none" @click="openReset('prospeccoes')">Apagar prospeccoes</Button>
        </div>
      </Card>

      <Card>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold">Resetar base</h3>
            <p class="mt-1 max-w-xl text-sm text-muted-foreground">
              Apaga todos os dados operacionais (acessos, dispositivos, vouchers, logins CPF, prospeccoes e consentimentos).
              Voce escolhe quais estruturas manter.
            </p>
          </div>
          <Button variant="destructive" class="sm:flex-none" @click="openReset('base')">Resetar base</Button>
        </div>
      </Card>
    </template>
  </div>

  <Dialog v-model:open="resetOpen" :title="resetTitle" width-class="max-w-lg">
    <div class="space-y-4">
      <Alert variant="destructive">{{ resetWarning }}</Alert>

      <div v-if="resetTipo === 'base'">
        <p class="mb-2 text-sm font-medium">Manter (nao apagar):</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <label v-for="opt in keepOptions" :key="opt.key" class="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
            <input v-model="resetKeep[opt.key]" type="checkbox" class="h-4 w-4 accent-blue-500" />
            {{ opt.label }}
          </label>
        </div>
        <p v-if="resetBlocked" class="mt-2 text-xs text-amber-500">
          Para remover equipamentos ou locais, tambem e preciso remover os hotspots.
        </p>
      </div>

      <div>
        <Label for="resetConfirm">Digite <strong>RESETAR</strong> para confirmar</Label>
        <Input id="resetConfirm" v-model="resetConfirmText" class="mt-2" placeholder="RESETAR" autocomplete="off" />
      </div>
    </div>
    <template #footer>
      <Button variant="outline" @click="resetOpen = false">Cancelar</Button>
      <Button variant="destructive" :disabled="!canConfirmReset" @click="confirmReset">
        {{ resetBusy ? "Apagando..." : "Confirmar exclusao" }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { computed, onMounted, reactive, ref, watch } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError, getCurrentRole } from "@/services/api";
import { toast } from "@/services/toast";
import type { Configuracao, ConsentimentoLgpd } from "@/types/hotspot";

const textareaClass =
  "mt-2 flex w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// A aba "Dados" (reset destrutivo) e exclusiva do admin; manager ve o restante.
const isAdmin = computed(() => getCurrentRole() === "admin");
const tabs = computed(() => [
  { label: "Termos & LGPD", value: "lgpd" },
  { label: "Consentimentos", value: "consentimentos" },
  ...(isAdmin.value ? [{ label: "Dados", value: "dados" }] : []),
]);

const activeTab = ref<string>("lgpd");
const loading = ref(true);
const saving = ref(false);
const error = ref("");

const form = reactive({
  termosUso: "",
  politicaPrivacidade: "",
  lgpdConsentimentoTexto: "",
  lgpdVersao: "1",
  exigirConsentimento: true,
  encarregadoNome: "",
  encarregadoEmail: "",
  empresaNome: "",
  empresaDocumento: "",
});

const consentimentos = ref<ConsentimentoLgpd[]>([]);
const consentimentosLoading = ref(false);
let consentimentosLoaded = false;

// --- Reset de dados ---
type ResetTipo = "acessos" | "prospeccoes" | "base";
type KeepKey = "equipamentos" | "hotspots" | "usuarios" | "planos" | "campanhas" | "locais";

const keepOptions: Array<{ key: KeepKey; label: string }> = [
  { key: "equipamentos", label: "Equipamentos" },
  { key: "hotspots", label: "Hotspots" },
  { key: "usuarios", label: "Usuarios" },
  { key: "planos", label: "Planos" },
  { key: "campanhas", label: "Campanhas" },
  { key: "locais", label: "Locais" },
];

const resetOpen = ref(false);
const resetTipo = ref<ResetTipo>("acessos");
const resetConfirmText = ref("");
const resetBusy = ref(false);
const resetKeep = reactive<Record<KeepKey, boolean>>({
  equipamentos: true,
  hotspots: true,
  usuarios: true,
  planos: true,
  campanhas: true,
  locais: true,
});

const resetTitle = computed(() => {
  if (resetTipo.value === "acessos") return "Apagar acessos";
  if (resetTipo.value === "prospeccoes") return "Apagar prospeccoes";
  return "Resetar base";
});

const resetWarning = computed(() => {
  if (resetTipo.value === "acessos") return "Todo o historico de conexoes sera apagado permanentemente.";
  if (resetTipo.value === "prospeccoes") return "Todos os leads e compras/prospeccoes serao apagados permanentemente.";
  return "Todos os dados operacionais serao apagados. As estruturas nao marcadas em 'Manter' tambem serao removidas.";
});

const resetBlocked = computed(
  () => resetTipo.value === "base" && resetKeep.hotspots && (!resetKeep.equipamentos || !resetKeep.locais),
);

const canConfirmReset = computed(
  () => !resetBusy.value && !resetBlocked.value && resetConfirmText.value.trim().toUpperCase() === "RESETAR",
);

function openReset(tipo: ResetTipo): void {
  resetTipo.value = tipo;
  resetConfirmText.value = "";
  error.value = "";
  if (tipo === "base") {
    for (const opt of keepOptions) resetKeep[opt.key] = true;
  }
  resetOpen.value = true;
}

async function confirmReset(): Promise<void> {
  if (!canConfirmReset.value) return;
  resetBusy.value = true;
  error.value = "";
  try {
    const body =
      resetTipo.value === "base" ? { tipo: "base", manter: { ...resetKeep } } : { tipo: resetTipo.value };
    const result = await api.post<{ contagens: Record<string, number> }>("/manutencao/reset", body);
    const total = Object.values(result.contagens ?? {}).reduce((sum, value) => sum + value, 0);
    toast.success(resetTitle.value, `${total} registro(s) removido(s).`);
    resetOpen.value = false;
  } catch (requestError) {
    toast.error("Nao foi possivel concluir o reset", requestError instanceof ApiError ? requestError.message : "Nao foi possivel concluir o reset.");
  } finally {
    resetBusy.value = false;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

async function loadConfig(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const config = await api.get<Configuracao>("/config");
    form.termosUso = config.termosUso ?? "";
    form.politicaPrivacidade = config.politicaPrivacidade ?? "";
    form.lgpdConsentimentoTexto = config.lgpdConsentimentoTexto ?? "";
    form.lgpdVersao = config.lgpdVersao ?? "1";
    form.exigirConsentimento = config.exigirConsentimento;
    form.encarregadoNome = config.encarregadoNome ?? "";
    form.encarregadoEmail = config.encarregadoEmail ?? "";
    form.empresaNome = config.empresaNome ?? "";
    form.empresaDocumento = config.empresaDocumento ?? "";
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar as configuracoes.";
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  error.value = "";
  try {
    await api.put("/config", {
      termosUso: form.termosUso,
      politicaPrivacidade: form.politicaPrivacidade,
      lgpdConsentimentoTexto: form.lgpdConsentimentoTexto,
      lgpdVersao: form.lgpdVersao,
      exigirConsentimento: form.exigirConsentimento,
      encarregadoNome: form.encarregadoNome || null,
      encarregadoEmail: form.encarregadoEmail || null,
      empresaNome: form.empresaNome || null,
      empresaDocumento: form.empresaDocumento || null,
    });
    toast.success("Configuracoes salvas", "As configuracoes foram atualizadas com sucesso.");
  } catch (requestError) {
    toast.error("Nao foi possivel salvar", requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar.");
  } finally {
    saving.value = false;
  }
}

async function loadConsentimentos(): Promise<void> {
  consentimentosLoading.value = true;
  error.value = "";
  try {
    consentimentos.value = await api.get<ConsentimentoLgpd[]>("/config/consentimentos");
    consentimentosLoaded = true;
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar os consentimentos.";
  } finally {
    consentimentosLoading.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === "consentimentos" && !consentimentosLoaded) void loadConsentimentos();
});

onMounted(loadConfig);
</script>
