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

## EvolutionAPI: erro "database evolution does not exist"

Se você já subiu o Postgres antes (volume `db_data` já inicializado), scripts em `/docker-entrypoint-initdb.d` não rodam novamente.
O compose inclui o serviço `db-bootstrap` que cria o database `evolution` de forma idempotente.

- Execute uma vez: `docker compose up -d db-bootstrap`

## VPS (domínio/IP)

No servidor, ajuste as URLs públicas (origins) no arquivo `.env` da raiz para:

- `FRONTEND_PUBLIC_ORIGIN` (ex.: `https://stylehub.helderporto.com`)
- `FRONTEND_PUBLIC_ORIGINS` (CORS; ex.: `https://stylehub.helderporto.com,https://www.stylehub.helderporto.com`)
- `API_PUBLIC_ORIGIN` (ex.: `https://stylehubapi.helderporto.com`)
- `EVOLUTION_PUBLIC_ORIGIN` (ex.: `https://evolution.stylehub.helderporto.com`)

Importante: em produção use sempre `https://...` nessas URLs públicas para evitar erro de Mixed Content no navegador.

O frontend também força automaticamente HTTPS nas URLs da API/Evolution quando a página estiver em HTTPS (guardrail contra configuração incorreta).

Se preferir, você também pode exportar essas variáveis no ambiente do servidor antes de subir o compose.

Opcionalmente você pode sobrescrever as portas publicadas no host:

- `API_PORT_HOST` (padrão 15000)
- `FRONTEND_PORT_HOST` (padrão 13000)
- `EVOLUTION_PORT_HOST` (padrão 18080)

## Evolution API acessível pela internet (somente HTTPS)

A Evolution escuta na porta `18080` do host. O acesso público `https://evolution.stylehub.helderporto.com`
deve ser feito por um **reverse proxy com TLS** na VPS (o mesmo padrão do frontend/API), que termina o
HTTPS e encaminha para `127.0.0.1:18080`. Nada de HTTP é exposto — o proxy redireciona 80 -> 443.

No `.env` da raiz defina:

```
EVOLUTION_PUBLIC_ORIGIN=https://evolution.stylehub.helderporto.com
FRONTEND_PUBLIC_ORIGINS=https://stylehub.helderporto.com,https://www.stylehub.helderporto.com
```

O `docker-compose.yml` usa `EVOLUTION_PUBLIC_ORIGIN` para configurar o `SERVER_URL`
(QR code/webhooks). O CORS da Evolution fica liberado (`CORS_ORIGIN=*`), pois a API é
protegida por **API key** — e clientes servidor-a-servidor (o backend da API que envia
notificações, webhooks, plataformas externas de atendimento) chamam **sem header `Origin`**.
Restringir a origin faz a Evolution responder `500 "Not allowed by CORS"` para esses clientes.
Se precisar restringir mesmo assim, defina `EVOLUTION_CORS_ORIGIN` no `.env`.

Exemplo de vhost Nginx (server block do proxy da VPS):

```nginx
server {
    listen 443 ssl;
    server_name evolution.stylehub.helderporto.com;

    ssl_certificate     /etc/letsencrypt/live/evolution.stylehub.helderporto.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evolution.stylehub.helderporto.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket (caso habilite eventos em tempo real)
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name evolution.stylehub.helderporto.com;
    return 301 https://$host$request_uri;
}
```

Gere o certificado com `certbot --nginx -d evolution.stylehub.helderporto.com` e garanta que o DNS
do subdomínio aponte para a VPS.

