/* Rotas específicas do domínio financeiro. */
export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError, validateRelations } = ctx;
  const error = (res, e, fallback) => { const out = classifyDbError(e, fallback); res.status(out.status).json({ error: out.error }); };

  app.get("/api/finance/summary", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const months = Math.min(24, Math.max(1, Number.parseInt(req.query.months, 10) || 6));
    try {
      const q = await pool.query(`with months as (select date_trunc('month', current_date) - (n || ' months')::interval as month from generate_series(0,$2-1) n), rev as (select date_trunc('month',coalesce(paid_at,due_at)) month,sum(amount) amount from revenues where organization_id=$1 and paid_at is not null group by 1), exp as (select date_trunc('month',coalesce(paid_at,due_at)) month,sum(amount) amount from expenses where organization_id=$1 and paid_at is not null group by 1) select to_char(m.month,'YYYY-MM') month,coalesce(r.amount,0)::numeric revenue,coalesce(e.amount,0)::numeric expense,(coalesce(r.amount,0)-coalesce(e.amount,0))::numeric result from months m left join rev r using(month) left join exp e using(month) order by m.month`, [org, months]);
      res.json({ summary: q.rows });
    } catch (e) { error(res, e, "Não foi possível carregar o resumo financeiro."); }
  });

  app.get("/api/subscriptions", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select s.*,c.name client_name from subscriptions s left join clients c on c.id=s.client_id and c.organization_id=s.organization_id where s.organization_id=$1 order by s.created_at desc", [org]); res.json({ subscriptions: q.rows }); } catch (e) { error(res,e,"Não foi possível carregar as assinaturas."); } });
  app.post("/api/subscriptions", async (req, res) => { const org = tenant(req, res); if (!org) return; const plan=asText(req.body?.plan), amount=Number(req.body?.amount), interval=["monthly","yearly"].includes(req.body?.interval)?req.body.interval:"monthly", clientId=req.body?.client_id || null; if (!plan || !Number.isFinite(amount) || amount < 0) return res.status(400).json({error:"Informe plano e valor válidos."}); try { await validateRelations({client_id:clientId},org); const q=await pool.query("insert into subscriptions (organization_id,client_id,plan,amount,interval,next_billing_on) values ($1,$2,$3,$4,$5,$6) returning *",[org,clientId,plan,amount,interval,req.body?.next_billing_on || null]); res.status(201).json({subscription:q.rows[0]}); } catch(e) { if(e.code==="invalid_relation") return res.status(400).json({error:e.message}); error(res,e,"Não foi possível criar a assinatura."); } });
  app.patch("/api/subscriptions/:id", async (req,res) => { const org=tenant(req,res); if(!org)return; const status=["active","paused","cancelled"].includes(req.body?.status)?req.body.status:null; if(!status)return res.status(400).json({error:"Status inválido."}); try { const q=await pool.query("update subscriptions set status=$1,updated_at=now() where id=$2 and organization_id=$3 returning *",[status,req.params.id,org]); if(!q.rowCount)return res.status(404).json({error:"Assinatura não encontrada."}); res.json({subscription:q.rows[0]}); }catch(e){error(res,e,"Não foi possível atualizar a assinatura.");} });
  app.delete("/api/subscriptions/:id", async (req,res) => { const org=tenant(req,res);if(!org)return;try{const q=await pool.query("delete from subscriptions where id=$1 and organization_id=$2 returning id",[req.params.id,org]);if(!q.rowCount)return res.status(404).json({error:"Assinatura não encontrada."});res.status(204).end();}catch(e){error(res,e,"Não foi possível excluir a assinatura.");} });
}
