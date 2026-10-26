# Ateliê — Casa de Leilões Online

**Teste técnico Elite Dev — Verzel**  
React + TypeScript · Node.js + Express · PostgreSQL + Prisma · Socket.IO

Uma casa de leilões de obras de arte dos acervos públicos do **Cleveland Museum of Art** (novos lotes com imagem CC0) e do **Art Institute of Chicago** (lotes anteriores e dados demonstrativos). Leiloeiros publicam lotes; licitantes depositam créditos fictícios, dão lances em tempo real e recebem comprovantes compartilháveis. O público acompanha uma auditoria criptográfica sem login.

> **Simulação educacional.** Não processa pagamentos reais, não transfere titularidade de obras e não emite notas fiscais.

## O que está implementado

- **Perfis separados:** Leiloeiro publica/gerencia; Licitante deposita, participa, acompanha lances e arremates. Regras de autorização validadas no backend.
- **Vitrine:** Lotes ao vivo, programados e encerrados; cancelados não aparecem. Busca por obra/artista, filtros e paginação.
- **Catálogo externo:** Novos lotes pesquisados no Cleveland Museum of Art, limitados a obras CC0 com imagem; lotes existentes do Art Institute preservados. Cache em disco para imagens selecionadas e snapshot no lote. Indisponibilidade externa não afeta leilões publicados.
- **Sala ao vivo:** Lance atual, mínimo seguinte, líder anônimo, histórico, contagem regressiva e Socket.IO com reinscrição automática da sala após reconexões (sem F5).
- **Carteira:** Saldo total, comprometido, disponível, depósitos fictícios e lançamentos. Reservas transferidas quando há novo líder.
- **Anti-sniping:** Lance válido aceito com até 2 minutos restantes prorroga `endsAt` em mais 2 minutos.
- **Liquidação:** Ao encerrar, só o vencedor é debitado, o leiloeiro é creditado, e um comprovante público assinado é gerado. Lote sem lances encerra sem vencedor.
- **Integridade:** HMAC-SHA-256 encadeado + âncoras externas, com outbox transacional persistente e reconciliação automática após falhas de gravação. Detecta mudanças no histórico, inclusive exclusão do último lance quando ancorado.
- **Extras:** Cancelamento com estorno automático, Docker Compose, testes automatizados, Dark Mode, layout responsivo e impressão de comprovante como PDF.

## Pré-requisitos

- Node.js **22 LTS** (ou 20.11+), npm.
- PostgreSQL 16+ **ou** Docker Compose (recomendado).
- Portas livres: 5432 para o banco (apenas se ele for exposto) e 3001/5173 para a aplicação.

## Como executar localmente

### 1. Clone e configure o ambiente

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd elite-dev-leiloes
cp .env.example .env
```

No Windows PowerShell, use `Copy-Item .env.example .env`.

Edite `.env` antes de iniciar. Em particular, configure `JWT_SECRET`, `AUDIT_SECRET` e `POSTGRES_PASSWORD` com **segredos diferentes e aleatórios**, mesmo em ambiente de avaliação. Um exemplo de geração (Node.js):

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Execute duas vezes. Não comite nem publique `.env`. Se a senha de banco contiver caracteres especiais, faça o URL-encode dela em `DATABASE_URL`.

### 2. Inicie o banco PostgreSQL

Com Docker instalado:

```bash
docker compose up -d postgres
```

Essa configuração cria um PostgreSQL local persistente **sem expor a porta do banco ao host**. Para executar a API fora do Docker, publique a porta do banco apenas em loopback usando o comando de exemplo abaixo, ou use uma instância local PostgreSQL instalada:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d postgres
```

Ajuste `DATABASE_URL` no `.env` para `postgresql://atelier:<SENHA>@localhost:5432/atelier?schema=public`.

### 3. Instale, migre, gere os dados e inicie

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Frontend: **http://localhost:5173**
- API: **http://localhost:3001/api/health**

O servidor Vite encaminha `/api` e `/socket.io` para a API; não é necessário CORS em desenvolvimento.

### Contas de demonstração

Com `DEMO_SEED=true` no `.env`, o seed garante um leiloeiro, dois licitantes, lotes ao vivo (inclusive com lances), futuro e um arremate com comprovante. **Ele pode ser executado novamente:** preserva lances/históricos e só cria novos lotes quando os anteriores deixam de atender à vitrine demonstrativa. Os lotes principais ficam ativos por 14 e 20 dias, não por minutos. Também repõe saldo fictício dos usuários demo quando necessário, registrando o depósito.

| Perfil | E-mail | Senha (somente demonstração) |
|---|---|---|
| Leiloeiro | `leiloeiro@demo.com` | `Teste@12345` |
| Licitante 1 | `ana@demo.com` | `Teste@12345` |
| Licitante 2 | `bruno@demo.com` | `Teste@12345` |

