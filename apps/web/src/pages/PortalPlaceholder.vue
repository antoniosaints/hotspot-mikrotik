<template>
  <main class="min-h-screen bg-background p-4 text-foreground">
    <div class="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl items-center">
      <Card title="Portal Hotspot" :description="`Placeholder publico para o slug ${slug}.`">
        <div class="space-y-4">
          <Alert>O fluxo real de autenticacao do portal fica para a task de paginas.</Alert>
          <Button type="button">Continuar</Button>
        </div>
      </Card>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";

const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ""));
</script>
