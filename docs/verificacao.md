# Verificação: `npm run check`

Um comando gera o site e roda todas as verificações (decisão 0020). Leva cerca de 6 minutos (o Lighthouse roda 3 vezes por página). Imprime só o que está errado
(`FALHA …` ou `aviso …`) e uma linha final, por exemplo:

```
check: 0 falhas, 12 avisos [build, próprios, html-validate, links, pa11y, lighthouse]
```

- **Falha** bloqueia a publicação (`prepare-upload` recusa um build que não passou).
- **Aviso** é listado e resolvido antes do lançamento (fotos que faltam, blocos "em construção", etc.).
- `npm run check -- --rapido`: sem navegador (sem pa11y e Lighthouse), para edições rápidas. Não libera o envio.
- `npm run check -- --externos`: também testa links para outros sites (avisos; precisa de internet).

| Etapa | Ferramenta | O que falha |
|---|---|---|
| build | Eleventy | erro no Markdown, no front matter ou nos modelos |
| próprios | `scripts/lib/static-checks.mjs` | comentário de fonte/GAP no site, texto diferente da cópia aprovada, `<script>`, recurso de terceiros, link fora de `config/hosts.json`, link relativo ou sem `/`, CPF/RG/telefone/e-mail não permitido, imagem sem alt/largura/altura, peso de página/imagem, título/descrição/h1, sitemap, regras de animação M1–M7 (abaixo) |
| html-validate | html-validate 11.21.1 | HTML inválido (`config/htmlvalidate.json`) |
| links | linkinator 8.1.0 | link interno ou âncora `#` quebrados, redirecionamento interno |
| pa11y | pa11y-ci 5.0.0 (axe) | qualquer violação WCAG 2.2 A/AA que o axe detecta |
| lighthouse | @lhci/cli 0.16.1 | mediana de 3 execuções (celular): desempenho < 85, acessibilidade < 95, SEO ou boas práticas < 90, LCP > 3 s, CLS > 0,1, pedido a terceiros |

Limites em `config/thresholds.json`. A partir do Gate 5, `"gap_e_todo_falham": true` faz `[GAP` e `TODO` virarem falha.

`config/htmlvalidate.json` desliga `no-redundant-role` de propósito: as tabelas mantêm `role="table"` etc. porque no
celular o CSS as empilha, e alguns leitores de tela perdem a tabela sem esses papéis.

## Animações (M1–M7)

O site tem pouco movimento, só em CSS (decisão 0026). A etapa "próprios" lê o CSS gerado em `_site/` (arquivos `.css`,
`<style>` e `style=""`) e falha quando:

| Regra | Falha quando | Como corrigir |
|---|---|---|
| M1 | `animation`, `animation-timeline`, `@view-transition` ou `transition` de `transform`/`translate`/`scale`/`rotate`/`all` fora de `@media (prefers-reduced-motion: no-preference)` | coloque a regra dentro desse `@media` (quem pediu "reduzir movimento" no sistema não vê a animação) |
| M2 | `infinite` | use um número de repetições |
| M3 | duração × repetições + atraso > 5 s (exceto em `:hover`/`:focus` ou com `animation-timeline`) | encurte |
| M4 | ciclo < 333 ms repetido mais de uma vez | ciclo mais lento ou uma vez só (risco de piscar) |
| M5 | `@keyframes` muda algo além de `transform`, `translate`, `scale`, `rotate`, `opacity` | anime só essas propriedades (as outras travam a página e mexem o layout) |
| M6 | `animation-timeline` fora de `@supports (animation-timeline: …)` | envolva no `@supports` (navegadores antigos mostram o conteúdo parado) |
| M7 | `<animate>`/`<set>` em SVG/HTML, arquivo `.gif`, PNG ou WebP animado | use CSS ou imagem parada |

**Aviso** (não bloqueia): animação ou `@starting-style` no `h1`, `.hero` ou `picture`, que pode atrasar o carregamento
do elemento principal. Para testar só essas regras em outra pasta (por exemplo um protótipo de design):
`node scripts/lib/static-checks.mjs --movimento ../design/prototype-v2`. Uma pessoa ainda confere uma vez com
"reduzir movimento" ligado no sistema.

## Chrome

pa11y e Lighthouse precisam de um Chrome. O check procura, nesta ordem: `CHROME_PATH`, o Chrome do puppeteer
(`npx puppeteer browsers install chrome`, ~170 MB), o Google Chrome ou o Edge instalados. Sem nenhum, ele falha e diz isso.

Ferramentas automáticas acham só parte dos problemas de acessibilidade: a revisão manual antes do lançamento continua obrigatória.
