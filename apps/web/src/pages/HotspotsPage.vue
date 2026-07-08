<template>
  <CrudPage
    title="Hotspots"
    singular-title="hotspot"
    description="Redes publicadas no portal, com login por voucher e CPF."
    endpoint="/hotspots"
    :columns="columns"
    :fields="fields"
    :form-tabs="formTabs"
    modal-width-class="max-w-4xl"
    form-description="Configure identidade, vinculos, metodos de acesso e planos deste portal."
    :create-disabled="optionsLoading || locais.length === 0 || mikrotiks.length === 0"
    :create-disabled-reason="createDisabledReason"
  >
    <template #row-actions="{ item, reload }">
      <Button size="icon" variant="ghost" aria-label="Acessar portal" title="Acessar portal" @click="openPortal(item)">
        <ExternalLink class="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Clonar"
        title="Clonar hotspot"
        :disabled="cloningId === item.id"
        @click="cloneHotspot(item, reload)"
      >
        <Copy class="h-4 w-4" />
      </Button>
    </template>
  </CrudPage>
</template>

<script setup lang="ts">
import { Copy, ExternalLink } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import CrudPage, {
  type CrudColumn,
  type CrudField,
  type CrudFormTab,
  type CrudFormValue,
  type CrudRecord,
} from "@/pages/CrudPage.vue";
import { api, ApiError } from "@/services/api";
import type { CadastroTela, Integracao, Local, Mikrotik, MikrotikHotspotServer } from "@/types/hotspot";

const locais = ref<Local[]>([]);
const mikrotiks = ref<Mikrotik[]>([]);
const integracoes = ref<Integracao[]>([]);
const cadastrosTelas = ref<CadastroTela[]>([]);
const optionsLoading = ref(true);

// Cache de servidores hotspot por MikroTik, carregado sob demanda quando o
// MikroTik e selecionado no formulario.
const serverCache = ref<Record<string, MikrotikHotspotServer[] | "loading" | "error">>({});

function serversFor(mikrotikId: string): MikrotikHotspotServer[] {
  const cached = serverCache.value[mikrotikId];
  if (cached === undefined) {
    serverCache.value[mikrotikId] = "loading";
    api
      .get<{ servers: MikrotikHotspotServer[] }>(`/mikrotiks/${mikrotikId}/servers`)
      .then((response) => {
        serverCache.value[mikrotikId] = response.servers;
      })
      .catch(() => {
        serverCache.value[mikrotikId] = "error";
      });
    return [];
  }

  return Array.isArray(cached) ? cached : [];
}

function servidorHotspotOptions(form: Record<string, CrudFormValue>) {
  const mikrotikId = typeof form.mikrotikId === "string" ? form.mikrotikId : "";
  const currentValue = typeof form.servidorHotspot === "string" ? form.servidorHotspot : "";
  const options = [{ label: "Todos os servidores (sem separacao)", value: "" }];

  if (!mikrotikId) return options;

  const servers = serversFor(mikrotikId);
  options.push(
    ...servers.map((server) => ({
      label: server.interface ? `${server.name} (${server.interface})` : server.name,
      value: server.name,
    })),
  );

  if (serverCache.value[mikrotikId] === "loading") {
    options[0] = { label: "Carregando servidores do MikroTik...", value: "" };
  } else if (serverCache.value[mikrotikId] === "error") {
    options[0] = { label: "Falha ao consultar o MikroTik (sem separacao)", value: "" };
  }

  // Mantem o valor salvo visivel mesmo se o MikroTik estiver inacessivel.
  if (currentValue && !options.some((option) => option.value === currentValue)) {
    options.push({ label: currentValue, value: currentValue });
  }

  return options;
}

