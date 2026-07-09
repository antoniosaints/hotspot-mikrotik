<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">{{ eyebrow }}</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">{{ title }}</h2>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">{{ description }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" @click="loadItems">
          <RefreshCw class="h-4 w-4" />
          Recarregar
        </Button>
        <slot name="toolbar" :reload="loadItems" />
        <Button :disabled="createDisabled" :title="createDisabledReason" @click="openCreate">Novo</Button>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>
    <DataTableControls
      v-if="!loading || items.length > 0"
      v-model:search="searchTerm"
      v-model:page="currentPage"
      v-model:page-size="pageSize"
      :total="items.length"
      :filtered-total="filteredItems.length"
      :total-pages="totalPages"
    />

    <div>
      <div v-if="loading" class="py-10 text-center text-sm text-muted-foreground">Carregando registros...</div>
      <Table v-else>
        <thead class="bg-muted/60">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
            >
              {{ column.label }}
            </th>
            <th class="w-32 px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Acoes
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="filteredItems.length === 0">
            <td :colspan="columns.length + 1" class="px-4 py-10 text-center text-sm text-muted-foreground">
              {{ items.length === 0 ? "Nenhum registro encontrado." : "Nenhum registro encontrado para a busca." }}
            </td>
          </tr>
          <tr v-for="item in paginatedItems" :key="item.id" class="bg-card/40">
            <td v-for="column in columns" :key="column.key" class="min-w-36 px-4 py-3 text-sm">
              <span v-if="column.type === 'boolean'">
                <Badge :variant="readValue(item, column.key) ? 'default' : 'secondary'">
                  {{ readValue(item, column.key) ? "Ativo" : "Inativo" }}
                </Badge>
              </span>
              <span v-else-if="column.type === 'status'">
                <Badge :variant="readValue(item, column.key) ? 'destructive' : 'default'">
                  {{ readValue(item, column.key) ? "Usado" : "Disponivel" }}
                </Badge>
              </span>
              <span v-else class="break-words text-foreground">{{ formatCell(item, column) }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <slot name="row-actions" :item="item" :reload="loadItems" />
                <Button size="icon" variant="ghost" aria-label="Editar" @click="openEdit(item)">
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button v-if="canDelete(item)" size="icon" variant="ghost" aria-label="Apagar" @click="removeItem(item)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </Table>
    </div>

    <Dialog
      v-model:open="modalOpen"
      :width-class="modalWidthClass"
      :title="editingItem ? `Editar ${singularTitle}` : `Novo ${singularTitle}`"
      :description="formDescription"
    >
      <div v-if="formTabs.length > 0" class="mb-4 space-y-3">
        <div class="flex flex-wrap gap-1 rounded-md border border-border bg-muted p-1">
          <button
            v-for="tab in formTabs"
            :key="tab.value"
            class="focus-ring rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
            :class="tab.value === activeTab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            type="button"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <p v-if="activeTabDescription" class="text-xs leading-5 text-muted-foreground">{{ activeTabDescription }}</p>
      </div>
      <form id="crud-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="submitForm">
        <div v-for="field in visibleFields" :key="field.key" :class="field.full ? 'sm:col-span-2' : ''">
          <div v-if="field.type === 'section'" class="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <h3 class="text-sm font-semibold text-foreground">{{ field.label }}</h3>
            <p v-if="field.help" class="mt-1 text-xs leading-5 text-muted-foreground">{{ field.help }}</p>
          </div>
          <template v-else>
            <Label :for="field.key">{{ field.label }}</Label>
            <Input
              v-if="field.derivedValue"
              :id="field.key"
              :model-value="derivedDisplay(field)"
              class="mt-2 cursor-not-allowed opacity-70"
              readonly
              tabindex="-1"
              :placeholder="field.placeholder"
            />
            <div v-else-if="field.type === 'choice-cards'" class="mt-2 grid gap-3 sm:grid-cols-2">
              <button
                v-for="option in fieldOptions(field)"
                :key="option.value"
                type="button"
                class="rounded-lg border bg-background/60 p-4 text-left transition-colors hover:border-primary/70"
                :class="selectValue(field.key) === option.value ? 'border-primary ring-2 ring-primary/20' : 'border-border'"
                :disabled="fieldDisabled(field)"
                @click="form[field.key] = option.value"
              >
                <span class="block text-sm font-semibold text-foreground">{{ option.label }}</span>
                <span v-if="option.description" class="mt-1 block text-xs leading-5 text-muted-foreground">{{ option.description }}</span>
              </button>
            </div>
            <div v-else-if="field.type === 'multiselect'" class="mt-2 grid gap-2 sm:grid-cols-2">
              <p v-if="fieldOptions(field).length === 0" class="text-sm text-muted-foreground sm:col-span-2">
                Nenhuma opcao disponivel.
              </p>
              <label
                v-for="option in fieldOptions(field)"
                :key="option.value"
                class="flex cursor-pointer items-start gap-3 rounded-lg border bg-background/50 p-3 transition-colors hover:border-primary/60"
                :class="multiselectValues(field.key).includes(option.value) ? 'border-primary ring-2 ring-primary/20' : 'border-border'"
              >
                <input
                  class="mt-1 h-4 w-4 flex-none accent-blue-500"
                  type="checkbox"
                  :checked="multiselectValues(field.key).includes(option.value)"
                  :disabled="fieldDisabled(field)"
                  @change="toggleMultiselect(field.key, option.value)"
                />
                <span>
                  <span class="block text-sm font-semibold text-foreground">{{ option.label }}</span>
                  <span v-if="option.description" class="mt-1 block text-xs leading-5 text-muted-foreground">{{ option.description }}</span>
                </span>
              </label>
            </div>
            <Select
              v-else-if="field.type === 'select'"
              :id="field.key"
              :model-value="selectValue(field.key)"
              class="mt-2"
              :placeholder="field.placeholder ?? 'Selecione'"
              :disabled="fieldDisabled(field)"
              @update:model-value="form[field.key] = $event"
            >
              <option v-for="option in fieldOptions(field)" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </Select>
            <label v-else-if="field.type === 'checkbox-card'" class="mt-2 flex cursor-pointer gap-3 rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-primary/60">
              <input v-model="form[field.key]" class="mt-1 h-4 w-4 flex-none accent-blue-500" type="checkbox" :disabled="fieldDisabled(field)" />
              <span>
                <span class="block text-sm font-semibold text-foreground">{{ field.label }}</span>
                <span v-if="field.help" class="mt-1 block text-xs leading-5 text-muted-foreground">{{ field.help }}</span>
              </span>
            </label>
            <ImagePicker
              v-else-if="field.type === 'image'"
              :model-value="selectValue(field.key)"
              :disabled="fieldDisabled(field)"
              @update:model-value="form[field.key] = $event"
            />
            <div v-else-if="field.type === 'color'" class="mt-2 flex items-center gap-2">
              <input
                type="color"
                class="h-9 w-12 flex-none cursor-pointer rounded-md border border-input bg-background p-1"
                :aria-label="`Selecionar ${field.label}`"
                :value="colorSwatchValue(field.key)"
                :disabled="fieldDisabled(field)"
                @input="form[field.key] = ($event.target as HTMLInputElement).value"
              />
              <Input
                :id="field.key"
                class="flex-1"
                :model-value="inputValue(field.key)"
                :placeholder="field.placeholder"
                :disabled="fieldDisabled(field)"
                @update:model-value="form[field.key] = $event"
              />
            </div>
            <label v-else-if="field.type === 'checkbox'" class="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input v-model="form[field.key]" class="h-4 w-4 accent-blue-500" type="checkbox" :disabled="fieldDisabled(field)" />
              {{ field.help ?? "Habilitado" }}
            </label>
            <Input
              v-else
              :id="field.key"
              :model-value="inputValue(field.key)"
              class="mt-2"
              @update:model-value="form[field.key] = $event"
              :type="field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'"
              :min="field.type === 'number' ? 1 : undefined"
              :placeholder="field.placeholder"
              :disabled="fieldDisabled(field)"
            />
            <p v-if="field.help && field.type !== 'checkbox' && field.type !== 'checkbox-card'" class="mt-1 text-xs text-muted-foreground">{{ field.help }}</p>
          </template>
        </div>
      </form>
      <template #footer>
        <Button variant="outline" @click="modalOpen = false">Cancelar</Button>
        <Button type="submit" form="crud-form" :disabled="saving">{{ saving ? "Salvando..." : "Salvar" }}</Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Pencil, RefreshCw, Trash2 } from "lucide-vue-next";
