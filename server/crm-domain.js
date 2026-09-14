const STAGES = Object.freeze(["lead", "opportunity", "won", "lost", "client"]);
const PROBABILITIES = Object.freeze({ lead: 0.1, opportunity: 0.4, won: 1, lost: 0, client: 1 });
const CONVERSION_TYPES = Object.freeze(["client", "contract", "project", "billing", "task"]);

const text = (value) => typeof value === "string" ? value.trim() : "";
const digits = (value) => String(value ?? "").replace(/\D/g, "");
const emailKey = (value) => text(value).toLowerCase();
const stableId = (value) => String(value ?? "").trim();

export function normalizeIdentity(data = {}) {
  return {
    email: emailKey(data.email),
    phone: digits(data.phone),
    document: digits(data.document ?? data.taxId ?? data.cpfCnpj)
  };
}

export function validateCrmData(data = {}, { kind = "lead" } = {}) {
  const errors = [];
  const name = text(data.name);
  const identity = normalizeIdentity(data);
  if (!name) errors.push({ field: "name", code: "required", message: "Nome é obrigatório." });
  if (identity.email && !/^\S+@\S+\.\S+$/.test(identity.email)) errors.push({ field: "email", code: "invalid", message: "E-mail inválido." });
  if (!identity.email && !identity.phone && !identity.document) errors.push({ field: "identity", code: "required", message: "Informe e-mail, telefone ou documento." });
  if (kind === "opportunity" && (!Number.isFinite(Number(data.amount)) || Number(data.amount) < 0)) errors.push({ field: "amount", code: "invalid", message: "Valor da oportunidade inválido." });
  return { valid: errors.length === 0, errors, value: { ...data, name, ...identity } };
}

export const validateLeadData = (data) => validateCrmData(data, { kind: "lead" });
export const validateOpportunityData = (data) => validateCrmData(data, { kind: "opportunity" });

export function deduplicateByIdentity(records = []) {
  const unique = [], duplicates = [], seen = new Map();
  for (const record of records) {
    const identity = normalizeIdentity(record);
    const keys = [identity.email && `email:${identity.email}`, identity.phone && `phone:${identity.phone}`, identity.document && `document:${identity.document}`].filter(Boolean);
    const existing = keys.map((key) => seen.get(key)).find(Boolean);
    if (existing) { duplicates.push({ duplicate: record, canonical: existing }); continue; }
    unique.push(record);
    for (const key of keys) seen.set(key, record);
  }
  return { unique, duplicates };
}

export const deduplicateContacts = deduplicateByIdentity;

function validDate(value) { if (value == null) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function event(type, aggregate, payload, { at, actor } = {}) {
  return { type, aggregate: { type: aggregate.type || "crm", id: stableId(aggregate.id) }, payload, occurredAt: validDate(at), actor: actor ?? null };
}

export function transitionLead({ lead, to, reason = null, at, actor = null } = {}) {
  const from = text(lead?.stage || lead?.status || "lead");
  if (!lead?.id) return { ok: false, errors: [{ field: "lead.id", code: "required" }], events: [] };
  if (!STAGES.includes(to)) return { ok: false, errors: [{ field: "to", code: "invalid_stage" }], events: [] };
  const allowed = { lead: ["opportunity", "lost"], opportunity: ["won", "lost"], won: ["client"], lost: ["lead", "opportunity"], client: [] };
  if (from === to) return { ok: true, changed: false, entity: { ...lead, stage: to }, events: [] };
  if (!(allowed[from] || []).includes(to)) return { ok: false, errors: [{ field: "stage", code: "invalid_transition", message: `${from} → ${to} não é permitido.` }], events: [] };
  const next = { ...lead, stage: to, status: to, updatedAt: validDate(at) };
  return { ok: true, changed: true, entity: next, events: [event("crm.stage_changed", { type: "lead", id: lead.id }, { from, to, reason }, { at, actor })] };
}

export const transitionOpportunity = transitionLead;

export function calculateProbability(opportunity = {}, overrides = {}) {
  const stage = text(opportunity.stage || opportunity.status || "lead");
  const value = overrides[stage] ?? opportunity.probability ?? PROBABILITIES[stage] ?? 0;
  const probability = Math.max(0, Math.min(1, Number(value)));
  return Number.isFinite(probability) ? probability : 0;
}

export function calculateForecast(opportunities = [], overrides = {}) {
  return opportunities.reduce((result, opportunity) => {
    const amount = Number(opportunity.amount ?? opportunity.value ?? 0);
    const probability = calculateProbability(opportunity, overrides);
    const weightedAmount = Number.isFinite(amount) ? amount * probability : 0;
    result.totalAmount += Number.isFinite(amount) ? amount : 0;
    result.weightedAmount += weightedAmount;
    result.byStage[opportunity.stage || opportunity.status || "lead"] = (result.byStage[opportunity.stage || opportunity.status || "lead"] || 0) + weightedAmount;
    return result;
  }, { totalAmount: 0, weightedAmount: 0, byStage: {} });
}

export function buildConversionPlan({ opportunity, selections = {}, ids = {}, at, actor = null } = {}) {
  if (!opportunity?.id) return { ok: false, errors: [{ field: "opportunity.id", code: "required" }], steps: [], events: [] };
  const selectionErrors = validateConversionSelection(selections).errors;
  if (selectionErrors.length) return { ok: false, errors: selectionErrors, steps: [], events: [] };
  const key = `conversion:${opportunity.id}`;
  const steps = CONVERSION_TYPES.filter((type) => selections[type] === true).map((type) => ({ type, id: ids[type] ?? null, selected: true }));
  return { ok: true, idempotencyKey: key, opportunityId: opportunity.id, steps, events: [event("crm.conversion_planned", { type: "opportunity", id: opportunity.id }, { idempotencyKey: key, steps }, { at, actor })] };
}

export function validateConversionSelection(selections = {}) {
  const errors = Object.keys(selections).filter((key) => !CONVERSION_TYPES.includes(key)).map((key) => ({ field: `selections.${key}`, code: "unknown_type" }));
  return { valid: errors.length === 0, errors };
}

export function convertWonOpportunity({ opportunity, selections = {}, ids = {}, existingConversions = [], at, actor = null } = {}) {
  const plan = buildConversionPlan({ opportunity, selections, ids, at, actor });
  if (!plan.ok) return plan;
  if (existingConversions.some((item) => item.idempotencyKey === plan.idempotencyKey)) return { ...plan, alreadyConverted: true, events: [] };
  const events = plan.steps.map((step) => event(`crm.${step.type}_created`, { type: "opportunity", id: opportunity.id }, { ...step, idempotencyKey: plan.idempotencyKey }, { at, actor }));
  return { ...plan, alreadyConverted: false, events: [...plan.events, ...events] };
}

export const planConversion = buildConversionPlan;
export const convertOpportunity = convertWonOpportunity;
export const transitionStage = transitionLead;

export { STAGES, PROBABILITIES, CONVERSION_TYPES };
