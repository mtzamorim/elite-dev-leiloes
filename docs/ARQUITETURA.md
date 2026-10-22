# Arquitetura e decisões

- Aplicação **same-origin**: API Express publica o build Vite e Socket.IO, com cookies HTTP-only; em desenvolvimento o Vite faz proxy.
- PostgreSQL é fonte de verdade. Moeda sempre em **centavos inteiros BigInt**.
- Transações `SERIALIZABLE` e bloqueio da linha do lote (`FOR UPDATE`) preservam a ordem de lances e os recursos da carteira sob concorrência. Conflitos de serialização são repetidos limitadamente.
- O intervalo de atividade é [startsAt, endsAt); lance recebido após `endsAt` é rejeitado, independentemente do estado salvo.
- Prorrogação: lance válido com tempo restante **até 120 segundos** altera `endsAt` para `endsAt + 120 segundos`.
- Cada lance reserva exatamente o novo valor; a liderança anterior é liberada. No encerramento, o vencedor é debitado uma única vez, o dono é creditado e o comprovante é gerado atomicamente.
- Histórico ordenado com sequência monotônica, hash encadeado com **HMAC-SHA-256** (chave somente no servidor); arquivo de âncoras fora do PostgreSQL para denunciar exclusões inclusive do último lance.
- A verificação compara linhas do PostgreSQL, assinaturas e âncoras de arquivo. Sem âncora, nunca responde como íntegro: retorna `INDETERMINADO`.
- Serviço externo Art Institute of Chicago: busca e leitura pontual, timeout + cache; **snapshot** de arte na criação evita dependência da API nos fluxos críticos.
- Socket.IO publica eventos leves (IDs); o cliente consulta novamente o estado autoritativo, evitando confiar em mensagens de outros navegadores.

## Limites conhecidos

A âncora em arquivo deve ficar em **volume persistente separado do banco** e ser protegida por permissões/backup. Administrador com acesso ao *banco e ao arquivo e ao segredo do servidor* está fora do modelo de ameaça. Não é blockchain nem armazenamento WORM. Se falhar a gravação da âncora depois de um commit do lance, a auditoria mostra `INDETERMINADO`, nunca um falso positivo. É necessário configurar armazenamento de âncoras durável em produção.

Depósitos são simulados, sem gateway, KYC, pagamentos reais ou tributação. Notas fiscais e revenda não fazem parte do desafio.
