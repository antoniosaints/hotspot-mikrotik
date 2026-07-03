<template>
  <main class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
    <Card class="w-full max-w-md" title="Acesso administrativo" description="Placeholder visual para a tela de login.">
      <form class="space-y-4">
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input id="email" type="email" placeholder="admin@hotspot.local" />
        </div>
        <div class="space-y-2">
          <Label for="password">Senha</Label>
          <Input id="password" type="password" placeholder="Sua senha" />
        </div>
        <Button class="w-full" type="button">Entrar</Button>
      </form>
    </Card>
  </main>
</template>

<script setup lang="ts">
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
</script>
