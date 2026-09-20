const relationTables = {
  client_id: "clients",
  project_id: "projects",
  contract_id: "contracts",
  proposal_id: "proposals",
  opportunity_id: "opportunities",
  receivable_id: "receivables",
};

const invalid = (field, clientId, expected) => {
  const error = new Error(`${field} pertence a outro cliente.`);
  error.code = "invalid_relation";
  error.field = field;
  error.client_id = clientId;
  error.expected_client_id = expected;
  return error;
};

export async function validateCoherentRelations(pool, values, organizationId, options = {}) {
  const db = options.db || pool;
  const entries = Object.entries(values || {}).filter(([field, value]) => relationTables[field] && value !== undefined && value !== null && value !== "");
  if (entries.length < 2) return;
  const rows = await Promise.all(entries.map(async ([field, value]) => {
    const clientExpression = field === "client_id" ? "id as client_id" : "client_id";
    const result = await db.query(`select id,${clientExpression} from ${relationTables[field]} where id=$1 and organization_id=$2`, [value, organizationId]);
    if (!result.rows[0]) throw invalid(field, value, null);
    return [field, result.rows[0]];
  }));
  const clients = rows.map(([field, row]) => [field, field === "client_id" ? row?.id : row?.client_id]).filter(([, id]) => id !== undefined && id !== null);
  const expected = clients[0]?.[1];
  for (const [field, clientId] of clients) if (String(clientId) !== String(expected)) throw invalid(field, clientId, expected);
}
