/* ==========================================================================
   FocusDev — kit de UI compartilhado (global `ui`)
   Carregado como script clássico antes dos módulos. Só HTML/JS puro; todo
   texto passa por ui.esc. Estilos em ui.css.
   ========================================================================== */

const ui = (() => {
  const esc = (value) => escapeHtml(value == null ? "" : String(value));
  const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const numberFormatter = new Intl.NumberFormat("pt-BR");
  const dateFormatter = new Intl.DateTimeFormat("pt-BR");
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  let activeOverlayCleanup = null;
  const money = (value) => moneyFormatter.format(Number(value || 0));
  const number = (value) => numberFormatter.format(Number(value || 0));
  const date = (value) => { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Data indisponível" : dateFormatter.format(parsed); };
  const dateTime = (value) => { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Data indisponível" : `${dateFormatter.format(parsed)} ${timeFormatter.format(parsed)}`; };
  const plural = (n, one, many) => `${number(n)} ${Number(n) === 1 ? one : many}`;
  function relative(value) {
    if (!value) return "";
    const diff = Date.now() - new Date(value).getTime(), abs = Math.abs(diff), future = diff < 0;
    const unit = abs < 60e3 ? "agora" : abs < 3600e3 ? `${Math.floor(abs / 60e3)} min` : abs < 86400e3 ? `${Math.floor(abs / 3600e3)} h` : abs < 7 * 86400e3 ? `${Math.floor(abs / 86400e3)} d` : null;
    if (unit === "agora") return "agora";
    if (unit === null) return date(value);
    return future ? `em ${unit}` : `há ${unit}`;
  }
  const toLocalInput = (value) => { if (!value) return ""; const d = new Date(value); if (Number.isNaN(d.getTime())) return ""; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const toDateInput = (value) => { if (!value) return ""; const d = new Date(value); if (Number.isNaN(d.getTime())) return ""; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const initials = (text) => String(text || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "?";

  /* Badge com tom semântico. */
  const badge = (label, tone = "gray") => `<span class="ui-badge ui-badge-${tone}">${esc(label)}</span>`;
  const avatar = (text, tone = "blue") => `<span class="ui-avatar ui-avatar-${tone}">${esc(initials(text))}</span>`;

  /* Cabeçalho de página. */
  const header = ({ kicker, title, description = "", actions = "" }) => `<section class="page-intro"><div><p class="card-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2><p data-page-status>${description}</p></div><div class="ui-header-actions">${actions}</div></section>`;
  const button = ({ label, attr = "", kind = "primary", type = "button" }) => `<button class="button button-${kind} compact-action" type="${type}" ${attr}>${esc(label)}</button>`;

  /* Estatísticas clicáveis (data-stat) ou informativas. */
  const stats = (items) => `<section class="ui-stats" style="--ui-stats-count:${items.length}">${items.map((s) => `<${s.attr ? "button type=\"button\"" : "div"} class="data-card ui-stat ${s.tone ? `ui-stat-${s.tone}` : ""} ${s.active ? "is-active" : ""}" ${s.attr || ""}><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong>${s.note ? `<small>${esc(s.note)}</small>` : ""}</${s.attr ? "button" : "div"}>`).join("")}</section>`;

  /* Barra de busca + filtros + botões. */
  function toolbar({ search, filters = [], actions = "", extra = "" }) {
    const searchHtml = search ? `<input class="ui-search" type="search" name="search" autocomplete="off" data-search placeholder="${esc(search.placeholder || "Buscar…")}" value="${esc(search.value || "")}" aria-label="${esc(search.placeholder || "Buscar")}" />` : "";
    const filtersHtml = filters.map((f) => `<select class="ui-select" name="${esc(f.key)}" autocomplete="off" data-filter="${esc(f.key)}" aria-label="${esc(f.label || f.key)}">${f.options.map(([value, label]) => `<option value="${esc(value)}" ${String(f.value ?? "") === String(value) ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`).join("");
    return `<div class="ui-toolbar">${searchHtml}${filtersHtml}${extra}<div class="ui-toolbar-actions">${actions}</div></div>`;
  }

  /* Tabela responsiva. columns: [{ key, label, render(row), align, width, hideOnNarrow }] */
  function table({ columns, rows, rowAttr = () => "", empty = "Nenhum registro.", rowClass = () => "" }) {
    if (!rows.length) return `<div class="ui-empty-inline">${esc(empty)}</div>`;
    return `<div class="table-wrap ui-table-wrap"><table class="ui-table"><thead><tr>${columns.map((c) => `<th scope="col" class="${c.align ? `is-${c.align}` : ""} ${c.hideOnNarrow ? "ui-hide-narrow" : ""}" ${c.width ? `style="width:${c.width}"` : ""}>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr class="${rowClass(row)}" ${rowAttr(row)}>${columns.map((c) => `<td class="${c.align ? `is-${c.align}` : ""} ${c.hideOnNarrow ? "ui-hide-narrow" : ""}">${c.render ? c.render(row) : esc(row[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  /* Estado vazio com CTA. */
  const empty = ({ title, text = "", cta = "", attr = "" }) => `<div class="ui-empty"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ""}${cta ? `<button class="button button-primary compact-action" type="button" ${attr}>${esc(cta)}</button>` : ""}</div>`;

  /* Botões de ação em linha (ícones de texto). actions: [{ label, attr, danger, title }] */
  const rowActions = (actions) => `<div class="ui-row-actions">${actions.map((a) => `<button class="ui-icon ${a.danger ? "is-danger" : ""}" type="button" title="${esc(a.title || a.label)}" aria-label="${esc(a.title || a.label)}" ${a.attr}>${a.label}</button>`).join("")}</div>`;

  /* Confirmação inline: substitui o botão por "Sim / Não". */
  function confirmInline(buttonEl, { text = "Excluir?", onConfirm, onCancel }) {
    const holder = document.createElement("span"); holder.className = "ui-confirm";
    holder.innerHTML = `${esc(text)} <button class="text-action" type="button" data-yes>Sim</button> <button class="text-action" type="button" data-no>Não</button>`;
    const original = buttonEl;
    const wasHidden = original.hidden;
    const hadAriaHidden = original.hasAttribute("aria-hidden");
    const restore = () => {
      if (holder.isConnected) holder.replaceWith(original);
      original.hidden = wasHidden;
      if (hadAriaHidden) original.setAttribute("aria-hidden", "true");
      else original.removeAttribute("aria-hidden");
    };
    original.hidden = true;
    original.setAttribute("aria-hidden", "true");
    original.after(holder);
    holder.querySelector("[data-no]").addEventListener("click", () => { restore(); onCancel?.(); });
    holder.querySelector("[data-yes]").addEventListener("click", async () => { const confirmButton = holder.querySelector("[data-yes]"); holder.querySelectorAll("button").forEach((b) => { b.disabled = true; b.setAttribute("aria-busy", "true"); }); confirmButton?.setAttribute("aria-label", "Confirmando…"); try { await onConfirm(); restore(); } catch (error) { holder.querySelectorAll("button").forEach((b) => { b.disabled = false; b.removeAttribute("aria-busy"); }); confirmButton?.setAttribute("aria-label", "Confirmar exclusão"); let message = holder.querySelector("[data-confirm-error]"); if (!message) { message = document.createElement("small"); message.dataset.confirmError = "true"; message.className = "ui-confirm-error"; message.setAttribute("role", "alert"); holder.append(" ", message); } message.textContent = error.message || "Não foi possível concluir a ação."; } });
  }

  /* Toast discreto. */
  let toastTimer = null;
  function toast(message, tone = "info") {
    let el = document.querySelector(".ui-toast");
    if (!el) { el = document.createElement("div"); el.className = "ui-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); el.setAttribute("aria-atomic", "true"); document.body.append(el); }
    el.textContent = message; el.dataset.tone = tone; el.classList.add("is-visible");
    window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove("is-visible"), 3200);
  }

  /* Formulário em modal. fields: [{ name, label, type, options, required, value, placeholder, rows, min, max, step, help, half }] */
  function form({ title, subtitle = "", fields, submitLabel = "Salvar", values = {}, onSubmit, danger = null }) {
    activeOverlayCleanup?.();
    document.querySelectorAll(".ui-modal-backdrop, .ui-drawer-backdrop").forEach((overlay) => overlay.remove());
    const previouslyFocused = document.activeElement;
    const backdrop = document.createElement("div"); backdrop.className = "ui-modal-backdrop";
    const control = (f) => {
      const value = values[f.name] ?? f.value ?? "";
      const autocomplete = f.autocomplete || (f.type === "email" ? "email" : f.type === "password" ? (/confirm|new/i.test(f.name) ? "new-password" : "current-password") : "off");
      const inputmode = f.inputmode || (f.type === "number" ? "decimal" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text");
      const spellcheck = f.type === "email" || f.type === "password" || /email|username|code|token/i.test(f.name) ? 'spellcheck="false"' : "";
      const common = `name="${esc(f.name)}" autocomplete="${esc(autocomplete)}" inputmode="${esc(inputmode)}" ${spellcheck} ${f.required === false ? "" : "required"} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}`;
      if (f.type === "select") return `<select ${common}>${(f.options || []).map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      if (f.type === "textarea") return `<textarea ${common} rows="${f.rows || 3}">${esc(value)}</textarea>`;
      if (f.type === "checkbox") return `<label class="ui-check"><input type="checkbox" name="${esc(f.name)}" autocomplete="off" ${value ? "checked" : ""} /> <span>${esc(f.text || "")}</span></label>`;
      const v = f.type === "datetime-local" ? toLocalInput(value) : f.type === "date" ? toDateInput(value) : value;
      return `<input type="${esc(f.type || "text")}" ${common} value="${esc(v)}" ${f.min !== undefined ? `min="${esc(f.min)}"` : ""} ${f.max !== undefined ? `max="${esc(f.max)}"` : ""} ${f.step !== undefined ? `step="${esc(f.step)}"` : ""} ${f.type === "number" && f.step === undefined ? 'step="0.01"' : ""} />`;
    };
    backdrop.innerHTML = `<form class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title" novalidate>
      <button class="ui-modal-close" type="button" aria-label="Fechar">×</button>
      <p class="card-kicker">${esc(subtitle || "Formulário")}</p><h2 id="ui-modal-title">${esc(title)}</h2>
      <div class="ui-modal-fields">${fields.map((f) => f.type === "checkbox" ? `<div class="ui-field ${f.half ? "is-half" : ""}">${control(f)}</div>` : `<label class="ui-field ${f.half ? "is-half" : ""}">${esc(f.label)}${f.required === false ? "" : " *"}${control(f)}${f.help ? `<small>${esc(f.help)}</small>` : ""}</label>`).join("")}</div>
      <p class="ui-modal-status" role="status" aria-live="polite"></p>
      <div class="ui-modal-actions">${danger ? `<button class="text-action ui-danger-text" type="button" data-danger>${esc(danger.label)}</button>` : ""}<span></span><button class="button button-secondary compact-action" type="button" data-cancel>Cancelar</button><button class="button button-primary compact-action" type="submit">${esc(submitLabel)}</button></div>
    </form>`;
    document.body.append(backdrop);
    const formEl = backdrop.querySelector("form"), status = backdrop.querySelector(".ui-modal-status");
    let dirty = false, discardPending = false;
    const cleanup = () => { document.removeEventListener("keydown", onKey); if (activeOverlayCleanup === cleanup) activeOverlayCleanup = null; };
    activeOverlayCleanup = cleanup;
    const close = (force = false) => { if (!backdrop.isConnected) { cleanup(); return; } const saving = formEl.querySelector("[type=submit]")?.disabled; if (!force && !saving && dirty && !discardPending) { discardPending = true; status.textContent = "Existem alterações não salvas. Clique novamente em Descartar alterações para sair."; const cancel = formEl.querySelector("[data-cancel]"); if (cancel) cancel.textContent = "Descartar alterações"; return; } backdrop.remove(); cleanup(); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); };
    const onKey = (event) => {
      if (event.key === "Escape") { close(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...backdrop.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])" )].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const closeButton = backdrop.querySelector(".ui-modal-close");
    closeButton.addEventListener("click", close);
    closeButton.focus();
    backdrop.querySelector("[data-cancel]").addEventListener("click", close);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
    const markDirty = () => { dirty = true; discardPending = false; };
    formEl.addEventListener("input", markDirty);
    formEl.addEventListener("change", markDirty);
    backdrop.querySelector("[data-danger]")?.addEventListener("click", async () => { status.textContent = ""; try { await danger.onClick(); if (backdrop.isConnected) close(true); } catch (error) { if (backdrop.isConnected) status.textContent = error.message; } });
    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const missing = fields.find((f) => f.required !== false && f.type !== "checkbox" && !String(formEl.elements[f.name]?.value ?? "").trim());
      if (missing) { status.setAttribute("role", "alert"); status.textContent = `Preencha "${missing.label}".`; formEl.elements[missing.name]?.focus(); return; }
      if (!formEl.checkValidity()) {
        const invalid = [...formEl.elements].find((element) => element.willValidate && !element.validity.valid);
        status.setAttribute("role", "alert");
        status.textContent = invalid?.validationMessage || "Revise os campos destacados antes de salvar.";
        invalid?.focus();
        invalid?.reportValidity?.();
        return;
      }
      const invalidJson = fields.find((f) => f.json && String(formEl.elements[f.name]?.value || "").trim() && (() => { try { JSON.parse(formEl.elements[f.name].value); return false; } catch { return true; } })());
      if (invalidJson) {
        const invalid = formEl.elements[invalidJson.name];
        status.setAttribute("role", "alert");
        status.textContent = `Corrija o JSON em "${invalidJson.label}" antes de salvar.`;
        invalid?.focus();
        return;
      }
      const out = {};
      fields.forEach((f) => { const el = formEl.elements[f.name]; if (!el) return; if (f.type === "checkbox") { out[f.name] = el.checked; return; } let v = el.value; if (f.type === "datetime-local") v = v ? new Date(v).toISOString() : null; else if (f.type === "number") v = v === "" ? null : Number(String(v).replace(",", ".")); else if (f.json) v = v.trim() ? JSON.parse(v) : null; else if (v === "") v = null; out[f.name] = v; });
      const submit = formEl.querySelector("[type=submit]"); submit.disabled = true; submit.setAttribute("aria-busy", "true"); status.setAttribute("role", "status"); status.textContent = "Salvando…";
      try { await onSubmit(out); if (backdrop.isConnected) close(); } catch (error) { status.setAttribute("role", "alert"); status.textContent = error.message || "Não foi possível salvar. Tente novamente."; submit.disabled = false; submit.removeAttribute("aria-busy"); }
    });
    formEl.querySelector("input, select, textarea")?.focus();
    return { close };
  }

  /* Painel lateral (drawer) para detalhes. */
  function drawer({ title, subtitle = "", html, onOpen }) {
    activeOverlayCleanup?.();
    document.querySelectorAll(".ui-modal-backdrop, .ui-drawer-backdrop").forEach((overlay) => overlay.remove());
    const previouslyFocused = document.activeElement;
    const backdrop = document.createElement("div"); backdrop.className = "ui-drawer-backdrop";
    backdrop.innerHTML = `<aside class="ui-drawer" role="dialog" aria-modal="true" aria-labelledby="ui-drawer-title"><header><div><p class="card-kicker">${esc(subtitle)}</p><h2 id="ui-drawer-title">${esc(title)}</h2></div><button class="ui-modal-close" type="button" aria-label="Fechar">×</button></header><div class="ui-drawer-body">${html}</div></aside>`;
    document.body.append(backdrop);
    const cleanup = () => { document.removeEventListener("keydown", onKey); if (activeOverlayCleanup === cleanup) activeOverlayCleanup = null; };
    activeOverlayCleanup = cleanup;
    const close = () => { if (!backdrop.isConnected) { cleanup(); return; } backdrop.remove(); cleanup(); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); };
    const onKey = (event) => {
      if (event.key === "Escape") { close(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...backdrop.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])" )].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const closeButton = backdrop.querySelector(".ui-modal-close");
    closeButton.addEventListener("click", close);
    closeButton.focus();
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
    onOpen?.(backdrop.querySelector(".ui-drawer-body"), close);
    return { close, body: backdrop.querySelector(".ui-drawer-body") };
  }

  function closeOverlays() {
    activeOverlayCleanup?.();
    document.querySelectorAll(".ui-modal-backdrop, .ui-drawer-backdrop").forEach((overlay) => overlay.remove());
    activeOverlayCleanup = null;
  }

  /* Lista chave/valor para detalhes. */
  const facts = (pairs) => `<dl class="ui-facts">${pairs.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v, raw]) => `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join("")}</dl>`;

  /* Busca que preserva foco/cursor após re-render. */
  function keepSearchFocus(root, selector = "[data-search]") {
    const el = root.querySelector(selector); if (!el) return () => {};
    return () => { const again = root.querySelector(selector); if (again && document.activeElement !== again) { const pos = el.selectionStart; again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* tipo search em alguns navegadores */ } } };
  }

  async function copyText(value) {
    const text = String(value ?? "");
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* tenta o fallback abaixo */ }
    }
    const area = document.createElement("textarea"); area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
    document.body.append(area); area.select();
    let copied = false;
    try { copied = typeof document.execCommand === "function" && document.execCommand("copy"); } finally { area.remove(); }
    if (!copied) throw new Error("Não foi possível copiar automaticamente. Selecione o link e copie manualmente.");
    return true;
  }

  /* Exporta linhas como CSV (download no navegador). */
  function downloadCsv(filename, headers, rows) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(cell).join(";"), ...rows.map((r) => r.map(cell).join(";"))].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  }

  return { esc, money, number, date, dateTime, relative, plural, initials, toLocalInput, toDateInput, badge, avatar, header, button, stats, toolbar, table, empty, rowActions, confirmInline, toast, form, drawer, closeOverlays, facts, keepSearchFocus, copyText, downloadCsv };
})();
