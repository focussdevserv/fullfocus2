/* Ações financeiras do Mercado Pago. Mantém a tela existente e adiciona apenas
   controles confirmados pelo backend, evitando duplicar o fluxo de cobrança. */
const mpFinanceText = (value) => escapeHtml(value ?? "");
const mpFinanceToast = (message, tone = "success") => ui.toast(message, tone);
const mpStatusLabel = { authorized: "Autorizada", pending: "Aguardando autorização", paused: "Pausada", cancelled: "Cancelada" };

async function mpRun(button, label, action) {
  if (!button || button.disabled) return;
  const original = button.textContent;
  button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = label;
  try { await action(); if (location.hash.startsWith("#assinaturas") || location.hash === "#cobrancas") renderHashRoute(); }
  catch (error) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = original; mpFinanceToast(error.message || "Não foi possível concluir a operação.", "error"); }
}

async function mpRenderIntegrationStatus() {
  if (!document.querySelector("[data-mp-finance-status]") && ["#assinaturas", "#cobrancas"].includes(location.hash)) {
    try {
      const status = await api("/api/integrations/mercadopago/status");
      const intro = dashboardGrid.querySelector(".page-intro");
      if (intro && !dashboardGrid.querySelector("[data-mp-finance-status]")) {
        intro.insertAdjacentHTML("afterend", `<section class="data-card" data-mp-finance-status><strong>Mercado Pago</strong><span> ${status.configured ? "conectado" : "não configurado"}${status.webhook_configured ? " · webhook ativo" : " · webhook pendente"}</span></section>`);
      }
    } catch { /* a tela principal continua utilizável mesmo sem o status auxiliar */ }
  }
}

async function mpDecorateSubscriptions() {
  if (location.hash !== "#assinaturas") return;
  let subscriptions;
  try { subscriptions = (await api("/api/subscriptions?limit=250")).subscriptions || []; } catch { return; }
  const byId = new Map(subscriptions.map((item) => [String(item.id), item]));
  dashboardGrid.querySelectorAll(".finance-list tbody tr").forEach((row) => {
    const id = row.querySelector("[data-sub-status], [data-sub-delete]")?.dataset.subStatus || row.querySelector("[data-sub-delete]")?.dataset.subDelete;
    const item = byId.get(String(id));
    const actions = row.lastElementChild;
    if (!item || !actions || actions.dataset.mpDecorated === "1") return;
    actions.dataset.mpDecorated = "1";
    const cell = document.createElement("td");
    cell.innerHTML = `<span class="finance-status ${item.provider_id ? "positive" : "neutral"}">${mpFinanceText(item.provider_id ? (mpStatusLabel[item.provider_status] || "Conectada") : "Não vinculada")}</span>`;
    row.insertBefore(cell, actions);
    if (!item.provider_id) {
      const button = document.createElement("button"); button.className = "compact-action"; button.type = "button"; button.textContent = "Gerar autorização";
      button.addEventListener("click", () => mpRun(button, "Gerando…", async () => { const result = await api(`/api/subscriptions/${item.id}/create-provider`, { method: "POST", body: {} }); if (result.authorization_url) window.open(result.authorization_url, "_blank", "noopener,noreferrer"); mpFinanceToast(result.authorization_url ? "Link de autorização aberto para o cliente." : "Autorização criada sem link retornado."); }));
      actions.prepend(button);
    } else if (item.provider_url) {
      const link = document.createElement("a"); link.className = "compact-action"; link.href = item.provider_url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Abrir autorização"; actions.prepend(link);
    }
    if (item.status !== "cancelled") {
      const cancel = document.createElement("button"); cancel.className = "compact-action"; cancel.type = "button"; cancel.textContent = "Cancelar MP";
      cancel.addEventListener("click", () => ui.confirmInline(cancel, { text: "Cancelar esta recorrência também no Mercado Pago?", onConfirm: () => mpRun(cancel, "Cancelando…", async () => { await api(`/api/subscriptions/${item.id}`, { method: "PATCH", body: { status: "cancelled" } }); mpFinanceToast("Recorrência cancelada."); }) }));
      actions.append(cancel);
    }
  });
}

async function mpDecorateCharges() {
  if (location.hash !== "#cobrancas") return;
  let charges;
  try { charges = (await api("/api/charges?limit=250")).charges || []; } catch { return; }
  dashboardGrid.querySelectorAll(".finance-list tbody tr").forEach((row, index) => {
    const item = charges[index], actions = row.lastElementChild;
    if (!item || !actions || actions.dataset.mpDecorated === "1") return;
    actions.dataset.mpDecorated = "1";
    if (["pending", "generated", "sent", "viewed", "overdue"].includes(item.status)) {
      const cancel = document.createElement("button"); cancel.className = "compact-action"; cancel.type = "button"; cancel.textContent = "Cancelar no MP";
      cancel.addEventListener("click", () => ui.confirmInline(cancel, { text: "Cancelar esta cobrança no Mercado Pago?", onConfirm: () => mpRun(cancel, "Cancelando…", async () => { await api(`/api/charges/${item.id}/cancel`, { method: "POST" }); mpFinanceToast("Cobrança cancelada."); }) })); actions.append(cancel);
    }
    if (item.status === "paid") {
      const refund = document.createElement("button"); refund.className = "compact-action"; refund.type = "button"; refund.textContent = "Reembolsar";
      refund.addEventListener("click", () => ui.confirmInline(refund, { text: "Solicitar reembolso integral desta cobrança?", onConfirm: () => mpRun(refund, "Reembolsando…", async () => { await api(`/api/charges/${item.id}/refund`, { method: "POST", body: {} }); mpFinanceToast("Reembolso solicitado."); }) })); actions.append(refund);
    }
  });
}

let mpFinanceTimer;
const mpFinanceObserver = new MutationObserver(() => {
  clearTimeout(mpFinanceTimer);
  mpFinanceTimer = setTimeout(() => { mpRenderIntegrationStatus(); mpDecorateSubscriptions(); mpDecorateCharges(); }, 80);
});
mpFinanceObserver.observe(dashboardGrid, { childList: true, subtree: true });
window.addEventListener("hashchange", () => { if (["#assinaturas", "#cobrancas"].includes(location.hash)) setTimeout(() => { mpRenderIntegrationStatus(); mpDecorateSubscriptions(); mpDecorateCharges(); }, 120); });
