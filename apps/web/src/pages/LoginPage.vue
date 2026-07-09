<template>
  <main class="login-shell relative isolate min-h-screen overflow-hidden bg-[#061329] px-4 py-8 text-white sm:px-6 lg:px-8">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(14,165,233,0.34),transparent_28%),radial-gradient(circle_at_84%_16%,rgba(37,99,235,0.42),transparent_26%),linear-gradient(135deg,#07172f_0%,#0b2d62_52%,#051124_100%)]"></div>
    <div class="login-grid absolute inset-0 opacity-30"></div>
    <div class="login-pulse login-pulse-one"></div>
    <div class="login-pulse login-pulse-two"></div>

    <section class="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div class="hidden lg:block">
        <div class="mb-8 inline-flex items-center gap-3 rounded-full border border-cyan-300/25 bg-white/8 px-4 py-2 text-sm text-cyan-100 shadow-[0_16px_80px_rgba(14,165,233,0.18)] backdrop-blur">
          <Wifi class="h-4 w-4 text-cyan-200" />
          Controle operacional de redes Hotspot
        </div>

        <h1 class="max-w-2xl text-5xl font-bold leading-tight text-white">
          Painel CAS com acesso rapido, seguro e visual de operacao.
        </h1>
        <p class="mt-5 max-w-xl text-base leading-7 text-blue-100/80">
          Gerencie vouchers, clientes, MikroTiks e portais em uma entrada mais moderna, com foco no trabalho diario.
        </p>

        <div class="mt-10 grid max-w-2xl grid-cols-3 gap-4">
          <div class="metric-tile">
            <Activity class="h-5 w-5 text-cyan-200" />
            <span>Monitoramento</span>
          </div>
          <div class="metric-tile">
            <ShieldCheck class="h-5 w-5 text-blue-100" />
            <span>Acesso seguro</span>
          </div>
          <div class="metric-tile">
            <RadioTower class="h-5 w-5 text-sky-200" />
            <span>MikroTik</span>
          </div>
        </div>
      </div>

      <div class="mx-auto w-full max-w-md">
        <div class="login-card relative overflow-hidden rounded-[28px] border border-white/20 bg-white/[0.11] p-6 shadow-[0_30px_120px_rgba(3,7,18,0.55)] backdrop-blur-2xl sm:p-8">
          <div class="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent"></div>
          <div class="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl"></div>

          <div class="relative">
            <div class="flex items-center gap-4">
              <div class="grid h-14 w-14 place-items-center">
                <img src="/img/logo.png" class="h-14 w-14 object-contain rounded-lg" alt="Logo CAS" />
              </div>
              <div>
                <p class="text-sm font-medium uppercase text-cyan-100">Hotspot CAS</p>
                <h2 class="text-2xl font-bold text-white">Entrar no painel</h2>
              </div>
            </div>

            <p class="mt-6 text-sm leading-6 text-blue-100/75">
              Use suas credenciais administrativas para acessar a plataforma.
            </p>

            <Alert v-if="error" class="mt-6 border-red-300/40 bg-red-500/15 text-red-50" variant="destructive">{{ error }}</Alert>

            <form class="mt-7 space-y-5" @submit.prevent="submit">
              <div>
                <Label for="usuario" class="text-xs font-semibold uppercase text-blue-100/80">Usuario</Label>
                <div class="relative mt-2">
                  <UserRound class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/70" />
                  <Input
                    id="usuario"
                    v-model="usuario"
                    class="h-12 border-white/15 bg-white/12 pl-11 text-white shadow-inner shadow-blue-950/20 placeholder:text-blue-100/40"
                    autocomplete="username"
                    autofocus
                    placeholder="Seu usuario"
                  />
                </div>
              </div>

              <div>
                <Label for="senha" class="text-xs font-semibold uppercase text-blue-100/80">Senha</Label>
                <div class="relative mt-2">
                  <KeyRound class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/70" />
                  <Input
                    id="senha"
                    v-model="senha"
                    class="h-12 border-white/15 bg-white/12 pl-11 text-white shadow-inner shadow-blue-950/20 placeholder:text-blue-100/40"
                    autocomplete="current-password"
                    type="password"
                    placeholder="Sua senha"
                  />
                </div>
              </div>

              <Button
                class="login-button h-12 w-full rounded-xl bg-cyan-300 text-base font-bold text-blue-950 shadow-[0_18px_60px_rgba(34,211,238,0.35)] hover:bg-cyan-200"
                type="submit"
                :disabled="loading"
              >
                <span>{{ loading ? "Entrando..." : "Entrar" }}</span>
                <ArrowRight class="h-5 w-5" />
              </Button>
            </form>

            <div class="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-blue-950/35 px-4 py-3 text-xs text-blue-100/70">
              <span>Sessao administrativa</span>
              <span class="inline-flex items-center gap-2 text-cyan-100">
                <span class="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]"></span>
                Online
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { Activity, ArrowRight, KeyRound, RadioTower, ShieldCheck, UserRound, Wifi } from "lucide-vue-next";
import { ref } from "vue";
import { useRouter } from "vue-router";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { api, ApiError, roleHome, setCurrentAdmin, setToken, type CurrentAdmin } from "@/services/api";

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
    await router.push(roleHome(response.admin.role));
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel fazer login.";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-shell::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: "";
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 88px 88px;
  mask-image: linear-gradient(to bottom, black 0%, transparent 78%);
}

.login-grid {
  background-image:
    linear-gradient(115deg, rgba(125, 211, 252, 0.2), transparent 28%),
    repeating-linear-gradient(120deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 18px);
}

.login-pulse {
  position: absolute;
  z-index: 0;
  border-radius: 9999px;
  border: 1px solid rgba(125, 211, 252, 0.24);
  box-shadow: inset 0 0 70px rgba(14, 165, 233, 0.14), 0 0 90px rgba(37, 99, 235, 0.18);
  animation: floatPulse 8s ease-in-out infinite;
}

.login-pulse-one {
  left: -9rem;
  top: 9rem;
  width: 24rem;
  height: 24rem;
}

.login-pulse-two {
  right: -7rem;
  bottom: -8rem;
  width: 30rem;
  height: 30rem;
  animation-delay: -3s;
}

.login-card {
  animation: cardEntrance 700ms ease-out both;
}

.metric-tile {
  min-height: 6.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 1.25rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(219, 234, 254, 0.86);
  box-shadow: 0 22px 70px rgba(2, 6, 23, 0.2);
  backdrop-filter: blur(18px);
}

.login-button {
  transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}

@keyframes floatPulse {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.78;
  }

  50% {
    transform: translate3d(18px, -16px, 0) scale(1.04);
    opacity: 1;
  }
}

@keyframes cardEntrance {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .login-pulse-one {
    left: -13rem;
    top: 4rem;
  }

  .login-pulse-two {
    right: -15rem;
    bottom: -10rem;
  }
}
</style>
