# Matriz de requisitos — Elite Dev Verzel

Levantamento a partir das sete páginas do PDF do desafio. **Implementado** descreve presença de código; não equivale a homologação. Sem acesso a Docker/PostgreSQL/navegadores instalados nesta sessão, não se afirma validação E2E/deploy.

| PDF | Item | Evidência principal | Situação |
|---|---|---|---|
| p. 2 | Dois perfis e autenticação | `routes/auth.js`, `lib/auth.js` | Implementado no código |
| p. 2 | Lote de item de API pública | `services/artworks.js`, `services/auctions.js` | Implementado no código |
| p. 2 | Depósito fictício + dar lance | `routes/wallet.js`, `services/auctions.js` | Implementado no código |
| p. 2 | Arremate + comprovante compartilhável | `services/auctions.js`, `pages/ReceiptPage.tsx` | Implementado no código |
| p. 2 | Auditoria sem login | `routes/audit.js`, `pages/AuditPage.tsx` | Implementado no código |
| p. 2 e 7 | Deploy público obrigatório | `Dockerfile`, `compose.prod.yaml`, `Caddyfile`, `docs/ENTREGA.md` | **Não publicado** — usuário deve implantar |
| p. 3 | Vitrine por status sem cancelados | `routes/auctions.js`, `pages/HomePage.tsx` | Implementado no código |
| p. 3 | Painel do leiloeiro, criação, cancelamento, resultados | `pages/SellerPage.tsx` | Implementado no código |
| p. 3 | Sala, contagem, indicador ganhando/superado, real time | `pages/AuctionPage.tsx`, `components/Live.tsx`, `socketSubscriptions.ts`, `server.js` | Implementado no código |
| p. 3 | Carteira: total, comprometido, disponível | `pages/WalletPage.tsx` | Implementado no código |
| p. 3 | Meus lances e arremates | `pages/BidsPage.tsx`, `pages/WinsPage.tsx` | Implementado no código |
| p. 3 | Feedback de recusas | `domain/rules.js`, `lib/http.js`, `Feedback` | Implementado e testes unitários passaram |
| p. 4 | Lance inicial e incremento | `domain/rules.js` | Teste unitário passou |
| p. 4 | Proibir cobertura do próprio lance | `domain/rules.js` | Teste unitário passou |
| p. 4 | Reserva e liberação do saldo | `services/auctions.js` | Implementado; integração ainda não executada |
| p. 4 | Prorrogar +2 min nos últimos 2 min | `domain/rules.js` | Teste unitário passou |
| p. 4 | Liquidação, crédito e ausência de vencedor | `services/auctions.js`, scheduler | Implementado; integração ainda não executada |
| p. 4 | Histórico tamper-evident até alteração SQL | `domain/crypto.js`, `services/audit.js`, `AuditAnchorOutbox`, âncora externa | Testes unitários passaram; integração ainda não executada |
| p. 4 | Privacidade | `routes/auctions.js`, `routes/audit.js` | Implementado no código |
| p. 5 | React / Node / PostgreSQL | `apps/web`, `apps/api`, Prisma | Estrutura implementada |
| p. 5 | Seed: 1 leiloeiro, 2 clientes, lote aberto com lances | `prisma/seed.js` (renovável sem duplicar) | Implementado; execução real pendente |
| p. 5 | README com comportamento inesperado | `README.md`, `docs/*` | Documentado |
| p. 6 | Busca/filtro | `HomePage.tsx` + rota listagem | Implementado |
| p. 6 | Cancelamento com estorno | `cancelAuction`, `SellerPage.tsx` | Implementado |
| p. 6 | Docker Compose | `compose.yaml`, `compose.dev.yaml`, `compose.prod.yaml` | Configurado; build pendente |
| p. 6 | Testes automatizados | `apps/api/tests`, `apps/web/src/lib/money.test.ts`, `e2e/` | 11 unitários Node passaram; integração/E2E pendentes; GitHub Actions configurado |
| p. 6 | Dark Mode | `ThemeContext.tsx`, `styles.css` | Implementado |
| p. 7 | GitHub público | `.git` com commits separados; ZIP versionado | Ainda não publicado |
| p. 7 | Uso e revisão de IA | `docs/USO_DE_IA.md` | Declarado honestamente |

## Itens deliberadamente fora do escopo

Em conformidade com a página 6, não foram criados emissão fiscal, revenda entre usuários, aplicativo nativo nem recuperação de senha.
