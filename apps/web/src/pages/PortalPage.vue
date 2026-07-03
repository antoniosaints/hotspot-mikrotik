<template>
  <main class="portal-shell">
    <div class="portal-app">
      <section class="brand">
        <div class="brand-badge">
          <img class="brand-logo" src="../assets/img/LOGO_CAS.png" alt="Logo CAS Internet" />
        </div>
        <h1 class="font-bold">ACESSO CAS INTERNET</h1>
        <p>Conecte-se a internet de forma rapida e segura</p>
      </section>

      <section class="portal-card">
        <div v-if="routerError" class="alert">{{ routerError }}</div>
        <div v-if="error" class="alert">{{ error }}</div>

        <div v-if="activeScreen === 'home'" class="screen active">
          <h2 class="title">Olá! Seja bem-vindo!</h2>
          <p class="subtitle">Escolha abaixo como deseja acessar a rede.</p>

          <div class="menu">
            <button
              v-if="portal?.loginTypes.cpf"
              type="button"
              class="menu-btn"
              @click="openLogin('cpf')"
            >
              <span class="icon"><UserRound class="h-5 w-5" /></span>
              <span>
                <strong>Tenho cadastro</strong>
                <small>Acesse usando seu cadastro</small>
              </span>
            </button>

            <button
              v-if="portal?.loginTypes.ixc"
              type="button"
              class="menu-btn"
              @click="openLogin('ixc')"
            >
              <span class="icon"><RadioTower class="h-5 w-5" /></span>
              <span>
                <strong>Sou Cliente</strong>
                <small>Acesse validando seu CPF ou CNPJ</small>
              </span>
            </button>

            <button type="button" class="menu-btn" @click="openInfo('Cadastro de novos clientes ainda nao esta habilitado neste hotspot.')">
              <span class="icon"><Phone class="h-5 w-5" /></span>
              <span>
                <strong>Quero contratar</strong>
                <small>Informe seus dados para atendimento</small>
              </span>
            </button>

            <button
              v-if="portal?.loginTypes.voucher"
              type="button"
              class="menu-btn"
              @click="openLogin('voucher')"
            >
              <span class="icon"><Ticket class="h-5 w-5" /></span>
              <span>
                <strong>Tenho Voucher</strong>
                <small>Use seu código de acesso</small>
              </span>
            </button>

            <button
              v-if="portal?.loginTypes.compra"
              type="button"
              class="menu-btn"
              @click="openPurchase"
            >
              <span class="icon"><CreditCard class="h-5 w-5" /></span>
              <span>
                <strong>Comprar acesso</strong>
                <small>Escolha um pacote e pague via PIX</small>
              </span>
            </button>
          </div>

          <p v-if="portal && tabs.length === 0 && !portal.loginTypes.compra" class="empty-state">Nenhum tipo de login esta ativo para este hotspot.</p>
        </div>

        <form v-else-if="activeScreen === 'cpf'" class="screen active" @submit.prevent="submit">
          <h2 class="title">Cadastro interno</h2>
          <p class="subtitle">Digite seu CPF para continuar.</p>

          <label for="cpf">CPF</label>
          <input id="cpf" :value="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" @input="updateDocument" />

          <button class="primary" type="submit" :disabled="loading">{{ loading ? "Liberando..." : "Continuar" }}</button>
          <button type="button" class="secondary" @click="goHome">Voltar</button>
        </form>

        <form v-else-if="activeScreen === 'ixc'" class="screen active" @submit.prevent="submit">
          <h2 class="title">Cliente CAS</h2>
          <p class="subtitle">Digite seu CPF ou CNPJ para validar seu contrato.</p>

          <label for="ixc-document">CPF/CNPJ</label>
          <input id="ixc-document" :value="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" @input="updateDocument" />

          <button class="primary" type="submit" :disabled="loading">{{ loading ? "Validando..." : "Validar acesso" }}</button>
          <button type="button" class="secondary" @click="goHome">Voltar</button>
        </form>

        <div v-else-if="activeScreen === 'ixcNotFound'" class="screen active">
          <h2 class="title">Cadastro nao encontrado</h2>
          <p class="subtitle">Nao encontramos esse CPF/CNPJ na base. Voce pode contratar um plano ou comprar um acesso avulso.</p>
          <button type="button" class="primary" @click="openInfo('Cadastro de novos clientes ainda nao esta habilitado neste hotspot.')">Quero contratar</button>
          <button v-if="portal?.loginTypes.compra" type="button" class="secondary" @click="openPurchase">Comprar acesso</button>
          <button type="button" class="secondary" @click="openLogin('ixc')">Voltar</button>
        </div>

        <div v-else-if="activeScreen === 'ixcInvoices'" class="screen active">
          <h2 class="title">Regularizar mensalidade</h2>
          <p class="subtitle">Encontramos pendencia no mes atual. Escolha a mensalidade para gerar o PIX.</p>

          <div class="plans">
            <button
              v-for="invoice in ixcInvoices"
              :key="invoice.id"
              type="button"
              class="plan-btn"
              :class="{ selected: selectedIxcInvoiceId === invoice.id }"
              @click="selectedIxcInvoiceId = invoice.id"
            >
              <strong>Boleto {{ invoice.id }}</strong>
              <b>{{ invoice.valor }}</b>
            </button>
          </div>

          <button class="primary" type="button" :disabled="loading || !selectedIxcInvoiceId" @click="generateIxcPix">
            {{ loading ? "Gerando PIX..." : "Gerar PIX da mensalidade" }}
          </button>
          <button type="button" class="secondary" @click="openLogin('ixc')">Voltar</button>
        </div>

        <div v-else-if="activeScreen === 'ixcPayment'" class="screen active">
          <h2 class="title">Pagar mensalidade</h2>
          <p class="subtitle">Liberamos 4 minutos de acesso para voce realizar o pagamento. Depois, toque em verificar pagamento.</p>

          <img v-if="ixcPix?.imagemQrcode" class="pix-qr" :src="`data:image/png;base64,${ixcPix.imagemQrcode}`" alt="QR Code PIX" />
          <img v-else-if="ixcPix?.imageSrc" class="pix-qr" :src="ixcPix.imageSrc" alt="QR Code PIX" />
          <textarea v-if="ixcPix?.pixCopiaECola" class="pix-code" readonly :value="ixcPix.pixCopiaECola"></textarea>
          <button v-if="ixcPix?.pixCopiaECola" type="button" class="secondary" @click="copyIxcPix">Copiar PIX</button>

          <button class="primary" type="button" :disabled="loading" @click="recheckIxcPayment">
            {{ loading ? "Verificando..." : "Ja paguei, verificar acesso" }}
          </button>
          <button type="button" class="secondary" @click="goHome">Voltar</button>
        </div>

        <form v-else-if="activeScreen === 'voucher'" class="screen active" @submit.prevent="submit">
          <h2 class="title">Voucher</h2>
          <p class="subtitle">Informe o codigo recebido para liberar seu acesso.</p>

          <label for="voucher">Codigo do voucher</label>
          <input id="voucher" v-model="voucher" class="uppercase" autocomplete="one-time-code" placeholder="Digite seu voucher" />

          <button class="primary" type="submit" :disabled="loading">{{ loading ? "Liberando..." : "Validar voucher" }}</button>
          <button type="button" class="secondary" @click="goHome">Voltar</button>
        </form>

        <form v-else-if="activeScreen === 'purchase'" class="screen active" @submit.prevent="createPurchase">
          <h2 class="title">Comprar acesso</h2>
          <p class="subtitle">Escolha um plano e pague via PIX para liberar seu acesso.</p>

          <div class="plans">
            <button
              v-for="plan in portal?.hotspot.planos ?? []"
              :key="plan.id"
              type="button"
              class="plan-btn"
              :class="{ selected: selectedPlanId === plan.id }"
              @click="selectedPlanId = plan.id"
            >
              <strong>{{ plan.nome }}</strong>
              <span>{{ plan.tempoMinutos }} min · {{ plan.conexoesSimultaneas }} conexao(oes)</span>
              <b>{{ formatMoney(plan.valorCentavos) }}</b>
            </button>
          </div>

          <div v-if="selectedPlanNeedsForm" class="purchase-form">
            <label v-if="selectedPlan?.coletarNome" for="purchase-name">Nome</label>
            <input v-if="selectedPlan?.coletarNome" id="purchase-name" v-model="purchaseForm.nome" autocomplete="name" placeholder="Seu nome" />

            <label v-if="selectedPlan?.coletarTelefone" for="purchase-phone">Telefone</label>
            <input v-if="selectedPlan?.coletarTelefone" id="purchase-phone" v-model="purchaseForm.telefone" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" />

            <label v-if="selectedPlan?.coletarEmail" for="purchase-email">Email</label>
            <input v-if="selectedPlan?.coletarEmail" id="purchase-email" v-model="purchaseForm.email" type="email" autocomplete="email" placeholder="email@exemplo.com" />

            <label v-if="selectedPlan?.coletarCpf" for="purchase-cpf">CPF</label>
            <input v-if="selectedPlan?.coletarCpf" id="purchase-cpf" :value="purchaseForm.cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" @input="updatePurchaseCpf" />

            <label v-if="selectedPlan?.coletarEndereco" for="purchase-address">Endereco</label>
            <input v-if="selectedPlan?.coletarEndereco" id="purchase-address" v-model="purchaseForm.endereco" autocomplete="street-address" placeholder="Rua, numero, bairro" />
          </div>

          <button class="primary" type="submit" :disabled="loading || !selectedPlanId">{{ loading ? "Gerando PIX..." : "Gerar PIX" }}</button>
          <button type="button" class="secondary" @click="goHome">Voltar</button>
        </form>

        <div v-else-if="activeScreen === 'payment'" class="screen active">
          <h2 class="title">Pagamento PIX</h2>
          <p class="subtitle">Pague o PIX abaixo. A liberacao acontece automaticamente apos a confirmacao.</p>

          <img v-if="purchasePayment?.qrCodeBase64" class="pix-qr" :src="`data:image/png;base64,${purchasePayment.qrCodeBase64}`" alt="QR Code PIX" />
          <textarea v-if="purchasePayment?.qrCode" class="pix-code" readonly :value="purchasePayment.qrCode"></textarea>
          <button v-if="purchasePayment?.qrCode" class="secondary" type="button" @click="copyPix">Copiar PIX</button>

          <div class="payment-status">
            <strong>Status:</strong> {{ purchaseStatusLabel }}
          </div>

          <button class="primary" type="button" :disabled="purchaseStatus !== 'LIBERADO'" @click="finalizePurchaseLogin">
            {{ purchaseStatus === "LIBERADO" ? "Entrar agora" : "Aguardando pagamento..." }}
          </button>
          <button type="button" class="secondary" @click="goHome">Voltar</button>
        </div>
      </section>

      <div class="footer">CAS Internet - Acesso Hotspot</div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { CreditCard, Phone, RadioTower, Ticket, UserRound } from "lucide-vue-next";

