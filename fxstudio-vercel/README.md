# FXStudio — Portal Web & API de Sincronização (Vercel)

Projeto recriado para hospedagem direta na **Vercel**, sem necessidade de build complexo local.

## Estrutura
- `public/` — Portal web (gerador de tokens, editor de partículas, variáveis Molang e preview).
- `api/v1/tokens.js` — Criação e consulta de tokens (`POST /api/v1/tokens`).
- `api/v1/auth/validate.js` — Validação de token e vínculo com `playerId` (`POST /api/v1/auth/validate`).
- `api/v1/effects/index.js` — CRUD de efeitos (`GET`, `POST`, `DELETE /api/v1/effects`).
- `api/v1/effects/sync.js` — Sincronização incremental (`GET /api/v1/effects/sync?token=...&sinceVersion=...`).

## Como subir na Vercel (sem precisar do npm local)
1. Suba esta pasta para um repositório no **GitHub** (pelo navegador ou GitHub Desktop).
2. Acesse [vercel.com](https://vercel.com), clique em **Add New > Project** e importe o repositório.
3. Clique em **Deploy** (nenhuma configuração extra de build é necessária).
4. *(Opcional recomendado para persistência permanente)* No painel do projeto na Vercel, vá em **Storage > Connect Store > Upstash Redis (KV)** para salvar tokens e partículas permanentemente entre cold starts.
