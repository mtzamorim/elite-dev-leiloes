# Checklist de entrega: Elite Dev Verzel

## 1. Preparar o repositório no computador com internet

```bash
npm install
# Verificar se package-lock.json foi gerado. O arquivo precisa ser versionado.
git add package-lock.json
git commit -m "chore(deps): travar versoes do npm para builds reproduziveis"
```

Depois, troque `npm install` por `npm ci` no workflow `.github/workflows/checks.yml` e no estágio de build do `Dockerfile` (copiar também `package-lock.json` para a imagem antes do `npm ci`), em um commit separado. A rede deste ambiente não permitiu gerar um lockfile verdadeiro; não inventar hashes, URLs ou versões transitivas.

## 2. Validar tudo localmente (banco separado para testes)

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm test
npm run test:web
npm run lint:syntax
npm run typecheck
npm run build
```

Para `npm run test:api`, criar previamente um banco **exclusivo para testes**, migrá-lo via `DATABASE_URL=<URL_DO_BANCO_DE_TESTES> npm run db:migrate` e configurar `TEST_DATABASE_URL` com o mesmo endereço. Em seguida, após preparar a seed nesse banco isolado:

```bash
npx playwright install chromium
E2E_REAL=true npm run test:e2e
```

O teste E2E real cria contas, deposita créditos e registra lances, portanto nunca deve apontar para um banco de produção. Em Windows PowerShell, configure as variáveis via `$env:NOME='valor'` antes de rodar os comandos.

## 3. Subir o GitHub público

Crie um repositório **público vazio** em sua conta GitHub. No clone local deste projeto, após revisar os commits:

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Se já houver `origin`, use `git remote set-url origin ...` em vez de `add`. Confira a aba **Actions** do GitHub: todos os jobs devem ficar verdes; baixe o artefato `playwright-artifacts` e inspecione capturas desktop/mobile, sala real e auditoria. Uma pipeline apenas criada (sem execução) não comprova o funcionamento.

## 4. Publicar HTTPS com Compose

Em uma VPS com Docker Compose, DNS do domínio apontando para a VPS e portas 80/443 liberadas:

1. Clone o repositório público e crie `.env` usando `.env.example`, com `JWT_SECRET`, `AUDIT_SECRET`, `POSTGRES_PASSWORD` aleatórios. Defina `PUBLIC_DOMAIN=seu-subdominio.exemplo.com` e `DEMO_SEED=true` somente para ambiente de avaliação.
2. Execute `docker compose -f compose.yaml -f compose.prod.yaml config --quiet` para conferir a configuração.
3. Execute `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`.
4. Confira `docker compose -f compose.yaml -f compose.prod.yaml ps` e `docker compose -f compose.yaml -f compose.prod.yaml logs --tail=100 app`.
5. Abra `https://SEU_DOMINIO/api/health` e confirme JSON com `status:ok`. Confira a vitrine, autenticação, carteira, lances, auditoria e comprovante **em navegador anônimo externo**.
6. Preserve os volumes `postgres_data` e `audit_anchors` e o mesmo `AUDIT_SECRET` em futuras publicações. Não aplique `docker compose down -v`.

Se não houver lote ao vivo no momento da avaliação, **não altere dados antigos**: execute `docker compose -f compose.yaml -f compose.prod.yaml exec -e DEMO_SEED=true app npm run db:seed`. A seed é reexecutável e renova a demonstração sem apagar o histórico anterior.

## 5. Evidências e submissão

- [ ] Link GitHub público abre os arquivos, migrations, testes, documentação e histórico de commits.
- [ ] GitHub Actions verde (incluindo PostgreSQL, React e Chromium).
- [ ] URLs de HTTPS, login, sala de lote, auditoria e comprovante funcionam externamente.
- [ ] Pelo menos um lote ao vivo possui lances; as contas de demonstração têm saldo.
- [ ] `package-lock.json` e o uso de `npm ci` estão versionados.
- [ ] Capturas desktop/mobile e do teste E2E real revisadas.
- [ ] README explica setup, características de simulação e limitações.
- [ ] Campo sobre IA do formulário descreve de modo fiel o uso e as revisões realizadas.

A página 7 do PDF exige **dois links públicos (código e aplicação)** e a informação de uso de IA. A presença de arquivos locais ou ZIP não substitui a disponibilização desses endereços.
