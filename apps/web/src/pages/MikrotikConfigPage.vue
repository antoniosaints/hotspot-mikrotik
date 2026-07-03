<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Integracao</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Configuracao MikroTik</h2>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
          Comandos de referencia para ativar API, login HTTP e arquivos do portal no Hotspot.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Select v-model="selectedHotspotId" class="min-w-60" placeholder="Selecione o hotspot">
          <option v-for="hotspot in hotspots" :key="hotspot.id" :value="hotspot.id">{{ hotspot.nome }}</option>
        </Select>
        <Button
          v-for="file in hotspotFiles"
          :key="file"
          :disabled="!selectedHotspotId"
          variant="secondary"
          @click="downloadHotspotFile(file)"
        >
          <Download class="h-4 w-4" />
          {{ file }}.html
        </Button>
      </div>
    </div>

    <Alert>
      Baixe os arquivos <strong>login.html</strong>, <strong>alogin.html</strong>, <strong>status.html</strong> e
      <strong>logout.html</strong>. Envie todos para a pasta de arquivos do Hotspot no MikroTik, junto com <strong>md5.js</strong>.
      O destino apos autenticar e definido em <strong>Hotspots &gt; URL pos-login</strong>.
    </Alert>
    <Alert v-if="downloadError" variant="destructive">{{ downloadError }}</Alert>

    <div class="grid gap-5 xl:grid-cols-2">
      <Card v-for="section in sections" :key="section.title" :title="section.title" :description="section.description">
        <pre class="overflow-auto rounded-md bg-background/80 p-4 text-xs leading-6 text-blue-100"><code>{{ section.command }}</code></pre>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Select from "@/components/ui/Select.vue";
import { api, apiUrl, getToken, handleUnauthorized } from "@/services/api";
import type { Hotspot } from "@/types/hotspot";

const hotspots = ref<Hotspot[]>([]);
const selectedHotspotId = ref("");
const downloadError = ref("");
const hotspotFiles = ["login", "alogin", "status", "logout"] as const;
type HotspotFile = (typeof hotspotFiles)[number];

const selectedHotspot = computed(() => hotspots.value.find((hotspot) => hotspot.id === selectedHotspotId.value));
const portalUrl = computed(() => selectedHotspot.value?.portalUrl ?? "http://SEU-SERVIDOR:5173/portal/seu-hotspot");
const dnsName = computed(() => {
  try {
    return new URL(portalUrl.value).host;
  } catch {
    return "SEU-SERVIDOR";
  }
});

const sections = computed(() => [
  {
    title: "1. Habilitar API",
    description: "Libere a porta usada pelo backend para criar usuarios temporarios.",
    command: `/ip service set api disabled=no port=8728
/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Hotspot API backend"`,
  },
  {
    title: "2. Usuario para API",
    description: "Crie um usuario dedicado com permissao suficiente para hotspot user.",
    command: `/user group add name=hotspot-api policy=read,write,api,!local,!telnet,!ssh,!ftp,!reboot,!policy,!test,!winbox,!password,!web,!sniff,!sensitive,!romon
/user add name=hotspot-api password=SENHA_FORTE group=hotspot-api`,
  },
  {
    title: "3. Profile de login",
    description: "Ative CHAP/PAP no Server Profile e use o User Profile no cadastro do MikroTik da plataforma.",
    command: `/ip hotspot profile set [find] login-by=http-chap,http-pap
/ip hotspot user profile add name=hotspot-temporario shared-users=1 keepalive-timeout=2m status-autorefresh=1m

Na plataforma, em MikroTiks > Profile de usuario Hotspot, use:
hotspot-temporario

Se preferir usar o profile ja existente do RouterOS, normalmente use:
default`,
  },
  {
    title: "4. Walled garden",
    description: "Permita o acesso ao servidor do portal antes da autenticacao.",
    command: `/ip hotspot walled-garden add dst-host=${dnsName.value} action=allow
/ip hotspot walled-garden ip add dst-host=${dnsName.value} action=accept`,
  },
  {
    title: "5. Arquivos do portal",
    description: "Envie os arquivos customizados para Files no MikroTik.",
    command: `Files > hotspot/login.html
Files > hotspot/alogin.html
Files > hotspot/status.html
Files > hotspot/logout.html
Files > hotspot/md5.js

O login.html redireciona para:
${portalUrl.value}

Para escolher o site aberto apos autenticar, configure:
Hotspots > URL pos-login`,
  },
]);

async function downloadHotspotFile(file: HotspotFile): Promise<void> {
  if (!selectedHotspotId.value) return;
  downloadError.value = "";
  const path = `/hotspots/${selectedHotspotId.value}/${file}-html`;
  const token = getToken();
  const response = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(path);
    }
    downloadError.value = text || `Nao foi possivel baixar o ${file}.html.`;
    return;
  }

  if (!contentType.toLowerCase().includes("text/") || !text.trim()) {
    downloadError.value = `A API retornou uma resposta invalida para o ${file}.html.`;
    return;
  }

  const blob = new Blob([text], { type: contentType || "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${file}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  hotspots.value = await api.get<Hotspot[]>("/hotspots");
  if (hotspots.value[0]) {
    selectedHotspotId.value = hotspots.value[0].id;
  }
});
</script>