**Segurança:** não habilite credenciais públicas previsíveis em um ambiente com dados reais. A seed foi pensada exclusivamente para avaliação. Desabilite com `DEMO_SEED=false` após a preparação do ambiente publicado, se necessário.

## Execução integral com Docker Compose

Para construir frontend, iniciar API, migrar o PostgreSQL e manter as âncoras em volume persistente:

```bash
docker compose up -d --build
docker compose logs -f app
```

Visite **http://localhost:3001**. O build React é servido pelo mesmo processo Node, então cookies e WebSocket compartilham a mesma origem. Para carga de demonstração, defina `DEMO_SEED=true` no `.env` antes do primeiro `up`.

O Docker Compose cria dois volumes independentes:

- `postgres_data` — banco de dados.
- `audit_anchors` — assinaturas externas de lances (fora do banco).

**Não remova o volume de âncoras** enquanto os lotes correspondentes existirem. Guarde backups independentes, restrinja acesso e não altere `AUDIT_SECRET` ao atualizar o serviço: ambos são necessários para verificar lances anteriores. A outbox não substitui o volume externo.

## Deploy público com HTTPS

O **deploy é obrigatório na avaliação**, mas precisa ser realizado na sua infraestrutura/conta de hospedagem. O repositório inclui os arquivos de produção para rodar em uma VPS com Docker + DNS + Caddy:

1. Crie uma VPS com Docker Compose e aponte um domínio/subdomínio para o IP público. Libere as portas 80 e 443 no firewall.
2. Faça clone do projeto no servidor e configure `.env` com segredos fortes, `PUBLIC_DOMAIN=seu-dominio.com.br`, `DEMO_SEED=true` apenas na primeira carga e uma senha Postgres URL-safe. Nunca envie `.env` ao GitHub.
3. Execute:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
docker compose -f compose.yaml -f compose.prod.yaml ps
```

4. O Caddy providencia HTTPS automático para o domínio informado. Verifique `https://seu-dominio.com.br/api/health`, o login, os lances em duas abas, a auditoria e o compartilhamento do comprovante.
5. Configure backup para **ambos** os volumes; a âncora assinada separada deve sobreviver a recriações do container.
6. Após confirmar o funcionamento, preencha o link público real no formulário de entrega e no README do repositório.

Não há URL publicada neste pacote: é necessário possuir a infraestrutura e testar o endereço externo.

## Testes e qualidade

```bash
npm test                  # Node.js puro: regras, auditoria, outbox e scheduler
npm run test:api         # integração real com PostgreSQL (usa TEST_DATABASE_URL)
npm run test:web         # Vitest: formatação e reconexão das salas
npm run test:e2e         # Playwright: UI com mocks + Chromium desktop/mobile
npm run lint:syntax      # parsing TS/TSX
npm run typecheck        # TypeScript frontend
npm run build            # Prisma Client + bundle de produção
```

Para os testes de integração, use **um banco de testes separado** do banco de desenvolvimento:

```bash
export TEST_DATABASE_URL='postgresql://atelier:<SENHA>@localhost:5432/atelier_test?schema=public'
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run test:api
```

No PowerShell, defina `$env:TEST_DATABASE_URL` e `$env:DATABASE_URL` com o mesmo endereço de teste antes do `db:migrate`, depois restaure `DATABASE_URL` do projeto. Instale o navegador do Playwright antes do primeiro E2E: `npx playwright install chromium` (no Linux, eventualmente `npx playwright install --with-deps chromium`).

Os testes de interface normais usam mock da API para repetibilidade. O arquivo `e2e/real-flow.spec.ts` acrescenta **duas sessões reais**, lances via HTTP, WebSocket, saldos e auditoria. Execute somente contra **banco isolado, migrado e com seed**:

```bash
# Linux/macOS - depois de configurar DATABASE_URL e TEST_DATABASE_URL para o banco isolado
DEMO_SEED=true npm run db:seed
E2E_REAL=true npm run test:e2e
```

No Windows PowerShell, atribua `$env:DEMO_SEED='true'` e `$env:E2E_REAL='true'` antes dos comandos. O Playwright inicia backend + frontend em `E2E_REAL=true` e guarda capturas em `test-results/`. O teste de integração também verifica recuperação de âncoras e adulteração **diretamente no PostgreSQL**.

O workflow `.github/workflows/checks.yml` automatiza o conjunto em um PostgreSQL descartável no GitHub Actions. **A pipeline foi criada, mas ainda não foi executada nesta sessão.** Não existe `package-lock.json` no pacote porque o registro npm estava inacessível durante a geração: em uma máquina com internet, execute `npm install`, versione o lockfile gerado e altere o passo de instalação do workflow e do `Dockerfile` para `npm ci` antes da submissão. Não invente dependências/transitivos para preencher esse arquivo.

