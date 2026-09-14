-- Número remoto (WhatsApp) da conversa, para responder pelo canal certo.
alter table conversations add column if not exists remote_number text;
create index if not exists idx_conversations_org_remote on conversations(organization_id, remote_number);
