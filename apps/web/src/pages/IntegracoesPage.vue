<template>
  <CrudPage
    title="Integracoes"
    singular-title="integracao"
    description="Credenciais externas usadas para login por base externa e pagamentos."
    endpoint="/integracoes"
    :columns="columns"
    :fields="fields"
  />
</template>

<script setup lang="ts">
import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "tipo", label: "Tipo" },
  { key: "baseUrl", label: "URL" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const fields: CrudField[] = [
  { key: "nome", label: "Nome", type: "text", full: true, placeholder: "IXC Provedor ou Mercado Pago" },
  {
    key: "tipo",
    label: "Escolha o tipo de integracao",
    type: "choice-cards",
    defaultValue: "IXC",
    full: true,
    options: [
      {
        label: "IXC Soft",
        value: "IXC",
        description: "Consulta base de clientes por CPF ou CNPJ para liberar acesso.",
      },
      {
        label: "Mercado Pago",
        value: "MERCADO_PAGO",
        description: "Gera PIX para venda de planos da bilheteria.",
      },
    ],
  },
  {
    key: "baseUrl",
    label: "URL da integracao IXC",
    type: "text",
    full: true,
    placeholder: "https://ixc.seudominio.com.br/webservice/v1",
    visibleWhen: (form) => form.tipo === "IXC",
    clearWhenHidden: true,
  },
  {
    key: "usuario",
    label: "Usuario IXC",
    type: "text",
    visibleWhen: (form) => form.tipo === "IXC",
    clearWhenHidden: true,
  },
  {
    key: "senha",
    label: "Senha IXC",
    type: "password",
    visibleWhen: (form) => form.tipo === "IXC",
    clearWhenHidden: true,
  },
  {
    key: "token",
    label: "Token Mercado Pago",
    type: "password",
    full: true,
    visibleWhen: (form) => form.tipo === "MERCADO_PAGO",
    clearWhenHidden: true,
  },
  {
    key: "chaveWebhook",
    label: "Chave webhook Mercado Pago",
    type: "password",
    full: true,
    visibleWhen: (form) => form.tipo === "MERCADO_PAGO",
    clearWhenHidden: true,
  },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
];
</script>
