alter table conversations add column if not exists whatsapp_channel text not null default 'support' check (whatsapp_channel in ('support','assistant'));
create index if not exists idx_conversations_whatsapp_channel on conversations(organization_id, channel, whatsapp_channel, remote_number);
