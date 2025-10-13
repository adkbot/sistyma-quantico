# Sistyma Quantico (Synapse-Arbitrage Mind)

Aplicação completa para monitorar e operar arbitragem (spot vs futures e triangular) com painel em React + Tailwind e backend em Node/Express. Inclui testes com Jest, integração com Binance via `ccxt`, armazenamento seguro de chaves e SSE para streaming de estado em tempo real.

## Stack
- Frontend: Vite + React + TypeScript + shadcn-ui + Tailwind CSS
- Backend: Node + Express + TypeScript (executado com `tsx`)
- Tests: Jest + ts-jest
- Outros: `ccxt`, `axios`, `bottleneck`, `winston`

## Requisitos
- Node.js >= 20 (recomendado LTS)
- npm >= 9

## Instalação
```sh
npm install
```

## Desenvolvimento
Execute frontend e backend em paralelo:
```sh
# Frontend (Vite) em http://localhost:8083
npm run dev

# Backend (Express) em http://localhost:3001
npm run backend
```

No Windows você pode usar:
```bat
start-all.bat
```

Endpoints úteis do backend:
- `GET /api/status` — health básico
- `GET /api/state` — snapshot do estado do bot
- `POST /api/bot/start` — inicia o bot
- `POST /api/bot/stop` — para o bot
- `GET /api/stream` — SSE com atualizações do estado
- `GET /api/balances/spot/raw` — diagnóstico de saldos spot (Binance)

## Variáveis de ambiente
Configure um arquivo `.env` na raiz (o `.gitignore` já impede versionamento):

```env
# Frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=

# Binance (se usar via ambiente; normalmente as chaves são salvas via API)
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Backend
PORT=3001
CORS_ORIGIN_LIST=http://localhost:8083
# Caminho do cofre de chaves criptografado
KEY_STORE=./data/keys.json
# Segredo obrigatório para cifrar o cofre (AES-GCM)
SERVER_SECRET=defina-um-segredo-forte-aqui

# Integracoes (opcionais)
REDIS_URL=
DATABASE_URL=
GEX_API_BASE=
GEX_API_TOKEN=
```

Observações importantes:
- `SERVER_SECRET` é obrigatório. Sem ele, o backend encerra ao iniciar (ver `src/lib/keyStore.js`).
- Chaves Binance podem ser cadastradas via `POST /api/keys` e ficam criptografadas em `data/keys.json`.

## Testes
```sh
npm test
```

## Build
Gera os artefatos do frontend em `dist/`:
```sh
npm run build
```

## Deploy (base)
- Frontend: sirva o conteúdo de `dist/` em um servidor estático (Nginx, Vercel, etc.).
- Backend: execute `npm run backend` (dev) ou compile para JS antes de produção. Alternativas:
  - Rodar com `tsx` em produção (simples, suficiente para POC);
  - Adicionar bundler/compilação (ex.: `tsc` ou `tsup`) para gerar `dist/server.js` e usar `npm start`.
- Coloque um proxy reverso (Nginx/Traefik) com TLS e libere apenas o necessário.

## CI (GitHub Actions)
O repositório inclui um workflow básico para:
- Instalar dependências com cache;
- Rodar testes com Jest;
- Build do frontend (Vite).

## Segurança
- `.env` e segredos estão excluídos no `.gitignore`.
- As chaves dos usuários são guardadas criptografadas localmente.
- Ajuste CORS em produção via `CORS_ORIGIN_LIST`.

## Licença
Este projeto é proprietário do autor do repositório. Ajuste esta seção conforme sua necessidade.
