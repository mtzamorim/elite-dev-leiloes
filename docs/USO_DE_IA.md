# Uso de inteligência artificial

O desafio da Verzel permite a utilização de IA e solicita declarar **onde, como e com quais revisões** foi utilizada. Esta seção deve ser mantida e ajustada para refletir fielmente o processo real antes da submissão.

**Uso nesta elaboração:** assistência de IA na interpretação dos requisitos, no planejamento da arquitetura, na geração de código da API e da interface, no desenho das regras de carteira/auditoria, na criação de testes e na redação inicial da documentação. A assistência abrange partes substanciais do código-fonte.

**Verificações realizadas nesta revisão:** 11 testes unitários Node aprovados (incluindo scheduler, falha e recuperação de outbox), sintaxe JavaScript conferida e commits preservados. Foram criados testes com PostgreSQL, reconexão da sala, E2E real e GitHub Actions, mas **não foram executados com serviços e dependências instalados**. O bundle frontend e o deploy externo também seguem pendentes de validação. Gerar `package-lock.json` em ambiente com acesso ao registro npm.

**Ação do responsável pelo projeto:** revisar as decisões de implementação, executar os testes integrados e de ponta a ponta, corrigir eventuais falhas, criar credenciais seguras e publicar o serviço com domínio/HTTPS. Atualizar esta seção com os resultados efetivamente observados, sem declarar validações que não aconteceram.
