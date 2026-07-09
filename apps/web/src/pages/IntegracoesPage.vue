<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Loja de integracoes</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Apps</h2>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ative e gerencie os aplicativos conectados ao hotspot. Cada app aceita varias configuracoes sem alterar os
          fluxos atuais de equipamentos, hotspots, pagamentos e IA.
        </p>
      </div>
      <Button variant="secondary" @click="loadIntegracoes">
        <RefreshCw class="h-4 w-4" />
        Recarregar
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div class="grid gap-4 lg:grid-cols-3">
      <Card
        v-for="app in apps"
        :key="app.tipo"
        class="group overflow-hidden border-border/80 bg-card/80 p-0 transition-colors hover:border-primary/60"
      >
        <button class="block h-full w-full p-5 text-left" type="button" @click="openApp(app.tipo)">
          <div class="flex items-start justify-between gap-3">
            <span class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              <img :src="app.imageUrl" :alt="app.nome" class="h-full w-full object-cover" />
            </span>
            <Badge :variant="activeCount(app.tipo) > 0 ? 'default' : 'secondary'">
              {{ activeCount(app.tipo) > 0 ? "Ativo" : "Disponivel" }}
            </Badge>
          </div>
          <div class="mt-5">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-foreground">{{ app.nome }}</h3>
              <span class="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {{ app.categoria }}
              </span>
            </div>
            <p class="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{{ app.descricao }}</p>
          </div>
          <div class="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
            <span class="text-xs text-muted-foreground">{{ configsByTipo(app.tipo).length }} configuracao(oes)</span>
            <span class="text-sm font-medium text-accent">Gerenciar</span>
          </div>
        </button>
      </Card>
    </div>

    <Card>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-sm font-semibold">Configuracoes cadastradas</h3>
          <p class="mt-1 text-sm text-muted-foreground">Resumo de todos os apps ativos e inativos.</p>
        </div>
        <Badge variant="secondary">{{ integracoes.length }} total</Badge>
      </div>
      <Table class="mt-4">
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">App</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Detalhe</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Status</th>
            <th class="w-28 px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Acoes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="!loading && integracoes.length === 0">
            <td colspan="5" class="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum app configurado ainda.</td>
          </tr>
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-10 text-center text-sm text-muted-foreground">Carregando apps...</td>
          </tr>
          <tr v-for="item in integracoes" v-else :key="item.id" class="bg-card/40">
            <td class="px-4 py-3 text-sm font-medium">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                  <img :src="appMeta(item.tipo).imageUrl" :alt="appMeta(item.tipo).nome" class="h-full w-full object-cover" />
                </span>
                {{ appMeta(item.tipo).nome }}
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-foreground">{{ item.nome }}</td>
            <td class="px-4 py-3 text-sm text-muted-foreground">{{ integrationDetail(item) }}</td>
            <td class="px-4 py-3 text-sm">
              <Badge :variant="item.ativo ? 'default' : 'secondary'">{{ item.ativo ? "Ativo" : "Inativo" }}</Badge>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <Button size="icon" variant="ghost" aria-label="Editar" @click="openEdit(item)">
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Apagar" @click="removeIntegracao(item)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </Table>
    </Card>
  </div>

  <Dialog v-model:open="modalOpen" :title="modalTitle" :description="modalDescription" width-class="max-w-3xl">
    <div class="space-y-5">
      <div v-if="selectedApp" class="rounded-lg border border-border bg-muted/30 p-4">
        <div class="flex items-start gap-3">
          <span class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            <img :src="selectedApp.imageUrl" :alt="selectedApp.nome" class="h-full w-full object-cover" />
          </span>
          <div>
            <h3 class="text-sm font-semibold">{{ selectedApp.nome }}</h3>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">{{ selectedApp.hint }}</p>
          </div>
        </div>
      </div>

      <form id="app-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveIntegracao">
        <div class="sm:col-span-2">
          <Label for="nome">Nome da configuracao</Label>
          <Input id="nome" v-model="form.nome" class="mt-2" :placeholder="selectedApp?.placeholderNome" />
        </div>

        <template v-if="form.tipo === 'IXC'">
          <div class="sm:col-span-2">
            <Label for="baseUrl">URL da integracao IXC</Label>
            <Input id="baseUrl" v-model="form.baseUrl" class="mt-2" placeholder="https://ixc.seudominio.com.br/webservice/v1" />
          </div>
          <div>
            <Label for="usuario">Usuario IXC</Label>
            <Input id="usuario" v-model="form.usuario" class="mt-2" />
          </div>
          <div>
            <Label for="senha">Senha IXC</Label>
            <Input id="senha" v-model="form.senha" class="mt-2" type="password" />
          </div>
        </template>

        <template v-else-if="form.tipo === 'MERCADO_PAGO'">
          <div class="sm:col-span-2">
            <Label for="token">Token Mercado Pago</Label>
            <Input id="token" v-model="form.token" class="mt-2" type="password" placeholder="APP_USR-..." />
          </div>
          <div class="sm:col-span-2">
            <Label for="chaveWebhook">Chave webhook Mercado Pago</Label>
            <Input id="chaveWebhook" v-model="form.chaveWebhook" class="mt-2" type="password" />
          </div>
        </template>

        <template v-else>
          <div>
            <Label for="baseUrl">Modelo Gemini</Label>
            <Input id="baseUrl" v-model="form.baseUrl" class="mt-2" placeholder="gemini-1.5-flash" />
          </div>
          <div>
            <Label for="token">API Key Gemini</Label>
            <Input id="token" v-model="form.token" class="mt-2" type="password" />
          </div>
          <div class="sm:col-span-2">
            <p class="rounded-md border border-border bg-background/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
              A Autoajuda usa uma configuracao Gemini ativa para responder duvidas contextuais sem expor a chave no navegador.
            </p>
          </div>
        </template>

        <label class="sm:col-span-2 mt-1 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-primary/60">
          <input v-model="form.ativo" class="mt-1 h-4 w-4 flex-none accent-blue-500" type="checkbox" />
          <span>
            <span class="block text-sm font-semibold text-foreground">Ativar app</span>
            <span class="mt-1 block text-xs leading-5 text-muted-foreground">{{ selectedApp?.activationText }}</span>
          </span>
        </label>
      </form>

      <div>
        <h4 class="mb-2 text-sm font-semibold">Configuracoes deste app</h4>
        <div class="overflow-hidden rounded-lg border border-border">
          <Table>
            <tbody class="divide-y divide-border">
              <tr v-if="selectedConfigs.length === 0">
                <td class="px-4 py-6 text-sm text-muted-foreground">Nenhuma configuracao cadastrada para este app.</td>
              </tr>
              <tr v-for="item in selectedConfigs" :key="item.id" class="bg-card/40">
                <td class="px-4 py-3">
                  <p class="text-sm font-medium text-foreground">{{ item.nome }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ integrationDetail(item) }}</p>
                </td>
                <td class="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" aria-label="Editar" @click="openEdit(item)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" @click="modalOpen = false">Fechar</Button>
      <Button type="submit" form="app-form" :disabled="saving">{{ saving ? "Salvando..." : saveLabel }}</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Pencil, RefreshCw, Trash2 } from "lucide-vue-next";
