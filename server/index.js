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