import { api, ApiError, apiUrl } from "@/services/api";
import type { PortalInfo } from "@/types/hotspot";

type LoginScreen = "home" | "voucher" | "cpf" | "ixc" | "ixcNotFound" | "ixcInvoices" | "ixcPayment" | "purchase" | "payment";
type LoginTab = "voucher" | "cpf" | "ixc";

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const portal = ref<PortalInfo | null>(null);
const activeTab = ref<LoginTab>("voucher");
const activeScreen = ref<LoginScreen>("home");
const voucher = ref("");
const cpf = ref("");
const error = ref("");
const loading = ref(false);
const selectedPlanId = ref("");
const purchaseId = ref("");
const purchaseStatus = ref("");
const purchasePayment = ref<{ qrCode: string | null; qrCodeBase64: string | null } | null>(null);
let purchasePoll: number | undefined;
const purchaseForm = reactive({
  nome: "",
  telefone: "",
  email: "",
  cpf: "",
  endereco: "",
});
const ixcInvoices = ref<Array<{ id: string; valor: string }>>([]);
const selectedIxcInvoiceId = ref("");
type IxcPix = { pixCopiaECola: string; qrCode: string; imagemQrcode: string; imageSrc: string };
type IxcPaymentState = {
  cpf: string;
  invoiceId: string;
  pix: IxcPix;
  createdAt: number;
};
const ixcPix = ref<IxcPix | null>(null);

