const toast = (...args) => { if (location.hash === "#automacoes") ui.toast(...args); };
const tr = {
  lead_created: "Novo lead", lead_stage_changed: "Lead mudou de etapa", lead_no_response: "Lead sem resposta",
  meeting_scheduled: "Reunião agendada", proposal_created: "Proposta criada", proposal_sent: "Proposta enviada",
  proposal_viewed: "Proposta visualizada", proposal_approved: "Proposta aprovada", contract_signed: "Contrato assinado",
  project_created: "Projeto criado", task_due_soon: "Tarefa próxima do prazo", task_overdue: "Tarefa atrasada",
  project_overdue: "Projeto atrasado", receivable_due_soon: "Parcela próxima do vencimento", receivable_overdue: "Parcela vencida",
  payment_confirmed: "Pagamento confirmado", payment_overdue: "Pagamento atrasado", ticket_created: "Ticket aberto",
  ticket_no_response: "Ticket sem resposta", customer_message: "Cliente enviou mensagem", scheduled_datetime: "Data ou horário definido",
  webhook_received: "Webhook recebido", freelancer_project_finished: "Freelancer finalizou projeto", sale_won: "Venda concluída", team_member_invited: "Novo membro convidado", member_added_to_project: "Membro adicionado a projeto", project_member_added: "Membro adicionado a projeto", task_assigned: "Tarefa atribuída", member_overloaded: "Membro sobrecarregado", absence_started: "Férias iniciadas", user_deactivated: "Usuário desativado",
};
const act = {
  notify: "Enviar notificação", notify_responsible: "Lembrar responsável", create_task: "Criar tarefa", send_message: "Enviar WhatsApp", send_email: "Enviar e-mail", send_onboarding: "Enviar acesso e orientações",
  create_followup: "Criar follow-up", create_charge: "Criar cobrança", generate_contract: "Gerar contrato", create_project: "Criar projeto",
  update_status: "Alterar status", move_pipeline: "Mover no funil", assign_owner: "Atribuir responsável", add_tag: "Adicionar etiqueta",
  webhook: "Chamar webhook", n8n_flow: "Executar fluxo n8n", wait: "Aguardar período", end: "Encerrar automação",
  calculate_commission: "Calcular comissão", reassign_support: "Reatribuir atendimentos", create_calendar_event: "Criar evento no calendário",
  request_satisfaction: "Solicitar pesquisa de satisfação", generate_document: "Gerar e enviar documento", grant_project_access: "Liberar arquivos e tarefas", revoke_access: "Encerrar acesso",
};
const tk = { proposal: "Proposta", contract: "Contrato", project: "Projeto", task: "Tarefa", checklist: "Checklist", charge: "Cobrança", followup: "Follow-up", support: "Atendimento", ticket: "Resposta de ticket", briefing: "Briefing", delivery_term: "Termo de entrega", report: "Relatório", notification: "Notificação", email: "E-mail", message: "Mensagem", whatsapp: "WhatsApp" };
const providers = { whatsapp: "WhatsApp/Evolution API", email: "Gmail", smtp: "SMTP", google_calendar: "Google Calendar", google_drive: "Google Drive", github: "GitHub", n8n: "n8n", asaas: "Asaas", stripe: "Stripe", firebase: "Firebase", supabase: "Supabase", cnpj: "Consulta CNPJ", esign: "Assinatura eletrônica", webhook: "Webhook", api: "API própria" };
const e = (value) => escapeHtml(value ?? "");
const optionFields = (options) => ({ type: "select", options: Object.entries(options) });

const configs = {
  automation: {
    title: "Nova automação", endpoint: "/api/automations",
    fields: [
      { name: "name", label: "Nome" }, { name: "description", label: "Descrição", required: false },
      { name: "trigger", label: "Gatilho", ...optionFields(tr) }, { name: "action", label: "Ação", ...optionFields(act) },
      { name: "config", label: "Configuração JSON (ex.: {\"rate\":10})", required: false },
      { name: "conditions", label: "Condições JSON", required: false }, { name: "actions", label: "Ações adicionais JSON", required: false },
      { name: "active", label: "Ativa (true/false)", required: false },
    ],
  },
  template: {
    title: "Novo template", endpoint: "/api/templates",
    fields: [{ name: "kind", label: "Tipo", ...optionFields(tk) }, { name: "name", label: "Nome" }, { name: "subject", label: "Assunto", required: false }, { name: "body", label: "Conteúdo" }, { name: "variables", label: "Variáveis", required: false }, { name: "category", label: "Categoria", required: false }],
  },
  integration: {
    title: "Nova integração", endpoint: "/api/integrations",
    fields: [{ name: "provider", label: "Provedor", ...optionFields(providers) }, { name: "account_name", label: "Conta conectada", required: false }, { name: "config", label: "Configuração JSON", required: false }],
  },
};
[
  ["config", "Configuração JSON", '{"rate":10}…'],
  ["conditions", "Condições JSON", '{"status":"active"}…'],
  ["actions", "Ações adicionais JSON", '[{"type":"notify"}]…'],
].forEach(([name, label, placeholder]) => {
  const field = configs.automation.fields.find((item) => item.name === name);
  if (field) Object.assign(field, { label, type: "textarea", rows: 4, placeholder, help: "Use JSON válido. Deixe vazio quando não precisar configurar este campo." });
});
Object.assign(createConfig, configs);
configs.automation.fields.filter((field) => ["config", "conditions", "actions"].includes(field.name)).forEach((field) => { field.json = true; });

// As telas são registradas pelos workspaces dedicados; este arquivo mantém apenas
// os catálogos de opções necessários para os formulários compartilhados.
