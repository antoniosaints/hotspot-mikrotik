<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Marketing</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Campanhas</h2>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
          Telas de imagem, video, HTML ou blocos exibidas no portal antes ou depois do login, com segmentacao por
          hotspot e agendamento por dias e horarios.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" @click="load">
          <RefreshCw class="h-4 w-4" />
          Recarregar
        </Button>
        <Button @click="openCreate">Nova campanha</Button>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <Card>
      <div v-if="loading" class="py-10 text-center text-sm text-muted-foreground">Carregando campanhas...</div>
      <Table v-else>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Nome</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Tipo</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Momento</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Segmentacao</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Status</th>
            <th class="w-28 px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Acoes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="campanhas.length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma campanha cadastrada.</td>
          </tr>
          <tr v-for="campanha in campanhas" :key="campanha.id" class="bg-card/40">
            <td class="px-4 py-3 text-sm font-medium text-foreground">{{ campanha.nome }}</td>
            <td class="px-4 py-3 text-sm"><Badge variant="secondary">{{ tipoLabel(campanha.tipo) }}</Badge></td>
            <td class="px-4 py-3 text-sm">{{ campanha.momento === "ANTES_LOGIN" ? "Antes do login" : "Depois do login" }}</td>
            <td class="px-4 py-3 text-sm text-muted-foreground">
              {{ campanha.todosHotspots ? "Todos os hotspots" : `${campanha.hotspots?.length ?? 0} hotspot(s)` }}
            </td>
            <td class="px-4 py-3 text-sm">
              <Badge :variant="campanha.ativo ? 'default' : 'secondary'">{{ campanha.ativo ? "Ativa" : "Inativa" }}</Badge>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <Button size="icon" variant="ghost" aria-label="Editar" @click="openEdit(campanha)">
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Apagar" @click="remove(campanha)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </Table>
    </Card>

    <Dialog
      v-model:open="modalOpen"
      width-class="max-w-5xl"
      :title="editingId ? 'Editar campanha' : 'Nova campanha'"
      description="Configure o conteudo, a segmentacao e o agendamento. O preview a direita reflete o portal."
    >
      <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form id="campanha-form" class="grid gap-5" @submit.prevent="save">
          <!-- Basico -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <Label for="c-nome">Nome interno</Label>
              <Input id="c-nome" v-model="form.nome" class="mt-2" placeholder="Promocao de julho" />
            </div>
            <div>
              <Label for="c-tipo">Tipo de conteudo</Label>
              <Select id="c-tipo" :model-value="form.tipo" class="mt-2" @update:model-value="form.tipo = $event as CampanhaTipo">
                <option value="IMAGEM">Imagem</option>
                <option value="VIDEO">Video</option>
                <option value="HTML">HTML</option>
                <option value="CUSTOM">Tela customizada (blocos)</option>
              </Select>
            </div>
            <div>
              <Label for="c-momento">Momento</Label>
              <Select id="c-momento" :model-value="form.momento" class="mt-2" @update:model-value="form.momento = $event as CampanhaMomento">
                <option value="ANTES_LOGIN">Antes do login</option>
                <option value="DEPOIS_LOGIN">Depois do login</option>
              </Select>
            </div>
          </div>

          <!-- Conteudo por tipo -->
          <div class="rounded-lg border border-border bg-muted/20 p-4">
            <h3 class="text-sm font-semibold text-foreground">Conteudo</h3>

            <div v-if="form.tipo === 'IMAGEM'" class="mt-2">
              <Label>Imagem</Label>
              <ImagePicker v-model="form.imagemUrl" />
            </div>

            <div v-else-if="form.tipo === 'VIDEO'" class="mt-2">
              <Label for="c-video">URL do video (YouTube, Vimeo ou MP4)</Label>
              <Input id="c-video" v-model="form.videoUrl" class="mt-2" placeholder="https://youtu.be/..." />
            </div>

            <div v-else-if="form.tipo === 'HTML'" class="mt-2">
              <Label for="c-html">HTML</Label>
              <textarea id="c-html" v-model="form.htmlConteudo" :class="textareaClass" rows="6" placeholder="<div>...</div>"></textarea>
            </div>

            <div v-else class="mt-3 space-y-3">
              <div v-for="(bloco, index) in blocos" :key="index" class="rounded-md border border-border bg-background/60 p-3">
                <div class="flex items-center gap-2">
                  <Select :model-value="bloco.tipo" class="max-w-[160px]" @update:model-value="bloco.tipo = $event">
                    <option value="titulo">Titulo</option>
                    <option value="texto">Paragrafo</option>
                    <option value="imagem">Imagem</option>
                    <option value="video">Video</option>
                    <option value="botao">Botao</option>
                  </Select>
                  <div class="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Subir" :disabled="index === 0" @click="moveBloco(index, -1)">
                      <ChevronUp class="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Descer" :disabled="index === blocos.length - 1" @click="moveBloco(index, 1)">
                      <ChevronDown class="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remover" @click="removeBloco(index)">
                      <Trash2 class="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div class="mt-2">
                  <ImagePicker v-if="bloco.tipo === 'imagem'" v-model="bloco.url" />
                  <template v-else-if="bloco.tipo === 'botao'">
                    <Input v-model="bloco.texto" class="mb-2" placeholder="Texto do botao" />
                    <Input v-model="bloco.url" placeholder="https://destino.com" />
                  </template>
                  <Input v-else-if="bloco.tipo === 'video'" v-model="bloco.url" placeholder="URL do video" />
                  <textarea v-else v-model="bloco.texto" :class="textareaClass" rows="2" placeholder="Texto"></textarea>
                </div>
              </div>
              <Button variant="secondary" type="button" @click="addBloco">
                <Plus class="h-4 w-4" />
                Adicionar bloco
              </Button>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label for="c-titulo">Titulo (opcional)</Label>
                <Input id="c-titulo" v-model="form.titulo" class="mt-2" />
              </div>
              <div>
                <Label for="c-subtitulo">Subtitulo (opcional)</Label>
                <Input id="c-subtitulo" v-model="form.subtitulo" class="mt-2" />
              </div>
              <div class="sm:col-span-2">
                <Label for="c-texto">Texto (opcional)</Label>
                <textarea id="c-texto" v-model="form.texto" :class="textareaClass" rows="2"></textarea>
              </div>
              <div>
                <Label for="c-cta-texto">Botao (texto)</Label>
                <Input id="c-cta-texto" v-model="form.ctaTexto" class="mt-2" placeholder="Saiba mais" />
              </div>
              <div>
                <Label for="c-cta-url">Botao (link)</Label>
                <Input id="c-cta-url" v-model="form.ctaUrl" class="mt-2" placeholder="https://..." />
              </div>
              <div class="flex gap-3">
                <div class="flex-1">
                  <Label for="c-cor-fundo">Cor de fundo</Label>
                  <input id="c-cor-fundo" type="color" class="mt-2 h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1" :value="corFundoSwatch" @input="form.corFundo = ($event.target as HTMLInputElement).value" />
                </div>
                <div class="flex-1">
                  <Label for="c-cor-texto">Cor do texto</Label>
                  <input id="c-cor-texto" type="color" class="mt-2 h-9 w-full cursor-pointer rounded-md border border-input bg-background p-1" :value="corTextoSwatch" @input="form.corTexto = ($event.target as HTMLInputElement).value" />
                </div>
              </div>
            </div>
          </div>

          <!-- Segmentacao -->
          <div class="rounded-lg border border-border bg-muted/20 p-4">
            <h3 class="text-sm font-semibold text-foreground">Onde aparece</h3>
            <label class="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input v-model="form.todosHotspots" class="h-4 w-4 accent-blue-500" type="checkbox" />
              Todos os hotspots
            </label>
            <div v-if="!form.todosHotspots" class="mt-3 grid gap-2 sm:grid-cols-2">
              <p v-if="hotspots.length === 0" class="text-sm text-muted-foreground sm:col-span-2">Nenhum hotspot cadastrado.</p>
              <label
                v-for="hotspot in hotspots"
                :key="hotspot.id"
                class="flex cursor-pointer items-center gap-2 rounded-md border bg-background/50 p-2 text-sm"
                :class="form.hotspotIds.includes(hotspot.id) ? 'border-primary ring-1 ring-primary/20' : 'border-border'"
              >
                <input
                  class="h-4 w-4 accent-blue-500"
                  type="checkbox"
                  :checked="form.hotspotIds.includes(hotspot.id)"
                  @change="toggleHotspot(hotspot.id)"
                />
                {{ hotspot.nome }}
              </label>
            </div>
          </div>

          <!-- Agendamento -->
          <div class="rounded-lg border border-border bg-muted/20 p-4">
            <h3 class="text-sm font-semibold text-foreground">Agendamento</h3>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label for="c-data-inicio">Inicio (data)</Label>
                <Input id="c-data-inicio" v-model="form.dataInicio" type="date" class="mt-2" />
              </div>
              <div>
                <Label for="c-data-fim">Fim (data)</Label>
                <Input id="c-data-fim" v-model="form.dataFim" type="date" class="mt-2" />
              </div>
              <div>
                <Label for="c-hora-inicio">Hora inicio</Label>
                <Input id="c-hora-inicio" v-model="form.horaInicio" type="time" class="mt-2" />
              </div>
              <div>
                <Label for="c-hora-fim">Hora fim</Label>
                <Input id="c-hora-fim" v-model="form.horaFim" type="time" class="mt-2" />
              </div>
            </div>
            <div class="mt-3">
              <Label>Dias da semana</Label>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="dia in diasSemanaOpcoes"
                  :key="dia.value"
                  type="button"
                  class="rounded-md border px-3 py-1.5 text-sm transition-colors"
                  :class="diasSelecionados.includes(dia.value) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'"
                  @click="toggleDia(dia.value)"
                >
                  {{ dia.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Comportamento -->
          <div class="rounded-lg border border-border bg-muted/20 p-4">
            <h3 class="text-sm font-semibold text-foreground">Comportamento</h3>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label for="c-exibicao">Frequencia</Label>
                <Select id="c-exibicao" :model-value="form.exibicao" class="mt-2" @update:model-value="form.exibicao = $event as CampanhaExibicao">
                  <option value="SEMPRE">Sempre</option>
                  <option value="UMA_VEZ">Uma vez por dispositivo</option>
                  <option value="POR_SESSAO">Uma vez por sessao</option>
                </Select>
              </div>
              <div>
                <Label for="c-prioridade">Prioridade</Label>
                <Input id="c-prioridade" v-model.number="form.prioridade" type="number" class="mt-2" />
              </div>
              <div>
                <Label for="c-duracao">Duracao minima (segundos)</Label>
                <Input id="c-duracao" v-model.number="form.duracaoSegundos" type="number" class="mt-2" placeholder="0" />
              </div>
              <div class="flex items-end gap-4">
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                  <input v-model="form.permitePular" class="h-4 w-4 accent-blue-500" type="checkbox" />
                  Permite pular
                </label>
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                  <input v-model="form.ativo" class="h-4 w-4 accent-blue-500" type="checkbox" />
                  Ativa
                </label>
              </div>
            </div>
          </div>
        </form>

        <!-- Preview -->
        <div class="lg:sticky lg:top-0">
          <p class="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
          <div class="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-border shadow-lg">
            <CampanhaView :campanha="previewCampanha" preview />
          </div>
        </div>
      </div>

      <template #footer>
        <Button variant="outline" @click="modalOpen = false">Cancelar</Button>
        <Button type="submit" form="campanha-form" :disabled="saving">{{ saving ? "Salvando..." : "Salvar" }}</Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Trash2 } from "lucide-vue-next";
import { computed, onMounted, reactive, ref } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import CampanhaView from "@/components/ui/CampanhaView.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import ImagePicker from "@/components/ui/ImagePicker.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";
import type {
  Campanha,
  CampanhaBloco,
  CampanhaExibicao,
  CampanhaMomento,
  CampanhaTipo,
  Hotspot,
  PortalCampanha,
} from "@/types/hotspot";

// Bloco no editor: mantem texto e url sempre presentes para simplificar o binding.
type BlocoEdit = { tipo: string; texto: string; url: string };

const textareaClass =
  "mt-2 flex w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const diasSemanaOpcoes = [
  { label: "Dom", value: "0" },
  { label: "Seg", value: "1" },
  { label: "Ter", value: "2" },
  { label: "Qua", value: "3" },
  { label: "Qui", value: "4" },
  { label: "Sex", value: "5" },
  { label: "Sab", value: "6" },
];

