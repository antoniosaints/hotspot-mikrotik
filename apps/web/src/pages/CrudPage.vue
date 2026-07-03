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

    <Card>
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
          <tr v-if="items.length === 0">
            <td :colspan="columns.length + 1" class="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado.
            </td>
          </tr>
          <tr v-for="item in items" :key="item.id" class="bg-card/40">
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
    </Card>

    <Dialog
      v-model:open="modalOpen"
      :width-class="modalWidthClass"
      :title="editingItem ? `Editar ${singularTitle}` : `Novo ${singularTitle}`"
      :description="formDescription"
    >
      <form id="crud-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="submitForm">
        <div v-for="field in visibleFields" :key="field.key" :class="field.full ? 'sm:col-span-2' : ''">
          <div v-if="field.type === 'section'" class="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <h3 class="text-sm font-semibold text-foreground">{{ field.label }}</h3>
            <p v-if="field.help" class="mt-1 text-xs leading-5 text-muted-foreground">{{ field.help }}</p>
          </div>
          <template v-else>
            <Label :for="field.key">{{ field.label }}</Label>
            <div v-if="field.type === 'choice-cards'" class="mt-2 grid gap-3 sm:grid-cols-2">
              <button
                v-for="option in field.options ?? []"
                :key="option.value"
                type="button"
                class="rounded-lg border bg-background/60 p-4 text-left transition-colors hover:border-primary/70"
                :class="selectValue(field.key) === option.value ? 'border-primary ring-2 ring-primary/20' : 'border-border'"
                @click="form[field.key] = option.value"
              >
                <span class="block text-sm font-semibold text-foreground">{{ option.label }}</span>
                <span v-if="option.description" class="mt-1 block text-xs leading-5 text-muted-foreground">{{ option.description }}</span>
              </button>
            </div>
            <Select
              v-else-if="field.type === 'select'"
              :id="field.key"
              :model-value="selectValue(field.key)"
              class="mt-2"
              :placeholder="field.placeholder ?? 'Selecione'"
              @update:model-value="form[field.key] = $event"
            >
              <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </Select>
            <label v-else-if="field.type === 'checkbox-card'" class="mt-2 flex cursor-pointer gap-3 rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-primary/60">
              <input v-model="form[field.key]" class="mt-1 h-4 w-4 flex-none accent-blue-500" type="checkbox" />
              <span>
                <span class="block text-sm font-semibold text-foreground">{{ field.label }}</span>
                <span v-if="field.help" class="mt-1 block text-xs leading-5 text-muted-foreground">{{ field.help }}</span>
              </span>
            </label>
            <label v-else-if="field.type === 'checkbox'" class="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input v-model="form[field.key]" class="h-4 w-4 accent-blue-500" type="checkbox" />
              {{ field.help ?? "Habilitado" }}
            </label>
            <Input
              v-else
              :id="field.key"
              v-model="form[field.key]"
              class="mt-2"
              :type="field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'"
              :min="field.type === 'number' ? 1 : undefined"
              :placeholder="field.placeholder"
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
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError } from "@/services/api";

export type CrudRecord = { id: string; [key: string]: unknown };
export type CrudColumn = {
  key: string;
  label: string;
  type?: "text" | "boolean" | "status" | "date";
};
export type CrudField = {
  key: string;
  label: string;
  type: "text" | "number" | "password" | "checkbox" | "checkbox-card" | "select" | "choice-cards" | "section";
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  help?: string;
  full?: boolean;
  options?: Array<{ label: string; value: string; description?: string }>;
  visibleWhen?: (form: Record<string, string | number | boolean | null>) => boolean;
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
}>();

const items = ref<CrudRecord[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const modalOpen = ref(false);
const editingItem = ref<CrudRecord | null>(null);
const form = reactive<Record<string, string | number | boolean | null>>({});

const eyebrow = computed(() => props.eyebrow ?? "Cadastro");
const formDescription = computed(() => props.formDescription ?? "Preencha os dados e salve para atualizar a lista.");
const modalWidthClass = computed(() => props.modalWidthClass ?? "max-w-2xl");
const visibleFields = computed(() => props.fields.filter((field) => !field.visibleWhen || field.visibleWhen(form)));

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
  const value = readValue(item, column.key);
  if (column.type === "date") return formatDate(value);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function selectValue(key: string): string {
  const value = form[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function resetForm(item?: CrudRecord): void {
  for (const field of props.fields) {
    if (field.type === "section") continue;
    const value = item ? readValue(item, field.key) : field.defaultValue;
    form[field.key] = value === undefined ? "" : (value as string | number | boolean | null);
  }
}

function formMatchesBaseline(item?: CrudRecord): boolean {
  return props.fields.every((field) => {
    if (field.type === "section") return true;
    const value = item ? readValue(item, field.key) : field.defaultValue;
    const baseline = value === undefined ? "" : value;
    return form[field.key] === baseline;
  });
}

function normalizePayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of props.fields) {
    if (field.type === "section") continue;
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
  modalOpen.value = true;
}

function openEdit(item: CrudRecord): void {
  editingItem.value = item;
  resetForm(item);
  modalOpen.value = true;
}

async function submitForm(): Promise<void> {
  saving.value = true;
  error.value = "";
  try {
    if (editingItem.value) {
      await api.put(`${props.endpoint}/${editingItem.value.id}`, normalizePayload());
    } else {
      await api.post(props.endpoint, normalizePayload());
    }
    modalOpen.value = false;
    await loadItems();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar o registro.";
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
    await loadItems();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel apagar o registro.";
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

onMounted(loadItems);

defineExpose({ loadItems });
</script>
