<template>
  <CrudPage
    title="Telas de cadastro"
    singular-title="tela de cadastro"
    description="Configure os formularios usados no botao Quero contratar do portal."
    endpoint="/cadastros-telas"
    :columns="columns"
    :fields="fields"
    modal-width-class="max-w-3xl"
  />
</template>

<script setup lang="ts">
import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "coletarNome", label: "Nome", type: "boolean" },
  { key: "coletarTelefone", label: "Telefone", type: "boolean" },
  { key: "coletarWhatsapp", label: "WhatsApp", type: "boolean" },
  { key: "coletarCpf", label: "CPF", type: "boolean" },
  { key: "bonusTempoMinutos", label: "Bonus min" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const fields: CrudField[] = [
  { key: "nome", label: "Nome da tela", type: "text", full: true, placeholder: "Cadastro comercial" },
  { key: "descricao", label: "Descricao", type: "text", full: true, defaultValue: null },
  { key: "coletarNome", label: "Coletar nome", type: "checkbox-card", defaultValue: true },
  { key: "coletarEmail", label: "Coletar email", type: "checkbox-card", defaultValue: false },
  { key: "coletarEndereco", label: "Coletar endereco", type: "checkbox-card", defaultValue: false },
  { key: "coletarCidade", label: "Coletar cidade", type: "checkbox-card", defaultValue: false },
  { key: "coletarCep", label: "Coletar CEP", type: "checkbox-card", defaultValue: false },
  { key: "coletarTelefone", label: "Coletar telefone", type: "checkbox-card", defaultValue: false },
  { key: "coletarWhatsapp", label: "Coletar WhatsApp", type: "checkbox-card", defaultValue: false },
  { key: "coletarCpf", label: "Coletar CPF", type: "checkbox-card", defaultValue: false },
  {
    key: "bonusTempoMinutos",
    label: "Bonus de internet (minutos)",
    type: "number",
    defaultValue: 0,
    full: true,
    help: "Use 0 para apenas registrar o cadastro sem liberar internet.",
  },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
];
</script>
