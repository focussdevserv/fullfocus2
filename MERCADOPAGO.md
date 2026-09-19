# Mercado Pago na Focussdev

A integração usa o token somente no servidor e mantém o fluxo manual como fallback quando a conta ainda não foi configurada.

## Variáveis de ambiente

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...
MERCADOPAGO_API_URL=https://api.mercadopago.com
PUBLIC_APP_URL=https://focussdev.space
```

Nunca coloque essas variáveis no frontend, no banco, em uma proposta ou no Git.

## O que fica disponível

- `pix`: cria cobrança Pix no Mercado Pago e retorna QR Code, Pix copia e cola e status externo.
- `card`, `boleto` e `link`: criam um link seguro do Checkout Pro; o cliente escolhe o meio disponível no checkout.
- webhook `POST /api/webhooks/mercadopago`: valida `x-signature`, consulta o pagamento e baixa a conta a receber uma única vez.
- `GET /api/integrations/mercadopago/status`: mostra somente o estado da configuração, sem revelar segredo.

O fluxo de assinaturas continua gerando as contas a receber do sistema. Cada parcela pode gerar sua cobrança Mercado Pago. A cobrança recorrente automática por preapproval/subscription deve ser ativada em uma etapa própria, depois de definir regras de cancelamento, renovação e consentimento do cliente.

## Configuração no painel do Mercado Pago

1. Crie ou selecione a aplicação no painel de desenvolvedores.
2. Use credencial de teste em staging e a credencial de produção somente no ambiente de produção.
3. Configure o webhook para `https://focussdev.space/api/webhooks/mercadopago`.
4. Copie o segredo de assinatura do webhook para `MERCADOPAGO_WEBHOOK_SECRET`.
5. Publique as variáveis no servidor e reinicie o serviço.
6. Confirme em `GET /api/integrations/mercadopago/status` que `configured` e `webhook_configured` estão `true`.

O sistema usa uma chave de idempotência por cobrança para evitar duplicidades quando a API ou a rede repetir uma requisição.

