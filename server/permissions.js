// Regras de autorização por cargo. Proprietários e administradores são
// tratados pelo middleware principal; este helper decide os demais cargos.
export const permissionAllows = (permissions, domain, table, action) => {
  if (!permissions || typeof permissions !== "object") return false;
  for (const value of [permissions[table], permissions[domain], permissions[`${domain}.${action}`], permissions[`${table}.${action}`]]) {
    if (Array.isArray(value)) return value.includes(action) || value.includes("admin") || value.includes("administrate");
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, action)) return Boolean(value[action]);
  }
  return false;
};

export const permissionDomains = Object.freeze({
  absences: "team", activity: "operation", agent: "integrations", approvals: "operation", audit_events: "team",
  automations: "integrations", bank_accounts: "finance", briefings: "operation", campaigns: "crm",
  "catalog-items": "catalog", catalog_items: "catalog", cep: "crm", change_requests: "operation", charges: "finance", clients: "crm",
  cnpj: "crm", commissions: "finance", companies: "crm", contacts: "crm", contracts: "operation",
  conversations: "conversations", crm: "crm", deliveries: "operation", email: "integrations", events: "operation",
  files: "operation", finance: "finance", followups: "crm", forms: "operation", infrastructure_assets: "operation",
  integrations: "integrations", invoices: "finance", knowledge_articles: "operation", leads: "crm",
  notifications: "operation", opportunities: "crm", organization: "team", payables: "finance", payments: "finance",
  profile: "team", project_members: "team", projects: "operation", proposals: "crm", receivables: "finance", revenues: "finance",
  expenses: "finance", subscriptions: "finance", tasks: "operation", team: "team", team_goals: "team", team_messages: "team",
  team_roles: "team", templates: "integrations", tickets: "operation", "time-entry-timer": "team",
  time_entries: "team", trash: "team", vault: "operation", whatsapp: "integrations"
});

const permissionActions = Object.freeze({ GET: "view", HEAD: "view", POST: "create", PATCH: "edit", PUT: "edit", DELETE: "delete" });

export const permissionTarget = (requestPath, method) => {
  const parts = String(requestPath || "").split("/").filter(Boolean);
  const table = parts[0];
  const action = permissionActions[String(method || "").toUpperCase()];
  if (!table || !action) return null;
  // Este endpoint cria contas a receber; a capacidade correta é finance/receivables.create,
  // não operation/contracts.create apenas porque o contrato aparece primeiro na URL.
  if (table === "contracts" && parts[2] === "create-receivables" && action === "create") {
    return { domain: "finance", table: "receivables", action };
  }
  const domain = permissionDomains[table];
  return domain ? { domain, table, action } : null;
};

export const isExplicitPublicApiRoute = (requestPath, method) => String(method || "").toUpperCase() === "POST"
  && (String(requestPath || "") === "/webhooks/mercadopago" || /^\/whatsapp\/webhook\/[^/]+$/.test(String(requestPath || "")));

export const createPermissionMiddleware = ({ pool }) => async (req, res, next) => {
  if (isExplicitPublicApiRoute(req.path, req.method)) return next();
  const target = permissionTarget(req.path, req.method);
  if (!target) return res.status(403).json({ error: "Rota sem política de acesso explícita." });
  if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
  if (["owner", "admin"].includes(req.user.role)) return next();
  if (["team_roles", "audit_events", "trash"].includes(target.table)) return res.status(403).json({ error: "Apenas proprietários e administradores acessam este módulo." });
  try {
    const q = await pool.query("select tr.permissions from users u left join team_roles tr on tr.id=u.team_role_id and tr.organization_id=u.organization_id where u.id=$1 and u.organization_id=$2", [req.user.id, req.user.organization_id]);
    if (!permissionAllows(q.rows[0]?.permissions, target.domain, target.table, target.action)) return res.status(403).json({ error: "Seu cargo não permite esta ação." });
    return next();
  } catch {
    return res.status(503).json({ error: "Não foi possível validar as permissões." });
  }
};
