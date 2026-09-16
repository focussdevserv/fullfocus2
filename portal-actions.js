(() => {
  const script = document.currentScript;
  const token = script?.dataset.token;
  if (!token) return;
  const apiPath = `/api/portal/${encodeURIComponent(token)}`;
  const labels = { proposal: "Aprovar proposta", delivery: "Aprovar entrega" };
  const card = document.createElement("section");
  card.className = "card portal-actions";
  card.hidden = true;
  card.innerHTML = "<h2>Aprovações pendentes</h2><div data-portal-approval-list></div>";
  document.querySelector("main")?.append(card);
  const style = document.createElement("style");
  style.textContent = ".portal-actions{margin-top:18px}.portal-approval-item{border-top:1px solid #334766;padding:18px 0}.portal-approval-item:first-child{border-top:0}.portal-approval-item p{margin:6px 0 12px;color:#94a3b8}.portal-approval-item label{display:block;margin:12px 0;color:#cbd5e1;font-weight:600}.portal-approval-item label span{display:block;margin-bottom:6px}.portal-approval-item input,.portal-approval-item textarea{box-sizing:border-box;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #526887;border-radius:10px;background:#0d1424;color:#f8fafc;font:inherit}.portal-approval-item textarea{resize:vertical}.portal-approval-item output{display:block;margin-top:10px;color:#86efac}@media(max-width:600px){.portal-approval-item button{width:100%}}";
  document.head.append(style);
  const list = card.querySelector("[data-portal-approval-list]");
  const text = (element, value) => { element.textContent = String(value ?? ""); return element; };
  const createApproval = (kind, item) => {
    const article = document.createElement("article");
    article.className = "portal-approval-item";
    text(article.appendChild(document.createElement("strong")), kind === "proposal" ? item.title : `Versão ${item.version}`);
    text(article.appendChild(document.createElement("p")), kind === "proposal" ? "Proposta comercial" : (item.project_name || "Entrega do projeto"));
    const form = document.createElement("form");
    const name = document.createElement("input"); name.name = "name"; name.required = true; name.minLength = 2; name.autocomplete = "name";
    const email = document.createElement("input"); email.name = "email"; email.type = "email"; email.required = true; email.autocomplete = "email";
    const comment = document.createElement("textarea"); comment.name = "comment"; comment.rows = 2;
    [["Nome completo", name], ["E-mail", email], ["Comentário", comment]].forEach(([label, input]) => { const wrapper = document.createElement("label"); text(wrapper.appendChild(document.createElement("span")), label); wrapper.append(input); form.append(wrapper); });
    const submit = document.createElement("button"); submit.type = "submit"; submit.className = "button button-primary"; submit.textContent = labels[kind];
    const status = document.createElement("output"); status.setAttribute("role", "status"); form.append(submit, status); article.append(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); submit.disabled = true; submit.setAttribute("aria-busy", "true"); status.textContent = "Registrando…";
      try {
        const response = await fetch(`${apiPath}/${kind === "proposal" ? "proposals" : "deliveries"}/${item.id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível registrar a aprovação.");
        text(status, "Aprovação registrada."); article.replaceChildren(status); if (!list.children.length) card.hidden = true;
      } catch (error) { status.textContent = error.message; submit.disabled = false; submit.removeAttribute("aria-busy"); }
    });
    return article;
  };
  fetch(apiPath, { headers: { accept: "application/json" } }).then(async (response) => {
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Portal indisponível.");
    const proposals = (data.proposals || []).filter((item) => ["sent", "viewed", "negotiation"].includes(item.status));
    const deliveries = (data.deliveries || []).filter((item) => !item.client_approved && ["ready", "published"].includes(item.status));
    [...proposals.map((item) => createApproval("proposal", item)), ...deliveries.map((item) => createApproval("delivery", item))].forEach((item) => list.append(item));
    card.hidden = !list.children.length;
  }).catch(() => { card.hidden = true; });
})();
