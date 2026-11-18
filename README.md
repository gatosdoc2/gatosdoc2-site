# Site do Gatos do C2

Site estático do **Gatos do C2**, grupo de extensão da USP São Carlos que cuida da colônia de gatos do
Campus 2. Endereço: https://gatosdoc2.eesc.usp.br (hospedado pela EESC).

Feito com [Eleventy](https://www.11ty.dev/) 3.1.8: as páginas são arquivos Markdown, o resultado é HTML
puro, sem JavaScript, sem formulários e sem estatísticas de visita.

## Começar (uma vez)

1. Instale o Node.js **26.13.1** (a versão está em `.nvmrc`; com nvm: `nvm install && nvm use`).
2. Na pasta do repositório: `npm ci`.
3. Se não houver Google Chrome no computador: `npx puppeteer browsers install chrome`.

## Uso do dia a dia

| Quero… | Comando | Guia |
|---|---|---|
| ver o site no meu computador | `npm start` e abrir http://localhost:8080 | `docs/como-funciona.md` |
| mudar um texto | editar o `.md` em `src/pages/` (ou em `content/`, ver abaixo) | `docs/editar-textos.md` |
| colocar uma foto | `docs/fotos.md` | |
| conferir tudo antes de publicar | `npm run check` (deve terminar com `0 falhas`) | `docs/verificacao.md` |
| publicar no servidor | `npm run prepare-upload` e seguir o que ele imprime | `docs/publicacao.md` |

## Regras

- Nada inventado: todo número, data ou afirmação tem fonte. Na dúvida, não publique e pergunte ao grupo.
- Nenhum telefone, CPF, RG ou e-mail pessoal no site ou no repositório. Senhas nunca entram aqui.
- Ninguém (nem IA) envia arquivos ao servidor sem uma pessoa rodar o comando.
- Assistentes de IA: leiam `AGENTS.md`.

Licenças: código MIT; textos e imagens © Gatos do C2 (ver `LICENSE`).