## Arquitetura, estados e regras

```text
apps/
├── api/
│   ├── prisma/schema.prisma       # Entidades e relações
│   ├── prisma/migrations/          # Migração SQL versionada
│   ├── prisma/seed.js              # Contas e lotes para a banca
│   ├── src/domain/                # Regras financeiras e assinaturas puras
│   ├── src/services/              # Integração externa, transações, auditoria
│   ├── src/routes/                # REST, autenticação e perfis
│   └── src/server.js              # Express, Socket.IO, scheduler, estáticos
└── web/
    └── src/
        ├── pages/                  # Vitrine, lote, autenticação, painel etc.
        ├── contexts/               # Sessão e tema
        ├── components/             # Cards, contagem e layout
        └── lib/                    # HTTP, contratos e formatação
```

A regra financeira principal é:

```text
saldo_disponivel = saldo_total - saldo_comprometido
1º lance >= lance_inicial
próximos_lances >= último_lance + incremento_mínimo
se novo_lance for aceito: reservar novo valor e liberar reserva do líder anterior
se vencedor encerrar: saldo_total -= valor; comprometido -= valor; leiloeiro += valor
```

As alterações de carteira e histórico de lance são atômicas em transações `SERIALIZABLE`, com `SELECT FOR UPDATE` no lote e tentativas de recuperação em caso de conflito. Eventos de websocket notificam o navegador a cada mudança de lote, inclusive na transição agendado→ao vivo; após reconexão a sala é reinscrita e os dados recarregados. A assinatura HMAC usa segredo fora do banco. Cada lance grava uma linha na outbox na mesma transação do dinheiro e depois sincroniza com arquivo externo, com nova tentativa pelo scheduler. Se uma âncora não puder ser verificada, o encerramento é suspenso.

Há um scheduler que verifica o prazo de encerramento a cada 5 segundos. O estado temporal verdadeiro é calculado pelo relógio do servidor para impedir lances antes ou depois do intervalo. Toda liquidação é idempotente e protegida pela trava transacional do lote.

## Referências e documentos

