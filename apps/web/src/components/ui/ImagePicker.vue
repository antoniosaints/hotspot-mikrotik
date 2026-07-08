<template>
  <div class="mt-2 flex items-center gap-3">
    <div
      class="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40"
    >
      <img v-if="modelValue" :src="modelValue" alt="Imagem selecionada" class="h-full w-full object-contain" />
      <ImageIcon v-else class="h-6 w-6 text-muted-foreground" />
    </div>
    <div class="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" @click="openGallery">
        <Images class="h-4 w-4" />
        Escolher imagem
      </Button>
      <Button v-if="modelValue" type="button" variant="ghost" @click="$emit('update:modelValue', '')">
        <X class="h-4 w-4" />
        Remover
      </Button>
    </div>
  </div>

  <Dialog v-model:open="galleryOpen" title="Imagens do portal" description="Selecione uma imagem existente ou envie uma nova." width-class="max-w-3xl">
    <div class="space-y-4">
      <Alert v-if="galleryError" variant="destructive">{{ galleryError }}</Alert>

      <label
        class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <UploadCloud class="h-4 w-4" />
        {{ uploading ? "Enviando imagem..." : "Enviar nova imagem (PNG, JPG, WEBP, GIF ou ICO, ate 3 MB)" }}
        <input class="hidden" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.ico" :disabled="uploading" @change="uploadFile" />
      </label>

      <div v-if="galleryLoading" class="py-8 text-center text-sm text-muted-foreground">Carregando imagens...</div>
      <p v-else-if="images.length === 0" class="py-8 text-center text-sm text-muted-foreground">
        Nenhuma imagem enviada ainda.
      </p>
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <div
          v-for="image in images"
          :key="image.name"
          class="group relative overflow-hidden rounded-lg border transition-colors"
          :class="modelValue === image.url ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/60'"
        >
          <button type="button" class="block w-full" @click="selectImage(image)">
            <div class="flex h-24 items-center justify-center bg-muted/40 p-2">
              <img :src="image.url" :alt="image.name" class="max-h-full max-w-full object-contain" loading="lazy" />
            </div>
            <p class="truncate border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground" :title="image.name">
              {{ image.name }}
            </p>
          </button>
          <button
            type="button"
            class="absolute right-1 top-1 hidden rounded-md bg-background/90 p-1 text-destructive shadow group-hover:block"
            :aria-label="`Apagar ${image.name}`"
            @click.stop="removeImage(image)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
    <template #footer>
      <Button type="button" variant="outline" @click="galleryOpen = false">Fechar</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Image as ImageIcon, Images, Trash2, UploadCloud, X } from "lucide-vue-next";
import { ref } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { api, ApiError } from "@/services/api";

export type UploadedImage = {
  name: string;
  url: string;
  size: number;
  criadoEm: string;
};

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const galleryOpen = ref(false);
const galleryLoading = ref(false);
const galleryError = ref("");
const uploading = ref(false);
const images = ref<UploadedImage[]>([]);

function openGallery(): void {
  galleryOpen.value = true;
  void loadImages();
}

async function loadImages(): Promise<void> {
  galleryLoading.value = true;
  galleryError.value = "";
  try {
    images.value = await api.get<UploadedImage[]>("/uploads");
  } catch (requestError) {
    galleryError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar as imagens.";
  } finally {
    galleryLoading.value = false;
  }
}

function selectImage(image: UploadedImage): void {
  emit("update:modelValue", image.url);
  galleryOpen.value = false;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  uploading.value = true;
  galleryError.value = "";
  try {
    const dataBase64 = await readAsDataUrl(file);
    const uploaded = await api.post<UploadedImage>("/uploads", { nome: file.name, dataBase64 });
    images.value = [uploaded, ...images.value];
    emit("update:modelValue", uploaded.url);
    galleryOpen.value = false;
  } catch (requestError) {
    galleryError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel enviar a imagem.";
  } finally {
    uploading.value = false;
  }
}

async function removeImage(image: UploadedImage): Promise<void> {
  if (!window.confirm(`Apagar ${image.name}? Hotspots que usam esta imagem ficarao sem logo.`)) return;

  galleryError.value = "";
  try {
    await api.delete(`/uploads/${image.name}`);
    images.value = images.value.filter((item) => item.name !== image.name);
    if (props.modelValue === image.url) {
      emit("update:modelValue", "");
    }
  } catch (requestError) {
    galleryError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel apagar a imagem.";
  }
}
</script>