const query = computed(() => route.query);
const routerError = computed(() => (typeof query.value.error === "string" && query.value.error ? query.value.error : ""));
const tabs = computed(() => {
  const enabled = [];
  if (portal.value?.loginTypes.voucher) enabled.push({ label: "Voucher", value: "voucher" });
  if (portal.value?.loginTypes.cpf) enabled.push({ label: "CPF", value: "cpf" });
  if (portal.value?.loginTypes.ixc) enabled.push({ label: "Integracao", value: "ixc" });
  return enabled;
});
const selectedPlan = computed(() => portal.value?.hotspot.planos.find((plan) => plan.id === selectedPlanId.value) ?? null);
const selectedPlanNeedsForm = computed(() =>
  Boolean(
    selectedPlan.value?.coletarNome ||
      selectedPlan.value?.coletarTelefone ||
      selectedPlan.value?.coletarEmail ||
      selectedPlan.value?.coletarCpf ||
      selectedPlan.value?.coletarEndereco,
  ),
);
const purchaseStatusLabel = computed(() => {
  if (purchaseStatus.value === "LIBERADO") return "acesso liberado";
  if (purchaseStatus.value === "FALHA_LIBERACAO") return "pagamento aprovado, falha ao liberar";
  if (purchaseStatus.value === "PAGO") return "pagamento aprovado";
  return "aguardando pagamento";
});

