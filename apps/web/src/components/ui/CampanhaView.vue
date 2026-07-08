<template>
  <div class="campanha-view" :style="rootStyle">
    <div class="campanha-content">
      <h2 v-if="campanha.titulo" class="campanha-titulo">{{ campanha.titulo }}</h2>
      <p v-if="campanha.subtitulo" class="campanha-subtitulo">{{ campanha.subtitulo }}</p>

      <img v-if="campanha.tipo === 'IMAGEM' && campanha.imagemUrl" :src="campanha.imagemUrl" alt="" class="campanha-imagem" />

      <div v-else-if="campanha.tipo === 'VIDEO' && campanha.videoUrl" class="campanha-midia">
        <video v-if="isArquivoVideo" :src="campanha.videoUrl" class="campanha-video" controls playsinline />
        <iframe
          v-else-if="embedUrl"
          :src="embedUrl"
          class="campanha-video"
          frameborder="0"
          allow="autoplay; encrypted-media"
          allowfullscreen
        />
      </div>

      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else-if="campanha.tipo === 'HTML' && campanha.htmlConteudo" class="campanha-html" v-html="campanha.htmlConteudo" />

      <div v-else-if="campanha.tipo === 'CUSTOM'" class="campanha-blocos">
        <template v-for="(bloco, index) in blocos" :key="index">
          <h3 v-if="bloco.tipo === 'titulo'" class="campanha-bloco-titulo">{{ bloco.texto }}</h3>
          <p v-else-if="bloco.tipo === 'texto'" class="campanha-bloco-texto">{{ bloco.texto }}</p>
          <img v-else-if="bloco.tipo === 'imagem' && bloco.url" :src="bloco.url" alt="" class="campanha-imagem" />
          <div v-else-if="bloco.tipo === 'video' && bloco.url" class="campanha-midia">
            <iframe v-if="blocoEmbed(bloco.url)" :src="blocoEmbed(bloco.url)!" class="campanha-video" frameborder="0" allowfullscreen />
            <video v-else :src="bloco.url" class="campanha-video" controls playsinline />
          </div>
          <a
            v-else-if="bloco.tipo === 'botao' && bloco.url"
            class="campanha-cta"
            :href="bloco.url"
            target="_blank"
            rel="noopener"
          >{{ bloco.texto || "Saiba mais" }}</a>
        </template>
      </div>

      <p v-if="campanha.texto" class="campanha-texto">{{ campanha.texto }}</p>

      <a
        v-if="campanha.ctaTexto && campanha.ctaUrl"
        class="campanha-cta"
        :href="campanha.ctaUrl"
        target="_blank"
        rel="noopener"
      >{{ campanha.ctaTexto }}</a>
    </div>

    <div v-if="!preview" class="campanha-acoes">
      <button type="button" class="campanha-continuar" :disabled="!podeContinuar" @click="$emit('continue')">
        {{ podeContinuar ? continuarLabel : `Aguarde ${restante}s` }}
      </button>
    </div>
    <p v-else class="campanha-preview-hint">Pre-visualizacao</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import type { CampanhaBloco, PortalCampanha } from "@/types/hotspot";

const props = withDefaults(
  defineProps<{
    campanha: PortalCampanha;
    preview?: boolean;
    continuarLabel?: string;
  }>(),
  { preview: false, continuarLabel: "Continuar" },
);

defineEmits<{ continue: [] }>();

const restante = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

// Pode continuar quando: pode pular, ou nao ha contagem, ou a contagem terminou.
const podeContinuar = computed(() => props.campanha.permitePular || restante.value <= 0);

const rootStyle = computed(() => ({
  background: props.campanha.corFundo || "#ffffff",
  color: props.campanha.corTexto || "#0f172a",
}));

const blocos = computed<CampanhaBloco[]>(() => {
  if (!props.campanha.blocos) return [];
  try {
    const parsed = JSON.parse(props.campanha.blocos);
    return Array.isArray(parsed) ? (parsed as CampanhaBloco[]) : [];
  } catch {
    return [];
  }
});

const isArquivoVideo = computed(() => /\.(mp4|webm|ogg)(\?.*)?$/i.test(props.campanha.videoUrl ?? ""));
const embedUrl = computed(() => (props.campanha.videoUrl ? videoEmbed(props.campanha.videoUrl) : null));

// Converte links de YouTube/Vimeo em URL de embed; demais viram iframe direto.
function videoEmbed(url: string): string | null {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(url);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return null;
  return url;
}

function blocoEmbed(url: string): string | null {
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return null;
  return videoEmbed(url);
}

onMounted(() => {
  const duracao = props.campanha.duracaoSegundos ?? 0;
  if (props.preview || props.campanha.permitePular || duracao <= 0) return;
  restante.value = duracao;
  timer = setInterval(() => {
    restante.value -= 1;
    if (restante.value <= 0 && timer) clearInterval(timer);
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.campanha-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  border-radius: 16px;
  overflow: hidden;
}

.campanha-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 22px;
}

.campanha-titulo {
  font-size: 22px;
  font-weight: 800;
}

.campanha-subtitulo {
  font-size: 14px;
  opacity: 0.85;
}

.campanha-texto {
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.92;
  white-space: pre-line;
}

.campanha-imagem {
  max-width: 100%;
  border-radius: 12px;
}

.campanha-midia {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.campanha-video {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: #000;
}

.campanha-html {
  width: 100%;
}

.campanha-blocos {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.campanha-bloco-titulo {
  font-size: 18px;
  font-weight: 700;
}

.campanha-bloco-texto {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.campanha-cta {
  display: inline-block;
  margin-top: 4px;
  padding: 10px 20px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  color: inherit;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.campanha-acoes {
  padding: 16px 22px 22px;
}

.campanha-continuar {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  background: #0077ff;
  color: #fff;
}

.campanha-continuar:disabled {
  opacity: 0.6;
  cursor: default;
}

.campanha-preview-hint {
  padding: 10px;
  text-align: center;
  font-size: 12px;
  opacity: 0.6;
}
</style>
