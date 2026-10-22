# Contrato da API

Todos os endpoints têm prefixo `/api`, retornam JSON e utilizam horário ISO 8601. Montantes são enviados em **centavos inteiros** (`amountCents`) e recebidos como **string** (`"12345"`) quando vêm do PostgreSQL (`BigInt`).

## Identidade

| Verbo | Endpoint | Perfil | Função |
|---|---|---|---|
| POST | `/auth/register` | Público | Cadastrar leiloeiro ou licitante. |
| POST | `/auth/login` | Público | Iniciar sessão HTTP-only. |
| POST | `/auth/logout` | Autenticado | Encerrar sessão. |
| GET | `/auth/me` | Público | Dados mínimos da sessão (ou null). |

## Lotes e arte

| Verbo | Endpoint | Perfil | Função |
|---|---|---|---|
| GET | `/auctions?q=&status=LIVE&page=1` | Público | Vitrine paginada, 12 por página. Status ALL, LIVE, SCHEDULED, ENDED. Cancelados omitidos. |
| GET | `/auctions/:id` | Público | Lote com lance atual, líder anônimo, prazo, status e regras de entrada. |
| GET | `/auctions/:id/bids` | Público | Últimos 500 lances para a sala em tempo real (auditoria tem histórico completo). |
| GET | `/artworks?q=monet` | Leiloeiro | Busca pública no Art Institute of Chicago, limitada e com cache. |
| POST | `/auctions` | Leiloeiro | Cria lote usando `artworkId` consultado na API externa; outros campos: `description`, `initialBidCents`, `incrementCents`, `startsAt`, `endsAt`. |
| GET | `/auctions/mine` | Leiloeiro | Painel dos próprios lotes. |
| POST | `/auctions/:id/cancel` | Dono do lote | Cancela e estorna o saldo do líder. Se há lances, exige `reason` de pelo menos 10 caracteres. |
| POST | `/auctions/:id/bids` | Licitante | Lance `{ "amountCents": 15000 }`. Retorna `extended`, `auditAnchored`. |

## Carteira e resultados

| Verbo | Endpoint | Perfil | Função |
|---|---|---|---|
| GET | `/wallet` | Licitante | Saldos e últimas 25 movimentações. |
| POST | `/wallet/deposit` | Licitante | Depósito fictício `{ "amountCents": 50000 }`. |
| GET | `/me/bids` | Licitante | Lotes nos quais ofertou, agrupados. |
| GET | `/me/wins` | Licitante | Lotes vencidos com links para comprovantes. |
| GET | `/audit/auctions/:id` | Público | Verificação das assinaturas e todas as âncoras, histórico integral. |
| GET | `/audit/receipts/:id` | Público | Comprovante assinado e condição da auditoria. |
| GET | `/health` | Público | Saúde do PostgreSQL e horário do servidor. |

## Eventos Socket.IO

- `auctions:changed` → emitido globalmente com `{id}` quando lote, lance, cancelamento ou resultado mudam.
- `auction:join` / `auction:leave` → inscrição/remoção de sala pública de um lote.
- `auction:changed` → sinal no room `auction:<id>`. O frontend recarrega o estado do servidor em vez de confiar em valores enviados pelo socket.

## Erros esperados

Formato: `{ "error": { "code": "LOW_BID", "message": "O lance está abaixo do mínimo permitido." } }`.

`401 AUTH`, `403 ROLE/OWN_AUCTION`, `409 LOW_BID/NO_FUNDS/ALREADY_LEADING/NOT_LIVE`, `409 HISTORY_CORRUPTED`, `422 VALIDATION/INVALID_DATE/CANCEL_REASON`, `503 ARTWORK_API_UNAVAILABLE`. Erros nunca revelam hashes de senha ou informações pessoais de licitantes.

## Segurança

- Token JWT assinado, cookie HTTP-only + SameSite=Lax, Secure em produção.
- Verificação de `Origin`/`Sec-Fetch-Site` para operações com escrita (e proxy seguro no deploy).
- Rate limiting, validações Zod, Helmet/CSP, roles exigidas **no servidor**.
- Dados sensíveis do licitante não são retornados em histórico, auditoria ou comprovante.
