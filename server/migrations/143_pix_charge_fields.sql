alter table charges add column if not exists pix_payload text;
alter table charges add column if not exists pix_qr_data_url text;
alter table charges add column if not exists document_kind text;
