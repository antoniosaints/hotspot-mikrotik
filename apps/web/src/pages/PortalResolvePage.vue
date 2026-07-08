<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-sm text-slate-200">
    <p v-if="!error">Identificando o portal do seu local...</p>
    <p v-else class="max-w-md leading-6">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { api, ApiError } from "@/services/api";

// Pagina de entrada do login.html compartilhado por MikroTik: recebe o
// $(server-name) enviado pelo roteador, resolve qual hotspot atende aquele
// servidor (interface/local) e redireciona para o portal correto mantendo os
// parametros do MikroTik (mac, ip, link-login, chap etc.).
const route = useRoute();
const router = useRouter();
const error = ref("");

onMounted(async () => {
  const mikrotikId = String(route.params.mikrotikId ?? "");
  const server = typeof route.query.server === "string" ? route.query.server : "";

  try {
    const response = await api.get<{ slug: string }>(
      `/portal/resolve/${encodeURIComponent(mikrotikId)}?server=${encodeURIComponent(server)}`,
    );

    const query = { ...route.query };
    delete query.server;

    await router.replace({ path: `/portal/${encodeURIComponent(response.slug)}`, query });
  } catch (requestError) {
    error.value =
      requestError instanceof ApiError
        ? requestError.message
        : "Nao foi possivel identificar o portal deste local. Tente novamente em instantes.";
  }
});
</script>
