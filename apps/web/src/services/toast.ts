import { reactive } from "vue";

export type ToastVariant = "default" | "destructive" | "success";

export type ToastMessage = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

const toasts = reactive<ToastMessage[]>([]);
let nextToastId = 1;

function remove(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

function show(input: Omit<ToastMessage, "id" | "variant"> & { variant?: ToastVariant; durationMs?: number }): number {
  const id = nextToastId;
  nextToastId += 1;

  toasts.push({
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
  });

  window.setTimeout(() => remove(id), input.durationMs ?? 5000);
  return id;
}

export function useToasts() {
  return {
    toasts,
    remove,
  };
}

export const toast = {
  show,
  success: (title: string, description?: string) => show({ title, description, variant: "success" }),
  error: (title: string, description?: string) => show({ title, description, variant: "destructive", durationMs: 7000 }),
  info: (title: string, description?: string) => show({ title, description, variant: "default" }),
};
