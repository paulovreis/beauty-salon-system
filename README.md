# Para executar: 
- 1° passo: docker compose up --build
- 2° passo: Crie sua conta no sistema (por padrão: http://localhost:13000)
- 3° passo: Altere a role para owner no container do postgres (UPDATE users SET role = 'owner' WHERE email = 'seu@email.com';)

## Configuração (.env único)

Este projeto usa um único arquivo de configuração na raiz: `.env`.

- Backend (API), Frontend e EvolutionAPI são configurados a partir desse `.env` via `docker-compose.yml`.

## Portas (padrão)

Este projeto foi configurado para evitar conflito de portas na VPS mudando apenas as portas publicadas no HOST (as portas internas dos containers continuam as mesmas).

- Frontend: 13000 -> 3000
- API: 15000 -> 5000
- Evolution API: 18080 -> 8080

Postgres e Redis não são publicados no host (ficam acessíveis apenas dentro da rede Docker).

## VPS (domínio/IP)

No servidor, ajuste as URLs públicas (origins) no arquivo `.env` da raiz para:

- `FRONTEND_PUBLIC_ORIGIN` (ex.: `https://stylehub.helderporto.com`)
- `API_PUBLIC_ORIGIN` (ex.: `https://stylehubapi.helderporto.com`)
- `EVOLUTION_PUBLIC_ORIGIN` (opcional, se você expor a Evolution publicamente)

Se preferir, você também pode exportar essas variáveis no ambiente do servidor antes de subir o compose.

Opcionalmente você pode sobrescrever as portas publicadas no host:

- `API_PORT_HOST` (padrão 15000)
- `FRONTEND_PORT_HOST` (padrão 13000)
- `EVOLUTION_PORT_HOST` (padrão 18080)

