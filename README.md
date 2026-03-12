# Para executar: 
- 1° passo: docker compose up --build
- 2° passo: Crie sua conta no sistema (por padrão: http://localhost:13000)
- 3° passo: Altere a role para owner no container do postgres (UPDATE users SET role = 'owner' WHERE email = 'seu@email.com';)

## Portas (padrão)

Este projeto foi configurado para evitar conflito de portas na VPS mudando apenas as portas publicadas no HOST (as portas internas dos containers continuam as mesmas).

- Frontend: 13000 -> 3000
- API: 15000 -> 5000
- Evolution API: 18080 -> 8080

Postgres e Redis não são publicados no host (ficam acessíveis apenas dentro da rede Docker).

## VPS (domínio/IP)

No servidor, defina as URLs públicas (origins) para o frontend apontar corretamente para a API/Evolution e para o backend liberar CORS e gerar link de reset de senha.

- Variáveis recomendadas:
	- `FRONTEND_PUBLIC_ORIGIN` (ex.: `https://stylehub.helderporto.com`)
	- `API_PUBLIC_ORIGIN` (ex.: `https://stylehubapi.helderporto.com`)
	- `EVOLUTION_PUBLIC_ORIGIN` (se for expor publicamente; caso contrário pode manter o padrão)

- Exemplo (PowerShell):
	- `setx FRONTEND_PUBLIC_ORIGIN "https://stylehub.helderporto.com"`
	- `setx API_PUBLIC_ORIGIN "https://stylehubapi.helderporto.com"`

Opcionalmente você pode sobrescrever as portas publicadas no host:

- `API_PORT_HOST` (padrão 15000)
- `FRONTEND_PORT_HOST` (padrão 13000)
- `EVOLUTION_PORT_HOST` (padrão 18080)

