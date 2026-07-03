<template>
  <CrudPage
    title="Usuarios"
    singular-title="usuario"
    description="Controle de acesso ao painel administrativo por perfil."
    endpoint="/usuarios"
    :columns="columns"
    :fields="fields"
  />
</template>

<script setup lang="ts">
import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";

const columns: CrudColumn[] = [
  { key: "usuario", label: "Usuario" },
  { key: "role", label: "Perfil" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const fields: CrudField[] = [
  { key: "usuario", label: "Usuario", type: "text" },
  { key: "senha", label: "Senha", type: "password", help: "Obrigatoria ao criar. Ao editar, preencha apenas para trocar." },
  {
    key: "role",
    label: "Perfil",
    type: "select",
    defaultValue: "user",
    options: [
      { label: "Admin", value: "admin" },
      { label: "Manager", value: "manager" },
      { label: "User", value: "user" },
    ],
  },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
];
</script>