function queryValue(key: string): string | null {
  const value = query.value[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function compactPayload(payload: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== ""),
  ) as Record<string, string>;
}

function portalPayload(): Record<string, string> {
  return compactPayload({
    loginType: activeTab.value,
    hotspotSlug: slug.value,
    codigo: activeTab.value === "voucher" ? voucher.value : null,
    voucher: activeTab.value === "voucher" ? voucher.value : null,
    cpf: activeTab.value === "cpf" || activeTab.value === "ixc" ? cpf.value : null,
    mac: queryValue("mac"),
    ip: queryValue("ip"),
    linkLogin: queryValue("link-login"),
    linkLoginOnly: queryValue("link-login-only"),
    linkOrig: queryValue("link-orig"),
    chapId: queryValue("chap-id"),
    chapChallenge: queryValue("chap-challenge"),
    chapIdB64: queryValue("chap-id-b64"),
    chapChallengeB64: queryValue("chap-challenge-b64"),
    "link-login": queryValue("link-login"),
    "link-login-only": queryValue("link-login-only"),
    "link-orig": queryValue("link-orig"),
    "chap-id": queryValue("chap-id"),
    "chap-challenge": queryValue("chap-challenge"),
    "chap-id-b64": queryValue("chap-id-b64"),
    "chap-challenge-b64": queryValue("chap-challenge-b64"),
  });
}

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

function updateDocument(event: Event): void {
  cpf.value = formatCpfCnpj((event.target as HTMLInputElement).value);
}

function openLogin(type: LoginTab): void {
  activeTab.value = type;
  activeScreen.value = type;
  error.value = "";
}

function openPurchase(): void {
  selectedPlanId.value = portal.value?.hotspot.planos[0]?.id ?? "";
  activeScreen.value = "purchase";
  error.value = "";
}

function openInfo(message: string): void {
  error.value = message;
}

function goHome(): void {
  activeScreen.value = "home";
  error.value = "";
  stopPurchasePolling();
}

