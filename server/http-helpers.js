/* Helpers puros (sem banco) compartilhados pelas rotas HTTP. */

/* Nome singular usado como chave do DTO de resposta ({ company: {...} }). */
export const SINGULAR = {
  contacts: "contact",
  companies: "company",
  leads: "lead",
  opportunities: "opportunity",
  clients: "client",
  contracts: "contract",
  projects: "project",
  tasks: "task",
  revenues: "revenue",
  expenses: "expense",
  receivables: "receivable",
  charges: "charge",
  payments: "payment",
  events: "event",
  approvals: "approval",
  briefings: "briefing",
  change_requests: "change_request",
  deliveries: "delivery",
  infrastructure_assets: "infrastructure_asset",
  knowledge_articles: "knowledge_article",
  forms: "form",
  payables: "payable",
  bank_accounts: "bank_account",
  invoices: "invoice",
  audit_events: "audit_event",
  trash: "trash_item",
  team_goals: "team_goal",
  absences: "absence",
  team_roles: "team_role",
  time_entries: "time_entry",
  team_messages: "team_message",
  project_members: "project_member",
  commissions: "commission",
};

export function singular(table) {
  const name = SINGULAR[table];
  if (!name) throw new Error(`Tabela sem nome singular mapeado: ${table}`);
  return name;
}

/* Tabelas que possuem a coluna updated_at (lista explícita, alinhada ao schema.sql). */
export const TABLES_WITH_UPDATED_AT = new Set(["clients", "companies", "contacts", "contracts", "leads", "opportunities", "projects", "tasks", "approvals", "briefings", "change_requests", "deliveries", "infrastructure_assets", "knowledge_articles", "forms", "payables", "bank_accounts", "invoices", "team_goals", "absences", "team_roles", "time_entries", "commissions"]);

/* Colunas de valor que aceitam zero no schema (check >= 0). As demais exigem > 0. */
const ZERO_ALLOWED = new Set(["opportunities.amount", "contracts.value", "projects.value"]);

export function isValidAmount(table, column, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  return ZERO_ALLOWED.has(`${table}.${column}`) ? number >= 0 : number > 0;
}

export function normalizeIdentity(field, value) {
  if (value === undefined || value === null) return value;
  const text = String(value).trim();
  if (field === "email") return text.toLowerCase();
  if (field === "document" || field === "phone") return text.replace(/\D/g, "");
  return value;
}

/* Converte erros do PostgreSQL em { status, error } legíveis.
   Erros de entrada do cliente viram 400; o resto continua 503 com a mensagem padrão da rota. */
const DB_ERROR_MESSAGES = {
  "23514": "Um dos valores informados está fora do permitido.",
  "23502": "Um campo obrigatório não foi informado.",
  "22P02": "Formato de dado inválido.",
  "22003": "Valor numérico fora do intervalo permitido.",
  "22007": "Data ou horário em formato inválido.",
  "22008": "Data ou horário em formato inválido.",
  "23503": "O registro relacionado não existe.",
  "23505": "Já existe um registro com esses dados.",
};

export function classifyDbError(error, fallback = "Não foi possível concluir a operação.") {
  const code = error?.code;
  if (code && DB_ERROR_MESSAGES[code]) return { status: code === "23505" ? 409 : 400, error: DB_ERROR_MESSAGES[code] };
  return { status: 503, error: fallback };
}
