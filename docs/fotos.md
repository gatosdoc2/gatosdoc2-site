# Fotos

As fotos vêm do Drive do grupo. Fotos já no Drive podem ser usadas (inclusive com pessoas); fotos novas de pessoas
precisam de consentimento. Escolha e texto alternativo são feitos **por uma pessoa**.

1. Reduza a foto para no máximo 2400 px no lado maior (qualquer editor) e salve como `.jpg` em `src/assets/fotos/`,
   com nome simples: `acao-de-campo-2024-07-22.jpg` (sem espaços nem acentos).
2. No `.md`, troque o comentário `<!-- PHOTO: … -->` por:

```
![Descrição do que a foto mostra, para quem não enxerga](/assets/fotos/acao-de-campo-2024-07-22.jpg "Legenda: lugar, data e o que aparece. Foto: Gatos do C2.")
```

3. `npm run check`. O build gera versões AVIF, WebP e JPEG em 480 e 960 px, com largura e altura
   (sem "pulos" na página), carregamento preguiçoso e legenda (`<figcaption>`).

O check falha se: o texto alternativo faltar ou ainda for rascunho ("TO WRITE", "[confirmar]"); uma imagem gerada
passar de 300 KB; a página passar de 1,5 MB. Avisa acima de 200 KB por imagem e 1 MB por página.
Foto puramente decorativa: `![](...)` (alt vazio), raro neste site.

Use só fotos guardadas em `src/assets/fotos/`. Um endereço `https://…` numa imagem faz o build baixar a foto de outro
site: não faça isso (origem e autorização da foto ficam sem registro).