import { computed, onMounted, reactive, ref, watch } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import DataTableControls from "@/components/ui/DataTableControls.vue";
import Dialog from "@/components/ui/Dialog.vue";
import ImagePicker from "@/components/ui/ImagePicker.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";
import { toast } from "@/services/toast";

export type CrudRecord = { id: string; [key: string]: unknown };
export type CrudFormValue = string | number | boolean | null | string[];
export type CrudColumn = {
  key: string;
  label: string;
  type?: "text" | "boolean" | "status" | "date";
  format?: (item: CrudRecord) => string;
};
export type CrudFormTab = { label: string; value: string; description?: string };
export type CrudField = {
  key: string;
  label: string;
  type: "text" | "number" | "password" | "checkbox" | "checkbox-card" | "select" | "multiselect" | "choice-cards" | "section" | "image" | "color";
  // Aba do formulario onde o campo aparece (quando `formTabs` esta definido).
  // Campos sem `tab` ficam na primeira aba.
  tab?: string;
  defaultValue?: CrudFormValue;
  placeholder?: string;
  help?: string;
  full?: boolean;
  options?: Array<{ label: string; value: string; description?: string }>;
  // Opcoes que dependem de outros campos do formulario (ex.: servidores do
  // MikroTik selecionado). Tem prioridade sobre `options`.
  dynamicOptions?: (form: Record<string, CrudFormValue>) => Array<{ label: string; value: string; description?: string }>;
  // Deriva o valor do formulario a partir do registro (ex.: multiselect de
  // relacoes N:N, onde o item traz objetos e o form precisa de ids).
  getValue?: (item: CrudRecord) => CrudFormValue;
  // Campo somente leitura calculado a partir dos demais campos do formulario
  // (ex.: URL do portal gerada do slug). O valor exibido e enviado no payload
  // vem sempre desta funcao, ignorando o que estiver salvo no registro.
  derivedValue?: (form: Record<string, CrudFormValue>) => CrudFormValue;
  visibleWhen?: (form: Record<string, CrudFormValue>) => boolean;
  disabledWhen?: (form: Record<string, CrudFormValue>) => boolean;
  clearWhenHidden?: boolean;
};