import { computed, onMounted, reactive, ref } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";
import { toast } from "@/services/toast";
import type { Integracao } from "@/types/hotspot";

type AppTipo = Integracao["tipo"];
type AppMeta = {
  tipo: AppTipo;
  nome: string;
  categoria: string;
  descricao: string;
  hint: string;
  placeholderNome: string;
  activationText: string;
  imageUrl: string;
};

type IntegrationForm = {
  nome: string;
  tipo: AppTipo;
  baseUrl: string;
  usuario: string;
  senha: string;
  token: string;
  chaveWebhook: string;
  ativo: boolean;
};

const apps: AppMeta[] = [
  {
    tipo: "MERCADO_PAGO",
    nome: "Mercado Pago",
    categoria: "Pagamentos",
    descricao: "Receba compras online de planos via Pix e libere o acesso apos a confirmacao do pagamento.",
    hint: "Use uma ou mais contas Mercado Pago. Hotspots com compra online continuam escolhendo a conta de pagamento no cadastro do hotspot.",
    placeholderNome: "Mercado Pago principal",
    activationText: "Configuracoes ativas ficam disponiveis para compra online nos hotspots.",
    imageUrl: "/img/apps/mercado-pago.png",
  },
  {
    tipo: "IXC",
    nome: "IXC Soft",
    categoria: "ERP",
    descricao: "Consulte clientes no IXC por CPF/CNPJ para habilitar login por base externa no portal.",
    hint: "Cadastre varios servidores IXC quando operar mais de uma base. Cada hotspot escolhe sua integracao de login.",
    placeholderNome: "IXC Provedor",
    activationText: "Configuracoes ativas ficam disponiveis para login por IXC nos hotspots.",
    imageUrl: "/img/apps/ixc-soft.png",
  },
  {
    tipo: "GEMINI",
    nome: "Gemini",
    categoria: "IA",
    descricao: "Responda duvidas contextuais sobre configuracao, apps, campanhas, hotspots, vouchers e fluxos do sistema.",
    hint: "A API Key e o modelo agora ficam no app Gemini. A aba Configuracoes nao precisa mais de campos de Agente.",
    placeholderNome: "Gemini suporte",
    activationText: "Configuracoes ativas podem ser usadas pelo menu flutuante de Autoajuda.",
    imageUrl: "/img/apps/gemini.png",
  },
];

