# Como o site funciona

O Eleventy lê os arquivos de `src/` e gera o site pronto em `_site/` (HTML, CSS, fontes, imagens). Só `_site/`
vai para o servidor. `npm start` mostra o site em http://localhost:8080 e atualiza a cada mudança.

| Pasta / arquivo | O que tem | Quem mexe |
|---|---|---|
| `src/pages/*.md` | o texto de cada página (um arquivo = uma página; `index.md` é a inicial) | conteúdo |
| `src/_data/nav.json` | o menu (ordem e nomes) | conteúdo |
| `src/_data/site.json` | nome, e-mail, Instagram, textos do rodapé | conteúdo |
| `src/_data/rotas.json` | os 4 atalhos da página 404 (iguais aos da inicial; o check compara) | conteúdo |
| `src/_data/componentes.json` | aparência de cada seção, pelo título `##` | design |
| `src/_includes/` | layout comum (cabeçalho, rodapé), `compartilhado.md` (texto aprovado de cabeçalho/rodapé/404) | design |
| `src/assets/css/` | `tokens.css` (cores, fontes; gerado no repositório de planejamento) e `style.css` | design |
| `src/404.njk`, `src/sitemap.njk`, `src/robots.njk` | página de erro, mapa do site, regras para buscadores | técnico |
| `scripts/` | sincronização de textos, verificação, preparação do envio | técnico |
| `config/` | limites da verificação, domínios permitidos, regras de HTML | técnico |

## Do Markdown ao visual

`scripts/lib/components.mjs` transforma o HTML simples do Markdown nos componentes do protótipo, sem mudar palavras:
- o primeiro parágrafo depois do `#` vira o texto de abertura;
- cada `##` abre uma seção; `src/_data/componentes.json` diz qual seção tem fundo alternado, faixa azul, botões ou atalhos;
- `**21 e 22 de março de 2024:** texto` vira um "registro" datado (o check exige que o texto seja igual);
- tabelas ganham rótulos para a leitura em tela pequena; `**Em construção.**` dentro do bloco vira o rótulo do bloco;
- os comentários de `content/` (`<!-- src: … -->`, GAP, notas) não são copiados para este repositório público; um espaço de foto vira só `<!-- PHOTO: -->`;
  um `<!-- PHOTO: … -->` sem foto vira um espaço cinza (o check avisa).

Se você renomear um título `##`, atualize `componentes.json` (o check avisa quando um nome não bate).

## Endereços

Todos começam com `/` e terminam com `/` (`/adocao/`), porque o servidor redireciona endereços sem barra final
(suposição até o teste do servidor). O check falha em links relativos ou sem barra.