const campanhas = ref<Campanha[]>([]);
const hotspots = ref<Array<Pick<Hotspot, "id" | "nome">>>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const modalOpen = ref(false);
const editingId = ref<string | null>(null);

const blocos = ref<BlocoEdit[]>([]);
const diasSelecionados = ref<string[]>(["0", "1", "2", "3", "4", "5", "6"]);

function emptyForm() {
  return {
    nome: "",
    tipo: "IMAGEM" as CampanhaTipo,
    momento: "ANTES_LOGIN" as CampanhaMomento,
    ativo: true,
    prioridade: 0,
    dataInicio: "",
    dataFim: "",
    horaInicio: "",
    horaFim: "",
    exibicao: "SEMPRE" as CampanhaExibicao,
    duracaoSegundos: 0,
    permitePular: true,
    ctaTexto: "",
    ctaUrl: "",
    imagemUrl: "",
    videoUrl: "",
    htmlConteudo: "",
    titulo: "",
    subtitulo: "",
    texto: "",
    corFundo: "",
    corTexto: "",
    todosHotspots: true,
    hotspotIds: [] as string[],
  };
}

const form = reactive(emptyForm());

const corFundoSwatch = computed(() => (/^#[0-9a-f]{6}$/i.test(form.corFundo) ? form.corFundo : "#00aeef"));
const corTextoSwatch = computed(() => (/^#[0-9a-f]{6}$/i.test(form.corTexto) ? form.corTexto : "#ffffff"));

// Converte os blocos do editor em CampanhaBloco (JSON armazenado/preview).
function blocosToJson(): string {
  const saida: CampanhaBloco[] = blocos.value.map((bloco) => {
    if (bloco.tipo === "imagem") return { tipo: "imagem", url: bloco.url };
    if (bloco.tipo === "video") return { tipo: "video", url: bloco.url };
    if (bloco.tipo === "botao") return { tipo: "botao", texto: bloco.texto, url: bloco.url };
    if (bloco.tipo === "titulo") return { tipo: "titulo", texto: bloco.texto };
    return { tipo: "texto", texto: bloco.texto };
  });
  return JSON.stringify(saida);
}

const previewCampanha = computed<PortalCampanha>(() => ({
  id: "preview",
  tipo: form.tipo,
  momento: form.momento,
  duracaoSegundos: form.duracaoSegundos || null,
  permitePular: form.permitePular,
  exibicao: form.exibicao,
  ctaTexto: form.ctaTexto || null,
  ctaUrl: form.ctaUrl || null,
  imagemUrl: form.imagemUrl || null,
  videoUrl: form.videoUrl || null,
  htmlConteudo: form.htmlConteudo || null,
  titulo: form.titulo || null,
  subtitulo: form.subtitulo || null,
  texto: form.texto || null,
  corFundo: form.corFundo || null,
  corTexto: form.corTexto || null,
  blocos: form.tipo === "CUSTOM" ? blocosToJson() : null,
}));

function tipoLabel(tipo: CampanhaTipo): string {
  return { IMAGEM: "Imagem", VIDEO: "Video", HTML: "HTML", CUSTOM: "Customizada" }[tipo];
}

function toggleHotspot(id: string): void {
  form.hotspotIds = form.hotspotIds.includes(id)
    ? form.hotspotIds.filter((value) => value !== id)
    : [...form.hotspotIds, id];
}

function toggleDia(value: string): void {
  diasSelecionados.value = diasSelecionados.value.includes(value)
    ? diasSelecionados.value.filter((dia) => dia !== value)
    : [...diasSelecionados.value, value];
}

function addBloco(): void {
  blocos.value.push({ tipo: "texto", texto: "", url: "" });
}

function removeBloco(index: number): void {
  blocos.value.splice(index, 1);
}

function moveBloco(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= blocos.value.length) return;
  const [item] = blocos.value.splice(index, 1);
  blocos.value.splice(target, 0, item);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    campanhas.value = await api.get<Campanha[]>("/campanhas");
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar as campanhas.";
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, emptyForm());
  blocos.value = [];
  diasSelecionados.value = ["0", "1", "2", "3", "4", "5", "6"];
  modalOpen.value = true;
}

function openEdit(campanha: Campanha): void {
  editingId.value = campanha.id;
  Object.assign(form, {
    ...emptyForm(),
    nome: campanha.nome,
    tipo: campanha.tipo,
    momento: campanha.momento,
    ativo: campanha.ativo,
    prioridade: campanha.prioridade,
    dataInicio: campanha.dataInicio ? campanha.dataInicio.slice(0, 10) : "",
    dataFim: campanha.dataFim ? campanha.dataFim.slice(0, 10) : "",
    horaInicio: campanha.horaInicio ?? "",
    horaFim: campanha.horaFim ?? "",
    exibicao: campanha.exibicao,
    duracaoSegundos: campanha.duracaoSegundos ?? 0,
    permitePular: campanha.permitePular,
    ctaTexto: campanha.ctaTexto ?? "",
    ctaUrl: campanha.ctaUrl ?? "",
    imagemUrl: campanha.imagemUrl ?? "",
    videoUrl: campanha.videoUrl ?? "",
    htmlConteudo: campanha.htmlConteudo ?? "",
    titulo: campanha.titulo ?? "",
    subtitulo: campanha.subtitulo ?? "",
    texto: campanha.texto ?? "",
    corFundo: campanha.corFundo ?? "",
    corTexto: campanha.corTexto ?? "",
    todosHotspots: campanha.todosHotspots,
    hotspotIds: campanha.hotspots?.map((hotspot) => hotspot.id) ?? [],
  });
  diasSelecionados.value = campanha.diasSemana ? campanha.diasSemana.split(",").filter(Boolean) : [];
  blocos.value = parseBlocos(campanha.blocos);
  modalOpen.value = true;
}

function parseBlocos(raw: string | null): BlocoEdit[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CampanhaBloco[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((bloco) => ({
      tipo: bloco.tipo,
      texto: "texto" in bloco ? bloco.texto : "",
      url: "url" in bloco ? bloco.url : "",
    }));
  } catch {
    return [];
  }
}

function buildPayload(): Record<string, unknown> {
  return {
    nome: form.nome,
    tipo: form.tipo,
    momento: form.momento,
    ativo: form.ativo,
    prioridade: Number(form.prioridade) || 0,
    // Data fim inclusiva ate o fim do dia.
    dataInicio: form.dataInicio ? new Date(`${form.dataInicio}T00:00:00`).toISOString() : null,
    dataFim: form.dataFim ? new Date(`${form.dataFim}T23:59:59`).toISOString() : null,
    diasSemana: diasSelecionados.value.join(","),
    horaInicio: form.horaInicio || null,
    horaFim: form.horaFim || null,
    exibicao: form.exibicao,
    duracaoSegundos: Number(form.duracaoSegundos) || null,
    permitePular: form.permitePular,
    ctaTexto: form.ctaTexto || null,
    ctaUrl: form.ctaUrl || null,
    imagemUrl: form.imagemUrl || null,
    videoUrl: form.videoUrl || null,
    htmlConteudo: form.htmlConteudo || null,
    titulo: form.titulo || null,
    subtitulo: form.subtitulo || null,
    texto: form.texto || null,
    corFundo: form.corFundo || null,
    corTexto: form.corTexto || null,
    blocos: form.tipo === "CUSTOM" ? blocosToJson() : null,
    todosHotspots: form.todosHotspots,
    hotspotIds: form.todosHotspots ? [] : form.hotspotIds,
  };
}

async function save(): Promise<void> {
  saving.value = true;
  error.value = "";
  try {
    if (editingId.value) {
      await api.put(`/campanhas/${editingId.value}`, buildPayload());
    } else {
      await api.post("/campanhas", buildPayload());
    }
    modalOpen.value = false;
    await load();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar a campanha.";
  } finally {
    saving.value = false;
  }
}

async function remove(campanha: Campanha): Promise<void> {
  if (!window.confirm(`Apagar a campanha "${campanha.nome}"?`)) return;
  error.value = "";
  try {
    await api.delete(`/campanhas/${campanha.id}`);
    await load();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel apagar a campanha.";
  }
}

onMounted(async () => {
  await load();
  try {
    hotspots.value = await api.get<Array<Pick<Hotspot, "id" | "nome">>>("/hotspots");
  } catch {
    hotspots.value = [];
  }
});
</script>
