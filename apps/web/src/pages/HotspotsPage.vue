<template>
  <CrudPage
    title="Hotspots"
    singular-title="hotspot"
    description="Redes publicadas no portal, com login por voucher e CPF."
    endpoint="/hotspots"
    :columns="columns"
    :fields="fields"
    modal-width-class="max-w-4xl"
    form-description="Configure identidade, vinculos, metodos de acesso e bilheteria deste portal."
    :create-disabled="optionsLoading || locais.length === 0 || mikrotiks.length === 0"
    :create-disabled-reason="createDisabledReason"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";
import { api } from "@/services/api";
import type { CadastroTela, Integracao, Local, Mikrotik } from "@/types/hotspot";

const locais = ref<Local[]>([]);
const mikrotiks = ref<Mikrotik[]>([]);
const integracoes = ref<Integracao[]>([]);
const cadastrosTelas = ref<CadastroTela[]>([]);
const optionsLoading = ref(true);

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "slug", label: "Slug" },
  { key: "local.nome", label: "Local" },
  { key: "mikrotik.nome", label: "MikroTik" },
  { key: "integracao.nome", label: "Integracao" },
  { key: "pagamentoIntegracao.nome", label: "Pagamento" },
  { key: "cadastroTela.nome", label: "Quero contratar" },
  { key: "urlPosLogin", label: "Pos-login" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const fields = computed<CrudField[]>(() => [
  {
    key: "section-identificacao",
    label: "Identificacao do portal",
    type: "section",
    full: true,
    help: "Dados publicos usados no painel, no arquivo exportado do MikroTik e na URL do portal.",
  },
  { key: "nome", label: "Nome", type: "text" },
  { key: "slug", label: "Slug", type: "text", placeholder: "unidade-centro" },
  { key: "portalUrl", label: "URL do portal", type: "text", full: true, placeholder: "http://localhost:5173/portal/unidade-centro" },
  {
    key: "urlPosLogin",
    label: "URL pos-login",
    type: "text",
    full: true,
    placeholder: "https://www.seusite.com.br",
    help: "Opcional. Quando vazio, o MikroTik usa o destino original do cliente.",
  },
  {
    key: "section-vinculos",
    label: "Vinculos operacionais",
    type: "section",
    full: true,
    help: "Defina em qual local o hotspot aparece e qual MikroTik recebera os usuarios liberados.",
  },
  {
    key: "localId",
    label: "Local",
    type: "select",
    options: locais.value.map((local) => ({ label: local.nome, value: local.id })),
  },
  {
    key: "mikrotikId",
    label: "MikroTik",
    type: "select",
    options: mikrotiks.value.map((mikrotik) => ({ label: mikrotik.nome, value: mikrotik.id })),
  },
  {
    key: "section-acesso",
    label: "Metodos de acesso",
    type: "section",
    full: true,
    help: "Ative apenas as formas de login que devem aparecer para o cliente no portal.",
  },
  {
    key: "cadastroTelaId",
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
    defaultValue: true,
    help: "Cliente informa um codigo gerado no painel.",
  },
  {
    key: "loginCpf",
    label: "Login por CPF local",
    type: "checkbox-card",
    defaultValue: true,
    help: "Cliente informa CPF cadastrado em Logins CPF.",
  },
  {
    key: "loginIntegracao",
    label: "Login por integracao",
    type: "checkbox-card",
    defaultValue: false,
    help: "Cliente informa CPF/CNPJ e o sistema consulta a integracao vinculada.",
  },
  {
    key: "integracaoId",
    label: "Integracao de login",
    type: "select",
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
    defaultValue: 60,
    visibleWhen: (form) => Boolean(form.loginIntegracao),
  },
  {
    key: "section-bilheteria",
    label: "Bilheteria e pagamento",
    type: "section",
    full: true,
    help: "Controle a venda de planos online por PIX. Os planos sao configurados na tela Bilheteria.",
  },
  {
    key: "compraOnline",
    label: "Compra online",
    type: "checkbox-card",
    defaultValue: false,
    help: "Cliente escolhe um plano da bilheteria ou um tempo personalizado e paga via PIX.",
  },
  {
    key: "pagamentoIntegracaoId",
    label: "Integracao de pagamento",
    type: "select",
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
    defaultValue: false,
    help: "Mostra uma opcao no final da compra para o cliente escolher o tempo em um controle deslizante.",
    visibleWhen: (form) => Boolean(form.compraOnline),
  },
  {
    key: "valorMinutoCentavos",
    label: "Valor por minuto (centavos)",
    type: "number",
    defaultValue: 10,
    help: "Exemplo: 10 centavos por minuto gera R$ 6,00 em 60 minutos.",
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "tempoPersonalizadoMinimo",
    label: "Tempo minimo personalizado (min)",
    type: "number",
    defaultValue: 10,
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "tempoPersonalizadoMaximo",
    label: "Tempo maximo personalizado (min)",
    type: "number",
    defaultValue: 240,
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "tempoPersonalizadoPasso",
    label: "Incremento do slider (min)",
    type: "number",
    defaultValue: 10,
    help: "Define de quantos em quantos minutos o cliente pode aumentar ou diminuir.",
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "conexoesPersonalizado",
    label: "Conexoes no personalizado",
    type: "number",
    defaultValue: 1,
    visibleWhen: (form) => Boolean(form.compraOnline && form.compraPersonalizada),
  },
  {
    key: "section-status",
    label: "Publicacao",
    type: "section",
    full: true,
    help: "Desative o hotspot para impedir novos acessos pelo portal.",
  },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
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
