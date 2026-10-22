# Plano de testes e critérios de aceite

## Testes automatizados

| Camada | Comando | Cobertura principal |
|---|---|---|
| Domínio Node.js | `npm test` | Primeiro e próximos lances, anti-sniping, saldo, status, permissões, HMAC, auditoria de exclusão. |
| Integração com PostgreSQL | `npm run test:api` | Lances concorrentes, liberação de reservas, liquidação exatamente uma vez, comprovante, cancelamento com estorno e alteração SQL direta. |
| Utilitários React | `npm run test:web` | Conversão centavos/reais e formatação. |
| E2E visual Chromium | `npm run test:e2e` | Vitrine, navegação, sala, lance simulado com API mockada, modal de estorno e Dark Mode persistido. |
| Sintaxe TS/TSX | `npm run lint:syntax` | Parsing de todos os componentes TS/TSX. |
| Tipagem e bundle | `npm run typecheck`, `npm run build` | TypeScript e Vite. |

**Importante:** integração requer `TEST_DATABASE_URL` apontando para um PostgreSQL exclusivamente de testes, previamente migrado. E2E usa interceptação de API para estabilidade visual; não substitui integração real com o banco.

## Aceite manual recomendado

1. Inicie seed com 3 contas (leiloeiro, Ana, Bruno), 4 lotes, lances e resultado encerrado.
2. Na vitrine, confirme que cancelados não aparecem; busque e filtre pelos três status.
3. Em duas janelas privadas com contas diferentes, dê lances simultâneos no mesmo lote. O servidor deve ordenar os lances; o segundo não pode aceitar valor abaixo do mínimo atualizado.
4. Confirme que o primeiro lance cobre o mínimo, que o líder não cobre o próprio lance, que a diferença de saldo total/comprometido/disponível é correta.
5. Teste saldo insuficiente e saldo recuperado instantaneamente quando outro licitante cobre a oferta.
6. Aproxime o lote a 119 segundos do fim e dê um lance válido; o prazo deve crescer em 120 segundos. Fora do intervalo, lance deve ser recusado.
7. Cancele um lote ainda ativo que já tenha líder, descrevendo a justificativa; o saldo reservado deve ser liberado e o lote sumir da vitrine.
8. Ao encerrar, confirme débito único no vencedor, crédito ao leiloeiro e comprovante público sem e-mail/nome pessoal do licitante.
9. Copie o link do comprovante e abra em janela anônima. A mesma ação é válida para `/auditoria/:id`.
10. Indisponibilize a API externa *após* criar o lote; vitrine, lances, auditoria e comprovantes devem continuar operando com snapshots locais.
11. Alterne o Dark Mode; atualize a página e confirme persistência. Teste telas móveis, teclado, mensagens de erro e navegação por tabulação.

## Teste destrutivo de auditoria (somente banco descartável!)

1. Abra a auditoria de um lote com pelo menos um lance e confirme `INTEGRO`.
2. Em uma cópia isolada do banco, altere **diretamente** o valor em centavos de uma linha de `"Bid"` (`UPDATE "Bid" SET "amountCents" = "amountCents" + 1 WHERE id = 'UUID'::uuid;`).
3. Recarregue a auditoria e confirme `ALTERADO`.
4. Restaure a cópia do banco para evitar que o lote adulterado permaneça em uso.
5. Repita excluindo o último lance e ajustando o cabeçalho do lote de forma fraudulenta; a âncora externa remanescente deve denunciar a remoção.

**Não** execute adulterações em produção. A integridade depende da chave secreta do servidor e da preservação do arquivo de âncoras fora do banco. Com âncora faltante, a auditoria sinaliza `INDETERMINADO` e a liquidação fica bloqueada para não premiar um histórico cuja integridade não foi demonstrada.
