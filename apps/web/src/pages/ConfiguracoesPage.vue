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
    <Alert v-if="savedMessage" variant="default">{{ savedMessage }}</Alert>

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
    <template v-else>
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
  </div>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { onMounted, reactive, ref, watch } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";
import type { Configuracao, ConsentimentoLgpd } from "@/types/hotspot";

const textareaClass =
  "mt-2 flex w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const tabs = [
  { label: "Termos & LGPD", value: "lgpd" },
  { label: "Consentimentos", value: "consentimentos" },
] as const;

const activeTab = ref<(typeof tabs)[number]["value"]>("lgpd");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const savedMessage = ref("");

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
  savedMessage.value = "";
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
    savedMessage.value = "Configuracoes salvas com sucesso.";
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar.";
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
  savedMessage.value = "";
  if (tab === "consentimentos" && !consentimentosLoaded) void loadConsentimentos();
});

onMounted(loadConfig);
</script>