- [Mapeamento dos requisitos e status](docs/MATRIZ_REQUISITOS.md)
- [Arquitetura e fluxos](docs/ARQUITETURA.md)
- [Contrato das rotas REST](docs/API.md)
- [Plano de testes e aceite](docs/TESTES_E_ACEITE.md)
- [Uso de inteligência artificial](docs/USO_DE_IA.md)
- [Checklist final de entrega e publicação](docs/ENTREGA.md)
- [Art Institute of Chicago — documentação oficial](https://api.artic.edu/docs/)
- [Cleveland Museum of Art — Open Access API](https://openaccess-api.clevelandart.org/)
- [Prisma — transações e isolamento](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)

## Informações da entrega

- **Repositório público:** preencher após publicação no GitHub.
- **Deploy público:** preencher após disponibilização real por HTTPS.
- **Autoria e IA:** descrição honesta no arquivo [USO_DE_IA.md](docs/USO_DE_IA.md), que deve acompanhar o formulário de entrega.

> Validação desta correção: **31 testes Node aprovados** no ambiente local de análise (domínio, auditoria, AIC, Cleveland e cache de imagens), e arquivos JS/TS/TSX analisados sem erro de sintaxe. O build completo React/Prisma, a nova migração em PostgreSQL e as imagens reais servidas pelo CDN **ainda precisam ser validados na máquina da publicação**. O GitHub Actions deve ser executado novamente após aplicar este patch.

## Miniaturas de obras demonstrativas

Os lotes do seed usam pinturas em domínio público do Art Institute of Chicago. Em algumas redes, a CDN IIIF do museu pode recusar o carregamento no navegador. O frontend tenta uma cópia local e fontes públicas alternativas, respeitando o identificador de cada obra (não troca Van Gogh por Seurat).

Para eliminar a dependência de servidores de imagem durante a apresentação, execute **uma vez, com internet**, antes do build/deploy:

```bash
npm run images:cache
```

O comando salva `apps/web/public/artworks/27992.jpg` (Seurat) e `apps/web/public/artworks/28560.jpg` (Van Gogh). Confirme que as obras aparecem corretamente na vitrine e na sala do lote. Inclua esses dois JPEGs no Git antes do deploy:

```bash
git add apps/web/public/artworks/27992.jpg apps/web/public/artworks/28560.jpg
git commit -m "chore(assets): adicionar miniaturas publicas dos lotes demo"
```

Não é necessário limpar o banco nem executar a seed para resolver imagens de lotes existentes. Para imagens de novas obras pesquisadas no catálogo, a URL IIIF da API continua sendo utilizada; sem conexão com o museu, o componente exibe uma indicação de imagem indisponível, sem substituir a obra por uma imagem incorreta.

**Fontes e licença:** pinturas em domínio público. Reproduções demonstrativas disponibilizadas no [Wikimedia Commons - Seurat](https://commons.wikimedia.org/wiki/File:A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg) e [Wikimedia Commons - Van Gogh](https://commons.wikimedia.org/wiki/File:Van_Gogh_-_The_Bedroom,_1889_Chicago.jpg). Consulte também a [documentação oficial da API IIIF do museu](https://api.artic.edu/docs/).

## Imagens bloqueadas pelo museu (Cloudflare / IIIF)

A API do Art Institute of Chicago pode retornar os metadados da obra com sucesso,
mas o host de imagens IIIF (`www.artic.edu/iiif/2`) pode responder HTTP 403.
Isso nao e falha do PostgreSQL, do Tailscale nem da busca por artistas.

Para lotes antigos do Art Institute, o frontend tenta imagens IIIF oficiais,
sem usar a miniatura LQIP (poucos pixels) como reprodução definitiva. Quando o
museu bloqueia as imagens, o estado indisponível é exibido corretamente.

Para ter uma reproducao de qualidade em qualquer lote (inclusive ja criado),
o leiloeiro deve abrir **Painel do leiloeiro > Seu catalogo**, clicar no botao
**Adicionar imagem** ao lado do lote e enviar JPEG, PNG ou WebP de ate 4 MB.
Somente lotes nao encerrados e **sem nenhum lance** permitem a troca, impedindo
alteracoes da representacao da obra depois que a disputa comecou.
A imagem deve representar **exatamente aquela obra** e ter permissao de uso.

Os arquivos sao gravados em `storage/lot-images/` e a URL relativa fica em
`Auction.imageUrl`, sem nova migracao. O diretorio `storage/` ja esta ignorado
pelo Git e inclui o volume persistente de `/app/storage` na configuracao Docker.
**Nao apague `storage/lot-images/` nem o volume associado**, pois lotes apontam
para esses arquivos. Nao confunda esse armazenamento com o arquivo de assinaturas
da auditoria, que tambem deve ser preservado e ter backups independentes.

> Se o lote ja recebeu lances, publique um novo lote com a imagem correta,
> em vez de substituir a imagem de um leilao em andamento. Os lotes antigos
> sem imagem permanecem identificados como indisponíveis até receberem uma reprodução válida.

## Catálogo de novas obras com imagens CC0 (Cleveland Museum of Art)

Para evitar a indisponibilidade recorrente das imagens IIIF do Art Institute, a busca
do leiloeiro agora utiliza por padrão a API oficial **Cleveland Museum of Art Open Access**.
Ela pesquisa por título ou artista (`q`), exige `cc0` e `has_image=1`, e verifica
novamente que cada resultado seja CC0, com URL HTTPS do CDN autorizado.

- O identificador da fonte (`Auction.artworkSource`) é versionado na migração
  `20261025000000_artwork_sources`. Lotes existentes recebem `ART_INSTITUTE`
  automaticamente, sem apagar históricos, saldos ou assinaturas.
- Cada novo lote guarda `artworkSource`, `artworkId`, `artworkUrl` e a imagem original
  da coleção escolhida. Os IDs de museus diferentes nunca são misturados.
- Quando uma imagem web não abre no navegador, o frontend tenta
  `/catalog-images/cma/:id`. O backend somente baixa o mesmo item do CDN
  `openaccess-cdn.clevelandart.org`, valida os bytes e salva uma cópia em
  `storage/catalog-images/` (máximo 4 MB). Esse diretório está no volume
  persistente já usado pela aplicação. A cópia também é tentada ao publicar o lote.
- Se o CDN ficar indisponível ANTES do cache, a imagem poderá continuar ausente;
  o leiloeiro poderá anexar uma reprodução autorizada daquela mesma obra antes
  de receber lances. Não são fabricadas imagens.
- Os lotes anteriores do Art Institute **não são trocados automaticamente** por
  obras do Cleveland: são objetos diferentes e isso comprometeria a curadoria.

### Atualizar uma instalação existente

Com a aplicação Node parada no Windows, mas o PostgreSQL em execução:

```cmd
npm run db:generate
npm run db:migrate
npm test
npm run test:web
npm run typecheck
npm run build
set NODE_ENV=production
set TRUST_PROXY=true
npm start
```

O `build` já gera o Prisma Client de novo; executar `db:generate` separadamente
é uma conferência opcional. Não use `docker compose down -v`, não apague o
banco nem os diretórios `storage/`. No Windows, o backend deve estar parado
para não manter o motor Prisma DLL bloqueado durante o `db:generate`.

A integração ao vivo com o CDN precisa ser confirmada na máquina publicada,
pois o ambiente de desenvolvimento dos patches não possui acesso direto
à internet externa. Consulte os logs do backend caso o CDN responda HTTP 403/502.
