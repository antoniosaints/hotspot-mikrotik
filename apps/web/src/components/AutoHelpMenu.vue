<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
    <div
      v-if="open"
      class="w-[calc(100vw-2.5rem)] max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-black/30"
    >
      <div class="border-b border-border bg-muted/50 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Autoajuda</p>
            <h2 class="mt-1 text-base font-semibold">Duvidas rapidas do sistema</h2>
          </div>
          <Button size="icon" variant="ghost" aria-label="Fechar autoajuda" @click="open = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <Badge :variant="geminiAvailable ? 'default' : 'secondary'">
            {{ geminiAvailable ? "Gemini ativo" : "FAQ local" }}
          </Badge>
          <Badge v-if="geminiConfigs.length > 1" variant="secondary">{{ geminiConfigs.length }} configs IA</Badge>
        </div>
      </div>

      <div class="max-h-[65vh] space-y-4 overflow-y-auto p-4">
        <div v-if="geminiConfigs.length > 1">
          <Label for="geminiConfig">Configuracao Gemini</Label>
          <Select id="geminiConfig" v-model="selectedGeminiId" class="mt-2">
            <option v-for="config in geminiConfigs" :key="config.id" :value="config.id">
              {{ config.nome }} - {{ config.modelo }}
            </option>
          </Select>
        </div>

        <div>
          <p class="mb-2 text-sm font-semibold">Perguntas frequentes</p>
          <div class="grid gap-2">
            <button
              v-for="item in quickAnswers"
              :key="item.question"
              class="rounded-md border border-border bg-background/60 px-3 py-2 text-left transition-colors hover:border-primary/60"
              type="button"
              @click="selectQuickAnswer(item)"
            >
              <span class="block text-sm font-medium text-foreground">{{ item.question }}</span>
              <span class="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{{ item.answer }}</span>
            </button>
          </div>
        </div>

        <div v-if="answer" class="rounded-md border border-border bg-background/70 p-3">
          <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{{ answerSource }}</p>
          <p class="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{{ answer }}</p>
        </div>

        <form class="space-y-3" @submit.prevent="ask">
          <div>
            <Label for="autohelpQuestion">Pergunte sobre configuracoes, hotspots, planos ou apps</Label>
            <textarea
              id="autohelpQuestion"
              v-model="question"
              class="mt-2 flex min-h-20 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Ex.: como configuro compra online com Mercado Pago?"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <Button type="button" variant="outline" @click="clearAnswer">Limpar</Button>
            <Button type="submit" :disabled="asking || question.trim().length < 3">
              <Send class="h-4 w-4" />
              {{ asking ? "Consultando..." : geminiAvailable ? "Perguntar" : "Buscar FAQ" }}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <Button
      class="h-12 rounded-full px-4 shadow-glow"
      type="button"
      :aria-expanded="open"
      aria-label="Abrir autoajuda"
      @click="toggle"
    >
      <Bot class="h-5 w-5" />
      Autoajuda
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Bot, Send, X } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import { api, ApiError } from "@/services/api";

type GeminiConfig = { id: string; nome: string; modelo: string };
type AutoHelpStatus = { geminiAvailable: boolean; geminiConfigs: GeminiConfig[] };
type QuickAnswer = { question: string; answer: string };

const quickAnswers: QuickAnswer[] = [
  {
    question: "Como configurar um equipamento MikroTik?",
    answer: "Cadastre o equipamento em Equipamentos com host, usuario API, senha, porta, timeout e profile padrao. Depois vincule o equipamento ao hotspot e exporte os arquivos em Configuracao MikroTik.",
  },
  {
    question: "Como criar um hotspot?",
    answer: "Em Hotspots, informe local, equipamento, slug, URL do portal e os tipos de login desejados. O hotspot tambem define IXC para login externo, Mercado Pago para compra online e textos LGPD personalizados.",
  },
  {
    question: "Como vender acesso online?",
    answer: "Ative uma conta Mercado Pago em Apps, crie planos em Planos e vincule-os ao hotspot. No cadastro do hotspot, habilite Compra online e selecione a integracao de pagamento.",
  },
  {
    question: "Quais tipos de login existem?",
    answer: "O portal pode liberar acesso por voucher, CPF pre-cadastrado, IXC, compra Pix e fluxo de contratacao/cadastro conforme a configuracao do hotspot.",
  },
  {
    question: "Onde configuro campanhas?",
    answer: "Use Campanhas para criar conteudo de imagem, video, HTML ou blocos customizados. Defina momento de exibicao, periodo, prioridade e quais hotspots recebem a campanha.",
  },
  {
    question: "Onde ficam as integracoes?",
    answer: "As integracoes agora ficam em Apps. Mercado Pago, IXC Soft e Gemini aceitam varias configuracoes independentes.",
  },
];

const open = ref(false);
const question = ref("");
const answer = ref("");
const answerSource = ref("Resposta");
const asking = ref(false);
const geminiAvailable = ref(false);
const geminiConfigs = ref<GeminiConfig[]>([]);
const selectedGeminiId = ref("");

const normalizedQuestion = computed(() => question.value.trim().toLocaleLowerCase("pt-BR"));

function bestLocalAnswer(): QuickAnswer {
  const term = normalizedQuestion.value;
  return (
    quickAnswers.find((item) =>
      item.question.toLocaleLowerCase("pt-BR").split(" ").some((word) => word.length > 3 && term.includes(word)),
    ) ?? quickAnswers[0]
  );
}

function selectQuickAnswer(item: QuickAnswer): void {
  question.value = item.question;
  answer.value = item.answer;
  answerSource.value = "FAQ local";
}

function clearAnswer(): void {
  question.value = "";
  answer.value = "";
  answerSource.value = "Resposta";
}

async function loadStatus(): Promise<void> {
  try {
    const status = await api.get<AutoHelpStatus>("/autoajuda/status");
    geminiAvailable.value = status.geminiAvailable;
    geminiConfigs.value = status.geminiConfigs;
    selectedGeminiId.value = status.geminiConfigs[0]?.id ?? "";
  } catch {
    geminiAvailable.value = false;
    geminiConfigs.value = [];
    selectedGeminiId.value = "";
  }
}

async function ask(): Promise<void> {
  if (question.value.trim().length < 3) return;

  if (!geminiAvailable.value) {
    selectQuickAnswer(bestLocalAnswer());
    return;
  }

  asking.value = true;
  try {
    const result = await api.post<{ answer: string; source: string; integrationName: string }>("/autoajuda/ask", {
      question: question.value,
      integrationId: selectedGeminiId.value || null,
    });
    answer.value = result.answer;
    answerSource.value = `Gemini - ${result.integrationName}`;
  } catch (requestError) {
    const fallback = bestLocalAnswer();
    answer.value =
      requestError instanceof ApiError
        ? `${requestError.message}\n\nResposta rapida: ${fallback.answer}`
        : fallback.answer;
    answerSource.value = "FAQ local";
  } finally {
    asking.value = false;
  }
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) void loadStatus();
}

onMounted(loadStatus);
</script>