// A URL do portal e sempre derivada do slug para evitar divergencia entre o
// endereco salvo e a rota real (/portal/:slug). Usa a origem do painel, que e o
// mesmo frontend que serve o portal publico.
function portalUrlForSlug(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal/${encodeURIComponent(trimmed)}`;
}

function portalUrlFromSlug(form: Record<string, CrudFormValue>): string {
  return portalUrlForSlug(typeof form.slug === "string" ? form.slug : "");
}

const cloningId = ref<string | null>(null);

function openPortal(item: CrudRecord): void {
  const url = portalUrlForSlug(typeof item.slug === "string" ? item.slug : "");
  if (!url) return;
  window.open(url, "_blank", "noopener");
}

// Campos copiados ao clonar (todo o schema de criacao, exceto nome/slug/portalUrl
// que sao regenerados e servidorHotspot que precisa ficar vazio no clone).
// Nao inclui servidorHotspot: o banco tem @@unique([mikrotikId, servidorHotspot]),
// entao dois hotspots no mesmo MikroTik nao podem apontar para o mesmo servidor.
// O clone nasce sem servidor definido (= "todos os servidores"), para o usuario
// reatribuir a um servidor livre ou a outro MikroTik.
const CLONE_FIELDS = [
  "portalLogoUrl", "portalTitulo", "portalSubtitulo", "portalRodape",
  "portalCorFundo", "portalCorFundoFim", "portalCorTexto", "urlPosLogin",
  "loginVoucher", "loginCpf", "loginIntegracao", "integracaoTempoMinutos",
  "compraOnline", "compraPersonalizada", "valorMinutoCentavos",
  "tempoPersonalizadoMinimo", "tempoPersonalizadoMaximo", "tempoPersonalizadoPasso",
  "conexoesPersonalizado", "ativo",
  "localId", "mikrotikId", "integracaoId", "pagamentoIntegracaoId", "cadastroTelaId",
] as const;

async function cloneHotspot(item: CrudRecord, reload: () => Promise<void> | void): Promise<void> {
  if (cloningId.value) return;
  cloningId.value = String(item.id);
  try {
    // Busca a lista fresca para gerar um slug unico (slug e @unique no banco).
    const existing = await api.get<Array<{ slug: string }>>("/hotspots");
    const usados = new Set(existing.map((hotspot) => hotspot.slug));
    const base = `${String(item.slug ?? "hotspot")}-copia`;
    let slug = base;
    let contador = 2;
    while (usados.has(slug)) slug = `${base}-${contador++}`;

    const payload: Record<string, unknown> = {
      nome: `${String(item.nome ?? "Hotspot")} (copia)`,
      slug,
      portalUrl: portalUrlForSlug(slug),
    };
    for (const key of CLONE_FIELDS) {
      if (item[key] !== undefined) payload[key] = item[key];
    }

    await api.post("/hotspots", payload);
    await reload();

    if (typeof item.servidorHotspot === "string" && item.servidorHotspot.trim()) {
      window.alert(
        `Hotspot clonado como "${payload.nome}". O servidor hotspot ficou em branco porque cada servidor so pode pertencer a um hotspot no mesmo MikroTik. Edite o clone para escolher um servidor livre.`,
      );
    }
  } catch (error) {
    window.alert(error instanceof ApiError ? error.message : "Nao foi possivel clonar o hotspot.");
  } finally {
    cloningId.value = null;
  }
}

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "local.nome", label: "Local" },
  { key: "mikrotik.nome", label: "MikroTik" },
  { key: "servidorHotspot", label: "Servidor" },
  { key: "integracao.nome", label: "Integracao" },
  { key: "pagamentoIntegracao.nome", label: "Pagamento" },
  { key: "urlPosLogin", label: "Pos-login" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const formTabs: CrudFormTab[] = [
  {
    value: "geral",
    label: "Geral",
    description: "Dados publicos usados no painel, no arquivo exportado do MikroTik e na URL do portal.",
  },
  {
    value: "personalizacao",
    label: "Personalizacao",
    description: "Customize logo, textos e cores do portal publico deste hotspot. Campos vazios usam o padrao CAS.",
  },
  {
    value: "vinculos",
    label: "Vinculos",
    description: "Defina em qual local o hotspot aparece e qual MikroTik recebera os usuarios liberados.",
  },
  {
    value: "acesso",
    label: "Acesso",
    description: "Ative apenas as formas de login que devem aparecer para o cliente no portal.",
  },
  {
    value: "planos",
    label: "Planos",
    description: "Controle a venda de planos online por PIX. Os planos sao configurados na tela Planos.",
  },
];

const fields = computed<CrudField[]>(() => [
  { key: "nome", label: "Nome", type: "text", tab: "geral" },
  { key: "slug", label: "Slug", type: "text", tab: "geral", placeholder: "unidade-centro" },
  {
    key: "portalUrl",
    label: "URL do portal",
    type: "text",
    tab: "geral",
    full: true,
    placeholder: "Preencha o slug para gerar a URL",
    derivedValue: portalUrlFromSlug,
    help: "Gerada automaticamente a partir do slug. Use este endereco no login.html do MikroTik.",
  },
  {
    key: "urlPosLogin",
    label: "URL pos-login",
    type: "text",
    tab: "geral",
    full: true,
    placeholder: "https://www.seusite.com.br",
    help: "Opcional. Quando vazio, o MikroTik usa o destino original do cliente.",
  },
  {
    key: "ativo",
    label: "Hotspot ativo",
    type: "checkbox-card",
    tab: "geral",
    full: true,
    defaultValue: true,
    help: "Desative para impedir novos acessos pelo portal.",
  },
  {
    key: "portalLogoUrl",
    label: "Logo do portal",
    type: "image",
    tab: "personalizacao",
    full: true,
    defaultValue: "",
    help: "Escolha uma imagem ja enviada ou faca upload de uma nova. Vazio usa a logo padrao.",
  },
  {
    key: "portalTitulo",
    label: "Titulo do portal",
    type: "text",
    tab: "personalizacao",
    placeholder: "ACESSO CAS INTERNET",
  },
  {
    key: "portalSubtitulo",
    label: "Subtitulo do portal",
    type: "text",
    tab: "personalizacao",
    placeholder: "Conecte-se a internet de forma rapida e segura",
  },
  {
    key: "portalRodape",
    label: "Rodape",
    type: "text",
    tab: "personalizacao",
    full: true,
    placeholder: "CAS Internet - Acesso Hotspot",
  },
  {
    key: "portalCorFundo",
    label: "Cor inicial do fundo",
    type: "color",
    tab: "personalizacao",
    placeholder: "#00aeef",
    help: "Informe uma cor CSS valida. Exemplo: #00aeef.",
  },
  {
    key: "portalCorFundoFim",
    label: "Cor final do fundo",
    type: "color",
    tab: "personalizacao",
    placeholder: "#005e9e",
    help: "Usada no degrade vertical do fundo.",
  },
  {
    key: "portalCorTexto",
    label: "Cor do texto da marca",
    type: "color",
    tab: "personalizacao",
    placeholder: "#ffffff",
  },
  {
    key: "localId",
    label: "Local",
    type: "select",
    tab: "vinculos",
    options: locais.value.map((local) => ({ label: local.nome, value: local.id })),
  },
  {
    key: "mikrotikId",
    label: "MikroTik",
    type: "select",
    tab: "vinculos",
    options: mikrotiks.value.map((mikrotik) => ({ label: mikrotik.nome, value: mikrotik.id })),
  },
  {
    key: "servidorHotspot",
    label: "Servidor hotspot",
    type: "select",
    tab: "vinculos",
    full: true,
    dynamicOptions: servidorHotspotOptions,
    defaultValue: "",
    help: "Servidor de /ip hotspot no MikroTik (ligado a interface do local). Permite varios locais no mesmo roteador: o login.html unico identifica o local pelo servidor de origem, e os usuarios sao criados restritos a ele.",
  },
  {
    key: "cadastroTelaId",
    tab: "acesso",
    label: "Tela do Quero contratar",
    type: "select",
    options: [
      { label: "Desabilitado", value: "" },
      ...cadastrosTelas.value
        .filter((tela) => tela.ativo)
        .map((tela) => ({ label: tela.nome, value: tela.id })),
    ],
    full: true,
    help: "Formulario exibido quando o cliente toca em Quero contratar no portal.",
    defaultValue: "",
  },
  {
    key: "loginVoucher",
    label: "Login por voucher",
    type: "checkbox-card",
    tab: "acesso",
    defaultValue: true,
    help: "Cliente informa um codigo gerado no painel.",
  },
  {
    key: "loginCpf",
    label: "Login por CPF local",
    type: "checkbox-card",
    tab: "acesso",
    defaultValue: true,
    help: "Cliente informa CPF cadastrado em Logins CPF.",
  },
  {
    key: "loginIntegracao",
    label: "Login por integracao",
    type: "checkbox-card",
    tab: "acesso",
    defaultValue: false,
    help: "Cliente informa CPF/CNPJ e o sistema consulta a integracao vinculada.",
  },
  {
    key: "integracaoId",
    label: "Integracao de login",
    type: "select",
    tab: "acesso",
    options: [
      { label: "Nenhuma", value: "" },
      ...integracoes.value
        .filter((integracao) => integracao.tipo === "IXC")
        .map((integracao) => ({ label: integracao.nome, value: integracao.id })),
    ],
    help: "Selecione uma integracao IXC para habilitar login por base externa.",
    visibleWhen: (form) => Boolean(form.loginIntegracao),
    clearWhenHidden: true,
  },
  {
    key: "integracaoTempoMinutos",
    label: "Tempo login integracao (min)",
    type: "number",
    tab: "acesso",
    defaultValue: 60,
    visibleWhen: (form) => Boolean(form.loginIntegracao),
  },
  {
    key: "compraOnline",
    label: "Compra online",
    type: "checkbox-card",
    tab: "planos",
    defaultValue: false,
    help: "Cliente escolhe um dos planos ou um tempo personalizado e paga via PIX.",
  },
  {
    key: "pagamentoIntegracaoId",
    label: "Integracao de pagamento",
    type: "select",
    tab: "planos",
    options: [
      { label: "Nenhuma", value: "" },
      ...integracoes.value
        .filter((integracao) => integracao.tipo === "MERCADO_PAGO")
        .map((integracao) => ({ label: integracao.nome, value: integracao.id })),
    ],
    help: "Selecione Mercado Pago para habilitar compra online.",
    visibleWhen: (form) => Boolean(form.compraOnline),
    clearWhenHidden: true,
  },
  {
    key: "compraPersonalizada",
    label: "Compra personalizada",
    type: "checkbox-card",
    tab: "planos",
    defaultValue: false,
    help: "Mostra uma opcao no final da compra para o cliente escolher o tempo em um controle deslizante.",
    visibleWhen: (form) => Boolean(form.compraOnline),
  },
  {
    key: "valorMinutoCentavos",
    label: "Valor por minuto (centavos)",
    type: "number",
    tab: "planos",
    defaultValue: 10,
    help: "Exemplo: 10 centavos por minuto gera R$ 6,00 em 60 minutos.",
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "tempoPersonalizadoMinimo",
    label: "Tempo minimo personalizado (min)",
    type: "number",
    tab: "planos",
    defaultValue: 10,
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "tempoPersonalizadoMaximo",
    label: "Tempo maximo personalizado (min)",
    type: "number",
    tab: "planos",
    defaultValue: 240,
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "tempoPersonalizadoPasso",
    label: "Incremento do slider (min)",
    type: "number",
    tab: "planos",
    defaultValue: 10,
    help: "Define de quantos em quantos minutos o cliente pode aumentar ou diminuir.",
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "conexoesPersonalizado",
    label: "Conexoes no personalizado",
    type: "number",
    tab: "planos",
    defaultValue: 1,
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
]);

const createDisabledReason = computed(() => {
  if (optionsLoading.value) return "Carregando locais e MikroTiks.";
  if (locais.value.length === 0) return "Cadastre um local antes de criar hotspots.";
  if (mikrotiks.value.length === 0) return "Cadastre um MikroTik antes de criar hotspots.";
  return undefined;
});

onMounted(async () => {
  try {
    [locais.value, mikrotiks.value, integracoes.value, cadastrosTelas.value] = await Promise.all([
      api.get<Local[]>("/locais"),
      api.get<Mikrotik[]>("/mikrotiks"),
      api.get<Integracao[]>("/integracoes"),
      api.get<CadastroTela[]>("/cadastros-telas"),
    ]);
  } finally {
    optionsLoading.value = false;
  }
});
</script>
