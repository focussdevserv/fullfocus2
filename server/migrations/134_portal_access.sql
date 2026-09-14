alter table client_portal_links
  add column if not exists login_email text,
  add column if not exists password_salt text,
  add column if not exists password_hash text,
  add column if not exists portal_auth_enabled boolean not null default false,
  add column if not exists last_login_at timestamptz;

create unique index if not exists idx_client_portal_links_login_email
  on client_portal_links(organization_id, lower(login_email))
  where portal_auth_enabled = true and login_email is not null;
