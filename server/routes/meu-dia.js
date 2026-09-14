/* Rotas HTTP do domínio "meu-dia" — Agenda, Tarefas (complementos além do CRUD genérico)
   Ownership: server/routes/meu-dia.js (+ server/migrations/NNN_meu_dia_*.sql)

   register(app, ctx) recebe:
     ctx.pool            pool pg
     ctx.tenant(req,res) -> organization_id ou null (já respondeu 400)
     ctx.requireAuth     middleware (as rotas /api/* já exigem sessão)
     ctx.asText          normaliza string
     ctx.classifyDbError(err, fallback) -> { status, error }
     ctx.singular(table) -> chave do DTO
   Regras: toda query filtra por organization_id; erros de entrada -> 400; nunca
   retornar dados de outra organização; mensagens em pt-BR. */

export function register(app, ctx) {
  // Nenhuma rota específica ainda. O CRUD genérico de server/index.js continua valendo.
  void app; void ctx;
}