function updatePurchaseCpf(event: Event): void {
  purchaseForm.cpf = formatCpfCnpj((event.target as HTMLInputElement).value);
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function purchaseRouterPayload(): Record<string, string> {
  return compactPayload({
    linkLogin: queryValue("link-login"),
    linkLoginOnly: queryValue("link-login-only"),
    linkOrig: queryValue("link-orig"),
    chapId: queryValue("chap-id"),
    chapChallenge: queryValue("chap-challenge"),
    chapIdB64: queryValue("chap-id-b64"),
    chapChallengeB64: queryValue("chap-challenge-b64"),
    "link-login": queryValue("link-login"),
    "link-login-only": queryValue("link-login-only"),
    "link-orig": queryValue("link-orig"),
    "chap-id": queryValue("chap-id"),
    "chap-challenge": queryValue("chap-challenge"),
    "chap-id-b64": queryValue("chap-id-b64"),
    "chap-challenge-b64": queryValue("chap-challenge-b64"),
  });
}

function ixcPaymentStateKey(): string {
  return `hotspot_ixc_payment_${slug.value}`;
}

function ixcPaymentReturnUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("ixcPayment", "1");
  return url.toString();
}

function saveIxcPaymentState(pix: IxcPix): void {
  const state: IxcPaymentState = {
    cpf: cpf.value,
    invoiceId: selectedIxcInvoiceId.value,
    pix,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(ixcPaymentStateKey(), JSON.stringify(state));
}

function restoreIxcPaymentState(): boolean {
  const rawState = sessionStorage.getItem(ixcPaymentStateKey());
  if (!rawState) return false;

  try {
    const state = JSON.parse(rawState) as Partial<IxcPaymentState>;
    if (!state.invoiceId || !state.pix) return false;

    cpf.value = state.cpf ?? cpf.value;
    selectedIxcInvoiceId.value = state.invoiceId;
    ixcPix.value = state.pix;
    activeTab.value = "ixc";
    activeScreen.value = "ixcPayment";
    return true;
  } catch {
    sessionStorage.removeItem(ixcPaymentStateKey());
    return false;
  }
}

function clearIxcPaymentState(): void {
  sessionStorage.removeItem(ixcPaymentStateKey());
}

async function createPurchase(): Promise<void> {
  if (!selectedPlanId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const response = await api.post<{
      id: string;
      status: string;
      payment: { qrCode: string | null; qrCodeBase64: string | null };
    }>("/portal/purchases", compactPayload({
      hotspotSlug: slug.value,
      planoId: selectedPlanId.value,
      nome: purchaseForm.nome,
      telefone: purchaseForm.telefone,
      email: purchaseForm.email,
      cpf: purchaseForm.cpf,
      endereco: purchaseForm.endereco,
      mac: queryValue("mac"),
      ip: queryValue("ip"),
    }));

    purchaseId.value = response.id;
    purchaseStatus.value = response.status;
    purchasePayment.value = response.payment;
    activeScreen.value = "payment";
    startPurchasePolling();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel gerar o PIX.";
  } finally {
    loading.value = false;
  }
}

function stopPurchasePolling(): void {
  if (purchasePoll) {
    window.clearInterval(purchasePoll);
    purchasePoll = undefined;
  }
}

function startPurchasePolling(): void {
  stopPurchasePolling();
  purchasePoll = window.setInterval(async () => {
    if (!purchaseId.value) return;
    try {
      const status = await api.get<{ status: string; erroLiberacao: string | null }>(`/portal/purchases/${purchaseId.value}/status`);
      purchaseStatus.value = status.status;
      if (status.status === "LIBERADO" || status.status === "FALHA_LIBERACAO") {
        stopPurchasePolling();
        if (status.erroLiberacao) error.value = status.erroLiberacao;
      }
    } catch {
      stopPurchasePolling();
    }
  }, 3000);
}

async function copyPix(): Promise<void> {
  if (purchasePayment.value?.qrCode) {
    await navigator.clipboard.writeText(purchasePayment.value.qrCode);
  }
}

async function copyIxcPix(): Promise<void> {
  if (ixcPix.value?.pixCopiaECola) {
    await navigator.clipboard.writeText(ixcPix.value.pixCopiaECola);
  }
}

async function loadIxcInvoices(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const response = await api.post<{ status: string; invoices: Array<{ id: string; valor: string }> }>("/portal/ixc/invoices", {
      hotspotSlug: slug.value,
      cpf: cpf.value,
    });
    ixcInvoices.value = response.invoices;
    selectedIxcInvoiceId.value = response.invoices[0]?.id ?? "";
    if (response.invoices.length === 0) {
      error.value = "Nao encontramos mensalidade em aberto para o mes atual.";
      activeScreen.value = "ixcNotFound";
      return;
    }
    activeScreen.value = "ixcInvoices";
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel consultar mensalidades.";
    activeScreen.value = "ixcNotFound";
  } finally {
    loading.value = false;
  }
}