const props = defineProps<{
  title: string;
  singularTitle: string;
  description: string;
  endpoint: string;
  columns: CrudColumn[];
  fields: CrudField[];
  eyebrow?: string;
  formDescription?: string;
  createDisabled?: boolean;
  createDisabledReason?: string;
  modalWidthClass?: string;
  deletableWhen?: (item: CrudRecord) => boolean;
  formTabs?: CrudFormTab[];
}>();

const items = ref<CrudRecord[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const searchTerm = ref("");
const currentPage = ref(1);
const pageSize = ref(10);
const modalOpen = ref(false);
const editingItem = ref<CrudRecord | null>(null);
const form = reactive<Record<string, CrudFormValue>>({});

const eyebrow = computed(() => props.eyebrow ?? "Cadastro");
const formDescription = computed(() => props.formDescription ?? "Preencha os dados e salve para atualizar a lista.");
const modalWidthClass = computed(() => props.modalWidthClass ?? "max-w-2xl");
const formTabs = computed(() => props.formTabs ?? []);
const activeTab = ref("");
const activeTabDescription = computed(() => formTabs.value.find((tab) => tab.value === activeTab.value)?.description);
const visibleFields = computed(() =>
  props.fields.filter((field) => {
    if (field.visibleWhen && !field.visibleWhen(form)) return false;
    if (formTabs.value.length === 0) return true;
    return (field.tab ?? formTabs.value[0]?.value) === activeTab.value;
  }),
);
const filteredItems = computed(() => {
  const term = searchTerm.value.trim().toLocaleLowerCase("pt-BR");
  if (!term) return items.value;

  return items.value.filter((item) =>
    props.columns.some((column) => formatCell(item, column).toLocaleLowerCase("pt-BR").includes(term)),
  );
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)));
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

function readValue(item: CrudRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value && typeof value === "object" && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, item);
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
}

