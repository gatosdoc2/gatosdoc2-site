# Editar textos

## Agora (até a passagem para o grupo)

Os textos aprovados ficam em `content/` no repositório de planejamento. Para trazer as mudanças:

```
npm run sync-content            # se este repositório está em site/ dentro do de planejamento
npm run sync-content -- ../caminho/para/content
npm run check
```

O script copia `content/pages/*.md` para `src/pages/` e `content/shared.md` para `src/_includes/compartilhado.md`,
sem mudar nada. Se alguém editou um arquivo aqui depois da última sincronização, ele **para** e avisa
(`conflito`): leve a mudança para `content/` e sincronize de novo (ou `--forcar` para descartar a mudança daqui).
`npm run sync-content -- --verificar` só mostra o que mudaria.

## Depois da passagem

Edite direto `src/pages/*.md` e rode `npm run check`.

## Regras do arquivo `.md`

- No topo, entre `---`: `title:` (nome da página), `description:` (até 155 caracteres), `sources:` (códigos de fonte).
  Uma informação por linha, no formato `chave: valor`.
- Um único título `#`; seções com `##`; subtítulos com `###` (sem pular nível).
- Fonte de cada afirmação num comentário `<!-- src: CÓDIGO -->` em `content/` (fica só no repositório de planejamento).
- Informação que falta: `<!-- GAP: o que falta, quem responde -->` e o bloco "em construção":

```
<div class="em-construcao" role="note">

**Em construção.** O que falta. Onde obter agora (e-mail ou Instagram).

</div>
```

- Sem "volte em breve", sem prazo prometido, sem `!`.
- Links internos assim: `[Adoção](/adocao/)`.
- Uma página nova precisa de: arquivo em `src/pages/`, item em `src/_data/nav.json` (se for no menu) e `npm run check`.
