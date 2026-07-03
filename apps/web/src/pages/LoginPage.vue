<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
    <Card class="w-full max-w-md">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-lg font-semibold">Hotspot Admin</h1>
            <p class="text-sm text-muted-foreground">Acesse o painel operacional</p>
          </div>
        </div>
      </template>

      <Alert v-if="error" class="mb-4" variant="destructive">{{ error }}</Alert>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <Label for="usuario">Usuario</Label>
          <Input id="usuario" v-model="usuario" class="mt-2" autocomplete="username" autofocus />
        </div>
        <div>
          <Label for="senha">Senha</Label>
          <Input id="senha" v-model="senha" class="mt-2" autocomplete="current-password" type="password" />
        </div>
        <Button class="w-full" type="submit" :disabled="loading">
          {{ loading ? "Entrando..." : "Entrar" }}
        </Button>
      </form>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { KeyRound } from "lucide-vue-next";
import { ref } from "vue";
import { useRouter } from "vue-router";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { api, ApiError, setCurrentAdmin, setToken, type CurrentAdmin } from "@/services/api";

type LoginResponse = {
  token: string;
  admin: CurrentAdmin;
};

const router = useRouter();
const usuario = ref("");
const senha = ref("");
const loading = ref(false);
const error = ref("");

async function submit(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const response = await api.post<LoginResponse>("/auth/login", {
      usuario: usuario.value,
      senha: senha.value,
    });
    setToken(response.token);
    setCurrentAdmin(response.admin);
    await router.push("/dashboard");
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel fazer login.";
  } finally {
    loading.value = false;
  }
}
</script>