function formatCell(item: CrudRecord, column: CrudColumn): string {
  if (column.format) return column.format(item);
  const value = readValue(item, column.key);
  if (column.type === "date") return formatDate(value);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function fieldOptions(field: CrudField): Array<{ label: string; value: string; description?: string }> {
  return field.dynamicOptions ? field.dynamicOptions(form) : field.options ?? [];
}

function fieldDisabled(field: CrudField): boolean {
  return Boolean(field.disabledWhen?.(form));
}

function multiselectValues(key: string): string[] {
  const value = form[key];
  return Array.isArray(value) ? value : [];
}

function toggleMultiselect(key: string, optionValue: string): void {
  const values = multiselectValues(key);
  form[key] = values.includes(optionValue)
    ? values.filter((item) => item !== optionValue)
    : [...values, optionValue];
}

function inputValue(key: string): string | number | boolean | null {
  const value = form[key];
  return Array.isArray(value) ? value.join(",") : value;
}

function selectValue(key: string): string {
  const value = form[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

// Campos derivados sao sempre recalculados a partir do form atual, entao a
// exibicao acompanha em tempo real as mudancas nos campos de origem.
function derivedDisplay(field: CrudField): string {
  if (!field.derivedValue) return "";
  const value = field.derivedValue(form);
  return value === null || value === undefined ? "" : String(value);
}

// O input type=color exige #rrggbb; valores invalidos ou vazios usam um
// cinza neutro apenas como ponto de partida do seletor.
function colorSwatchValue(key: string): string {
  const value = selectValue(key).trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return "#808080";
}

function baselineValue(field: CrudField, item?: CrudRecord): CrudFormValue {
  if (item) {
    const value = field.getValue ? field.getValue(item) : readValue(item, field.key);
    if (field.type === "multiselect") return Array.isArray(value) ? [...(value as string[])] : [];
    return value === undefined ? "" : (value as CrudFormValue);
  }

  if (field.type === "multiselect") {
    return Array.isArray(field.defaultValue) ? [...field.defaultValue] : [];
  }

  return field.defaultValue === undefined ? "" : field.defaultValue;
}

function resetForm(item?: CrudRecord): void {
  form.__id = item?.id ?? "";
  for (const field of props.fields) {
    // Campos de secao nao tem estado; derivados sao calculados sob demanda.
    if (field.type === "section" || field.derivedValue) continue;
    form[field.key] = baselineValue(field, item);
  }
}

function formMatchesBaseline(item?: CrudRecord): boolean {
  return props.fields.every((field) => {
    if (field.type === "section" || field.derivedValue) return true;
    const baseline = baselineValue(field, item);
    const current = form[field.key];
    if (Array.isArray(baseline) || Array.isArray(current)) {
      return JSON.stringify(baseline) === JSON.stringify(current);
    }
    return current === baseline;
  });
}

function normalizePayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of props.fields) {
    if (field.type === "section") continue;

    if (field.derivedValue) {
      const derived = field.derivedValue(form);
      payload[field.key] = derived === "" || derived === undefined ? null : derived;
      continue;
    }

    const visible = !field.visibleWhen || field.visibleWhen(form);
    if (!visible && field.clearWhenHidden) {
      payload[field.key] = null;
      continue;
    }

    const value = form[field.key];
    if (field.type === "number") {
      payload[field.key] = Number(value);
    } else if (field.type === "checkbox" || field.type === "checkbox-card") {
      payload[field.key] = Boolean(value);
    } else if (field.type === "multiselect") {
      payload[field.key] = Array.isArray(value) ? value : [];
    } else if (value === "") {
      payload[field.key] = null;
    } else {
      payload[field.key] = value;
    }
  }
  return payload;
}

async function loadItems(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    items.value = await api.get<CrudRecord[]>(props.endpoint);
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar os registros.";
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  if (props.createDisabled) return;
  editingItem.value = null;
  resetForm();
  activeTab.value = formTabs.value[0]?.value ?? "";
  modalOpen.value = true;
}

function openEdit(item: CrudRecord): void {
  editingItem.value = item;
  resetForm(item);
  activeTab.value = formTabs.value[0]?.value ?? "";
  modalOpen.value = true;
}

async function submitForm(): Promise<void> {
  saving.value = true;
  try {
    if (editingItem.value) {
      await api.put(`${props.endpoint}/${editingItem.value.id}`, normalizePayload());
    } else {
      await api.post(props.endpoint, normalizePayload());
    }
    modalOpen.value = false;
    toast.success("Registro salvo", `${props.singularTitle.charAt(0).toUpperCase()}${props.singularTitle.slice(1)} salvo com sucesso.`);
    await loadItems();
  } catch (requestError) {
    toast.error("Nao foi possivel salvar", requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar o registro.");
  } finally {
    saving.value = false;
  }
}

async function removeItem(item: CrudRecord): Promise<void> {
  if (!canDelete(item)) return;
  const name = String(readValue(item, "nome") ?? readValue(item, "codigo") ?? item.id);
  if (!window.confirm(`Apagar ${name}?`)) return;

  error.value = "";
  try {
    await api.delete(`${props.endpoint}/${item.id}`);
    toast.success("Registro apagado", `${name} foi removido.`);
    await loadItems();
  } catch (requestError) {
    toast.error("Nao foi possivel apagar", requestError instanceof ApiError ? requestError.message : "Nao foi possivel apagar o registro.");
  }
}

function canDelete(item: CrudRecord): boolean {
  return props.deletableWhen ? props.deletableWhen(item) : true;
}

watch(
  () => props.fields,
  () => {
    if (!modalOpen.value) {
      resetForm(editingItem.value ?? undefined);
      return;
    }

    if (!editingItem.value && formMatchesBaseline()) {
      resetForm();
    }
  },
  { deep: true },
);

watch([searchTerm, pageSize], () => {
  currentPage.value = 1;
});

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages;
});

onMounted(loadItems);

defineExpose({ loadItems });
</script>
