-- Script para inicializar o banco de dados da EvolutionAPI
-- Este script é executado automaticamente quando o container PostgreSQL é iniciado pela primeira vez

-- Criar o banco evolution se não existir
SELECT 'CREATE DATABASE evolution'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec

-- Conectar ao banco evolution e criar um usuário específico se necessário
-- (Opcional: por enquanto vamos usar o usuário postgres padrão)

-- Log da criação
\echo 'Banco evolution criado/verificado com sucesso para EvolutionAPI'