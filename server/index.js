import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });

app.use(cors());
app.use(express.json());
app.get("/api/health", async (_req, res) => {
  try { const result = await pool.query("select now() as time"); res.json({ ok: true, database: "connected", time: result.rows[0].time }); }
  catch (error) { res.status(503).json({ ok: false, database: " unavailable", error: error.message }); }
});
app.get("/api/dashboard", async (_req, res) => {
  try {
    const [tasks, leads, projects, revenue] = await Promise.all([
      pool.query("select count(*)::int as total from tasks where status <> 'done'"),
      pool.query("select count(*)::int as total from leads where status <> 'won'"),
      pool.query("select count(*)::int as total from projects where status = 'active'"),
      pool.query("select coalesce(sum(amount), 0)::numeric as total from revenues where paid_at >= date_trunc('month', current_date)")
    ]);
    res.json({ tasks: tasks.rows[0].total, leads: leads.rows[0].total, projects: projects.rows[0].total, revenue: revenue.rows[0].total });
  } catch (error) { res.status(503).json({ ok: false, error: error.message }); }
});
app.listen(port, "0.0.0.0", () => console.log(`FocusApp API listening on ${port}`));
