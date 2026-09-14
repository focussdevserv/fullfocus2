/* Consolida tudo que depende de uma decisão do cliente ou da operação. */
export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  app.get("/api/approvals/overview", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const [manual, proposals, contracts, deliveries, changes] = await Promise.all([
        pool.query("select id,target_type,target_id,title,status,client_id,project_id,requested_at,decided_at from approvals where organization_id=$1 and status='pending' order by requested_at asc", [org]),
        pool.query("select p.id,p.title,p.status,p.client_id,p.project_id,p.valid_until,c.name client_name from proposals p left join clients c on c.id=p.client_id and c.organization_id=p.organization_id where p.organization_id=$1 and p.status in ('sent','viewed','negotiation') order by p.created_at asc", [org]),
        pool.query("select c.id,c.name,c.status,c.client_id,c.project_id,cl.name client_name from contracts c left join clients cl on cl.id=c.client_id and cl.organization_id=c.organization_id where c.organization_id=$1 and c.status in ('sent','viewed','awaiting_signature') order by c.created_at asc", [org]),
        pool.query("select d.id,d.version,d.status,d.project_id,p.name project_name,c.name client_name from deliveries d join projects p on p.id=d.project_id and p.organization_id=d.organization_id left join clients c on c.id=p.client_id and c.organization_id=p.organization_id where d.organization_id=$1 and d.status in ('ready','published') and coalesce(d.client_approved,false)=false order by d.created_at asc", [org]),
        pool.query("select r.id,r.title,r.status,r.project_id,r.client_id,p.name project_name,c.name client_name from change_requests r left join projects p on p.id=r.project_id and p.organization_id=r.organization_id left join clients c on c.id=r.client_id and c.organization_id=r.organization_id where r.organization_id=$1 and r.status='pending' order by r.created_at asc", [org]),
      ]);
      res.json({ manual: manual.rows, proposals: proposals.rows, contracts: contracts.rows, deliveries: deliveries.rows, changes: changes.rows });
    } catch (error) {
      const out = classifyDbError(error, "Não foi possível carregar as aprovações pendentes.");
      res.status(out.status).json({ error: out.error });
    }
  });
}
