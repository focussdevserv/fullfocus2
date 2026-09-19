# Operação e publicação da Focussdev

## Verificações locais

```powershell
npm run check
npm test
npm run build
```

## Smoke test de produção

O teste verifica a aplicação pública, o health check da API, o carregador de módulos, o CSS principal e o módulo inicial:

```powershell
npm run smoke:production
```

Para validar outro endereço:

```powershell
$env:SMOKE_URL = "https://exemplo.com"
npm run smoke:production
```

O resultado só é considerado aprovado quando a aplicação responde com HTTP 200 e `/api/health` retorna `ok: true` e banco conectado.

## Deploy

1. Executar `npm run check`, `npm test` e `npm run build`.
2. Revisar `git diff --check`.
3. Commitar somente arquivos do produto; não incluir logs locais nem segredos.
4. Publicar na branch de produção.
5. Executar `npm run smoke:production` após a publicação.

## Backup e recuperação

O campo de backup usado no fluxo de entrega registra uma confirmação operacional do projeto; ele não substitui um backup real do banco.

Backups do PostgreSQL devem ser configurados no provedor do banco ou em uma rotina segura de infraestrutura. As credenciais não devem ser colocadas no repositório, no frontend ou em mensagens.

Em uma recuperação: restaurar o banco no provedor, executar as migrações pendentes, validar `/api/health` e executar o smoke test.

## Diagnóstico de tela travada

1. Atualizar a página para obter os assets da versão publicada.
2. Verificar o console do navegador e a aba Network.
3. Confirmar se o módulo da rota responde HTTP 200.
4. Usar “Tentar novamente”; o carregador remove falhas transitórias do cache e faz uma nova importação.
5. Se persistir, registrar a rota, horário, mensagem do console e resposta de `/api/health`.