async function generateIxcPix(): Promise<void> {
  if (!selectedIxcInvoiceId.value) return;
  loading.value = true;
  error.value = "";
  const returnUrl = ixcPaymentReturnUrl();
  try {
    const response = await api.post<{
      pix: IxcPix;
      tempAccess: { html: string };
    }>("/portal/ixc/invoices/pix", {
      hotspotSlug: slug.value,
      cpf: cpf.value,
      invoiceId: selectedIxcInvoiceId.value,
      ...purchaseRouterPayload(),
      linkOrig: returnUrl,
      "link-orig": returnUrl,
      mac: queryValue("mac"),
      ip: queryValue("ip"),
    });
    ixcPix.value = response.pix;
    saveIxcPaymentState(response.pix);
    document.open();
    document.write(response.tempAccess.html);
    document.close();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel gerar o PIX da mensalidade.";
  } finally {
    loading.value = false;
  }
}

async function recheckIxcPayment(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch(apiUrl("/portal/ixc/recheck"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/html,application/json" },
      body: JSON.stringify({ ...portalPayload(), invoiceId: selectedIxcInvoiceId.value }),
    });
    const text = await response.text();
    if (!response.ok) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        error.value = parsed.error ?? parsed.message ?? "Pagamento ainda nao confirmado.";
      } catch {
        error.value = text || "Pagamento ainda nao confirmado.";
      }
      return;
    }
    clearIxcPaymentState();
    document.open();
    document.write(text);
    document.close();
  } finally {
    loading.value = false;
  }
}

async function finalizePurchaseLogin(): Promise<void> {
  if (!purchaseId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch(apiUrl(`/portal/purchases/${purchaseId.value}/final-login`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/html,application/json" },
      body: JSON.stringify(purchaseRouterPayload()),
    });
    const text = await response.text();
    if (!response.ok) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string };
        error.value = parsed.error ?? parsed.message ?? "Nao foi possivel entrar.";
      } catch {
        error.value = text || "Nao foi possivel entrar.";
      }
      return;
    }
    document.open();
    document.write(text);
    document.close();
  } finally {
    loading.value = false;
  }
}

async function submit(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch(apiUrl("/portal/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/html,application/json" },
      body: JSON.stringify(portalPayload()),
    });
    const text = await response.text();
    if (!response.ok) {
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string; code?: string };
        if (activeTab.value === "ixc" && parsed.code === "CLIENTE_NAO_ENCONTRADO") {
          error.value = "";
          activeScreen.value = "ixcNotFound";
          return;
        }
        if (activeTab.value === "ixc" && parsed.code === "CLIENTE_COM_DEBITOS") {
          await loadIxcInvoices();
          return;
        }
        error.value = parsed.error ?? parsed.message ?? "Nao foi possivel autenticar.";
      } catch {
        error.value = text || "Nao foi possivel autenticar.";
      }
      return;
    }

    document.open();
    document.write(text);
    document.close();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    voucher.value = queryValue("voucher") ?? queryValue("codigo") ?? "";
    cpf.value = formatCpfCnpj(queryValue("cpf") ?? "");

    portal.value = await api.get<PortalInfo>(`/portal/${encodeURIComponent(slug.value)}`);
    selectedPlanId.value = portal.value.hotspot.planos[0]?.id ?? "";

    if (queryValue("ixcPayment") === "1" && restoreIxcPaymentState()) {
      return;
    }

    if (cpf.value && portal.value.loginTypes.cpf) {
      openLogin("cpf");
      return;
    }

    if (cpf.value && portal.value.loginTypes.ixc) {
      openLogin("ixc");
      return;
    }

    if (voucher.value && portal.value.loginTypes.voucher) {
      openLogin("voucher");
      return;
    }

    activeTab.value = portal.value.loginTypes.voucher ? "voucher" : portal.value.loginTypes.cpf ? "cpf" : "ixc";
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Hotspot nao encontrado.";
  }
});

