# MunicipioCloud

Sistema para acompanhamento anual das obrigacoes municipais, com banco MySQL e autenticacao propria por e-mail/senha.

## Requisitos locais

- Node.js 20+
- MySQL 8+ ou MariaDB compativel

## Instalar

1. Instale as dependencias:
   `npm install`
2. Copie `.env.example` para `.env` e ajuste os dados do MySQL.
3. Crie o banco configurado em `DB_DATABASE`.
4. Execute migrations e seeders:
   `npm run db:setup`
5. Rode a aplicacao localmente:
   `npm run dev`

## Acesso inicial

- E-mail: `comercialmetabit@gmail.com`
- Senha: valor de `ADMIN_PASSWORD` no `.env` ou `admin` quando nao configurado.

## Scripts de banco

- `npm run db:migrate`: cria/atualiza a estrutura MySQL.
- `npm run db:seed`: popula perfis, permissoes, administrador e dados minimos.
- `npm run db:setup`: executa migrations e seeders em sequencia.

## Producao

Para hospedagem compartilhada, gere o build estatico com `npm run build` e publique o conteudo de `dist` junto com a pasta `api`, a pasta `database` e um arquivo `.env` configurado para o MySQL da hospedagem.
