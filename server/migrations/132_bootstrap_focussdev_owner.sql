-- Bootstrap explícito solicitado para o workspace padrão: só promove esta conta
-- quando ainda não existe nenhum proprietário, evitando alterar outros workspaces.
update users
set role = 'owner'
where organization_id = '00000000-0000-0000-0000-000000000001'
  and lower(email) = 'contato@focussdev.art'
  and not exists (
    select 1 from users owner_check
    where owner_check.organization_id = users.organization_id
      and owner_check.role = 'owner'
  );