onBeforeUnmount(stopPurchasePolling);
</script>

<style scoped>
.portal-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, #0737572d, transparent 34%),
    linear-gradient(180deg, #00aeef 0%, #005e9e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  color: #111827;
}

.portal-app {
  width: 100%;
  max-width: 430px;
}

.brand {
  text-align: center;
  color: #fff;
  margin-bottom: 22px;
}

.brand-badge {
  width: 96px;
  height: 96px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-logo {
  width: 100%;
}

.brand h1 {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 0;
}

.brand p {
  margin-top: 6px;
  font-size: 14px;
  opacity: 0.86;
}

.portal-card {
  background: #fff;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
}

.screen {
  animation: fade 0.18s ease;
}

@keyframes fade {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title {
  font-size: 22px;
  font-weight: 900;
  margin-bottom: 6px;
  color: #0f172a;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 20px;
  line-height: 1.4;
}

.menu {
  display: grid;
  gap: 12px;
}

.plans {
  display: grid;
  gap: 10px;
}

.plan-btn {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  padding: 14px;
  text-align: left;
}

.plan-btn.selected {
  border-color: #0077ff;
  box-shadow: 0 0 0 4px rgba(0, 119, 255, 0.1);
}

.plan-btn strong,
.plan-btn span,
.plan-btn b {
  display: block;
}

.plan-btn span {
  margin-top: 3px;
  color: #6b7280;
  font-size: 12px;
}

.plan-btn b {
  margin-top: 7px;
  color: #004aad;
}

.purchase-form {
  margin-top: 12px;
}

.pix-qr {
  width: 210px;
  height: 210px;
  margin: 0 auto 14px;
  display: block;
}

.pix-code {
  width: 100%;
  min-height: 110px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  font-size: 12px;
}

.payment-status {
  margin-top: 14px;
  border-radius: 14px;
  background: #eef7ff;
  padding: 12px;
  color: #0f172a;
  font-size: 13px;
}

.menu-btn {
  width: 100%;
  border: 1px solid #e5e7eb;
  background: #fff;
  padding: 16px;
  border-radius: 18px;
  display: flex;
  gap: 13px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition: 0.2s;
}

.menu-btn:hover {
  border-color: #0077ff;
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(0, 119, 255, 0.12);
}

.icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: #eaf3ff;
  color: #0077ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.menu-btn strong {
  display: block;
  font-size: 15px;
  color: #111827;
}

.menu-btn small {
  display: block;
  margin-top: 3px;
  color: #6b7280;
  font-size: 12px;
}

label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #374151;
  margin-top: 12px;
}

input {
  width: 100%;
  height: 52px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 0 15px;
  font-size: 16px;
  margin-top: 7px;
  outline: none;
  background: #f9fafb;
  color: #111827;
}

input:focus {
  border-color: #0077ff;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(0, 119, 255, 0.12);
}

.primary,
.secondary {
  width: 100%;
  border: 0;
  border-radius: 16px;
  font-weight: 800;
  cursor: pointer;
}

.primary {
  height: 52px;
  margin-top: 18px;
  background: linear-gradient(135deg, #0077ff, #004aad);
  color: #fff;
  font-size: 15px;
  box-shadow: 0 14px 28px rgba(0, 119, 255, 0.25);
}

.primary:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.secondary {
  height: 48px;
  margin-top: 10px;
  background: #eef2f7;
  color: #374151;
}

.alert {
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
  line-height: 1.4;
}

.empty-state {
  margin-top: 14px;
  color: #6b7280;
  font-size: 13px;
}

.footer {
  text-align: center;
  margin-top: 14px;
  color: #94a3b8;
  font-size: 12px;
}

.uppercase {
  text-transform: uppercase;
}

@media (min-width: 768px) {
  .portal-card {
    padding: 28px;
  }

  .brand h1 {
    font-size: 30px;
  }
}
</style>
