import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });

app.use(cors());
app.use(express.json());
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use(express.static(frontendRoot));
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") });
const verifyPassword = (password, salt, expected) => crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt).hash, "hex"), Buffer.from(expected, "hex"));
app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body?.name || "").trim(), email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || "");
  if (name.length < 2) return res.status(400).json({ error: "Informe seu nome completo." });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Informe um e-mail válido." });
  if (password.length < 8) return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
  try { const { salt, hash } = hashPassword(password); const result = await pool.query("insert into users (name,email,password_hash) values ($1,$2,$3) returning id,name,email", [name, email, `${salt}:${hash}`]); res.status(201).json({ user: result.rows[0] }); }
  catch (error) { if (error.code === "23505") return res.status(409).json({ error: "Este e-mail já está cadastrado." }); res.status(503).json({ error: "Não foi possível criar a conta." }); }
});
app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || "");
  try { const result = await pool.query("select id,name,email,password_hash from users where email=$1", [email]); const user = result.rows[0]; const [salt, hash] = user?.password_hash?.split(":") || []; if (!user || !salt || !verifyPassword(password, salt, hash)) return res.status(401).json({ error: "E-mail ou senha inválidos." }); res.json({ user: { id: user.id, name: user.name, email: user.email } }); }
  catch { res.status(503).json({ error: "Serviço indisponível." }); }
});
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
app.post("/api/tasks", async (req, res) => {
  const title = String(req.body?.title || "").trim(), priority = ["low", "medium", "high"].includes(req.body?.priority) ? req.body.priority : "medium";
  if (!title) return res.status(400).json({ error: "Informe o título da tarefa." });
  try { const result = await pool.query("insert into tasks (title, priority, due_at) values ($1, $2, $3) returning id,title,status,priority,due_at", [title, priority, req.body?.dueAt || null]); res.status(201).json({ task: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível criar a tarefa.", detail: error.message }); }
});
app.get("/api/tasks", async (_req, res) => {
  try { const result = await pool.query("select id,title,status,priority,due_at,created_at from tasks order by case when status = 'done' then 1 else 0 end, due_at nulls last, created_at desc"); res.json({ tasks: result.rows }); }
  catch (error) { res.status(503).json({ error: "NÃ£o foi possÃ­vel carregar as tarefas.", detail: error.message }); }
});
app.patch("/api/tasks/:id", async (req, res) => {
  const status = req.body?.status === "done" ? "done" : "doing", title = String(req.body?.title || "").trim(), priority = ["low", "medium", "high"].includes(req.body?.priority) ? req.body.priority : null;
  try { const result = await pool.query("update tasks set status=$1 where id=$2 returning id,title,status", [status, req.params.id]); if (!result.rowCount) return res.status(404).json({ error: "Tarefa não encontrada." }); res.json({ task: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível atualizar a tarefa.", detail: error.message }); }
});
app.delete("/api/tasks/:id", async (req, res) => {
  try { const result = await pool.query("delete from tasks where id=$1 returning id", [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: "Tarefa nÃ£o encontrada." }); res.status(204).end(); }
  catch (error) { res.status(503).json({ error: "NÃ£o foi possÃ­vel excluir a tarefa.", detail: error.message }); }
});
app.post("/api/leads", async (req, res) => {
  const name = String(req.body?.name || "").trim(), company = String(req.body?.company || "").trim();
  if (!name) return res.status(400).json({ error: "Informe o nome do lead." });
  try { const result = await pool.query("insert into leads (name,company) values ($1,$2) returning id,name,company,status", [name, company || null]); res.status(201).json({ lead: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível criar o lead.", detail: error.message }); }
});
app.post("/api/revenues", async (req, res) => {
  const description = String(req.body?.description || "").trim(), amount = Number(req.body?.amount);
  if (!description || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Informe descrição e valor válidos." });
  try { const result = await pool.query("insert into revenues (description,amount,paid_at) values ($1,$2,$3) returning id,description,amount,paid_at", [description, amount, req.body?.paid ? new Date() : null]); res.status(201).json({ revenue: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível registrar a receita.", detail: error.message }); }
});
app.post("/api/projects", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Informe o nome do projeto." });
  try { const result = await pool.query("insert into projects (name) values ($1) returning id,name,status,progress", [name]); res.status(201).json({ project: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível criar o projeto.", detail: error.message }); }
});
app.post("/api/events", async (req, res) => {
  const title = String(req.body?.title || "").trim(), startsAt = req.body?.startsAt;
  if (!title || !startsAt || Number.isNaN(Date.parse(startsAt))) return res.status(400).json({ error: "Informe título e horário válidos." });
  try { const result = await pool.query("insert into events (title,starts_at,description) values ($1,$2,$3) returning id,title,starts_at,description", [title, startsAt, String(req.body?.description || "").trim() || null]); res.status(201).json({ event: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível criar o evento.", detail: error.message }); }
});
app.get("/api/events", async (_req, res) => {
  try {
    const result = await pool.query("select id,title,starts_at,description from events order by starts_at asc");
    res.json({ events: result.rows });
  } catch (error) { res.status(503).json({ error: "NÃ£o foi possÃ­vel carregar os eventos.", detail: error.message }); }
});
app.patch("/api/events/:id", async (req, res) => {
  const startsAt = req.body?.startsAt;
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return res.status(400).json({ error: "Informe uma data válida." });
  try { const result = await pool.query("update events set starts_at=$1 where id=$2 returning id,title,starts_at,description", [startsAt, req.params.id]); if (!result.rowCount) return res.status(404).json({ error: "Evento não encontrado." }); res.json({ event: result.rows[0] }); }
  catch (error) { res.status(503).json({ error: "Não foi possível mover o evento.", detail: error.message }); }
});
app.delete("/api/events/:id", async (req, res) => {
  try { const result = await pool.query("delete from events where id=$1 returning id", [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: "Evento nÃ£o encontrado." }); res.status(204).end(); }
  catch (error) { res.status(503).json({ error: "NÃ£o foi possÃ­vel excluir o evento.", detail: error.message }); }
});
async function start() {
  try {
    const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    await pool.query(schema);
    app.listen(port, "0.0.0.0", () => console.log(`FocusApp API listening on ${port}`));
  } catch (error) {
    console.error("FocusApp API could not connect to PostgreSQL:", error.message);
    process.exitCode = 1;
  }
}
start();