const integracoes = ref<Integracao[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const modalOpen = ref(false);
const selectedTipo = ref<AppTipo>("MERCADO_PAGO");
const editingId = ref<string | null>(null);

const form = reactive<IntegrationForm>({
  nome: "",
  tipo: "MERCADO_PAGO",
  baseUrl: "",
  usuario: "",
  senha: "",
  token: "",
  chaveWebhook: "",
  ativo: true,
});

const selectedApp = computed(() => appMeta(selectedTipo.value));
const selectedConfigs = computed(() => configsByTipo(selectedTipo.value));
const modalTitle = computed(() => `${selectedApp.value.nome} (${selectedApp.value.categoria})`);
const modalDescription = computed(() =>
  editingId.value ? "Edite a configuracao selecionada." : "Crie uma nova configuracao ou escolha uma existente abaixo.",
);
const saveLabel = computed(() => (editingId.value ? "Salvar alteracoes" : "Adicionar configuracao"));

function appMeta(tipo: AppTipo): AppMeta {
  return apps.find((app) => app.tipo === tipo) ?? apps[0];
}

function configsByTipo(tipo: AppTipo): Integracao[] {
  return integracoes.value.filter((item) => item.tipo === tipo);
}

function activeCount(tipo: AppTipo): number {
  return configsByTipo(tipo).filter((item) => item.ativo).length;
}

function resetForm(tipo: AppTipo): void {
  editingId.value = null;
  form.nome = "";
  form.tipo = tipo;
  form.baseUrl = tipo === "GEMINI" ? "gemini-1.5-flash" : "";
  form.usuario = "";
  form.senha = "";
  form.token = "";
  form.chaveWebhook = "";
  form.ativo = true;
}

function openApp(tipo: AppTipo): void {
  selectedTipo.value = tipo;
  resetForm(tipo);
  modalOpen.value = true;
}

function openEdit(item: Integracao): void {
  selectedTipo.value = item.tipo;
  editingId.value = item.id;
  form.nome = item.nome;
  form.tipo = item.tipo;
  form.baseUrl = item.baseUrl ?? "";
  form.usuario = item.usuario ?? "";
  form.senha = item.senha ?? "";
  form.token = item.token ?? "";
  form.chaveWebhook = item.chaveWebhook ?? "";
  form.ativo = item.ativo;
  modalOpen.value = true;
}

function cleanValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function integrationDetail(item: Integracao): string {
  if (item.tipo === "IXC") return item.baseUrl || "Servidor IXC sem URL";
  if (item.tipo === "MERCADO_PAGO") return item.token ? "Token configurado" : "Token pendente";
  return item.baseUrl ? `Modelo ${item.baseUrl}` : "Modelo nao definido";
}

async function loadIntegracoes(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    integracoes.value = await api.get<Integracao[]>("/integracoes");
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar os apps.";
  } finally {
    loading.value = false;
  }
}

async function saveIntegracao(): Promise<void> {
  saving.value = true;
  error.value = "";
  try {
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      baseUrl: form.tipo === "IXC" || form.tipo === "GEMINI" ? cleanValue(form.baseUrl) : null,
      usuario: form.tipo === "IXC" ? cleanValue(form.usuario) : null,
      senha: form.tipo === "IXC" ? cleanValue(form.senha) : null,
      token: form.tipo === "MERCADO_PAGO" || form.tipo === "GEMINI" ? cleanValue(form.token) : null,
      chaveWebhook: form.tipo === "MERCADO_PAGO" ? cleanValue(form.chaveWebhook) : null,
      ativo: form.ativo,
    };

    if (editingId.value) {
      await api.put(`/integracoes/${editingId.value}`, payload);
    } else {
      await api.post("/integracoes", payload);
    }

    resetForm(selectedTipo.value);
    toast.success("App salvo", "A configuracao do app foi salva com sucesso.");
    await loadIntegracoes();
  } catch (requestError) {
    toast.error("Nao foi possivel salvar o app", requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar o app.");
  } finally {
    saving.value = false;
  }
}

async function removeIntegracao(item: Integracao): Promise<void> {
  if (!window.confirm(`Apagar ${item.nome}?`)) return;
  error.value = "";
  try {
    await api.delete(`/integracoes/${item.id}`);
    toast.success("App apagado", `${item.nome} foi removido.`);
    await loadIntegracoes();
  } catch (requestError) {
    toast.error("Nao foi possivel apagar o app", requestError instanceof ApiError ? requestError.message : "Nao foi possivel apagar o app.");
  }
}

onMounted(loadIntegracoes);
</script>
