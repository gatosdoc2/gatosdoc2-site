---
title: Elementos compartilhados
description: Cabeçalho, navegação, rodapé, página 404 e o bloco "em construção" usados em todas as páginas.
---

## Cabeçalho

Nome: Gatos do C2 (link para `/`).

Navegação (`aria-label="Principal"`, nesta ordem; página atual com `aria-current="page"`):

1. Quem somos (`/quem-somos/`) · About us
2. O que fazemos (`/frentes/`) · What we do (inclui Manejo ético, Adoção, Encontrei um gato; decision 0032)
3. Ajude (`/ajude/`) · Help us
4. Lojinha (`/loja/`, só em desenvolvimento enquanto for exemplo)
5. Notícias (`/noticias/`) · News
6. Contato (`/contato/`) · Contact

Link de salto: "Pular para o conteúdo".

## Rodapé

Gatos do C2. Grupo de extensão da Universidade de São Paulo (USP) em São Carlos, Campus 2.

E-mail: [gatosdoc2@gmail.com](mailto:gatosdoc2@gmail.com)
Instagram: [@gatosdoc2 no Instagram](https://www.instagram.com/gatosdoc2/)

Avenida José Antônio Santilli, 2000, Bela Vista São-Carlense, São Carlos (SP), 13568-250.

Apoio: Prefeitura do Campus USP São Carlos e ASA (Amigos Salvando Amigos).

Rodapé v5 (project lead, 2026-11-18): Gatos do C2. Grupo de extensão da Universidade de São Paulo. USP São Carlos · Campus 2. Fale conosco. Instagram do Gatos do C2 (@gatosdoc2). E-mail do Gatos do C2. @gatosdoc2 · gatosdoc2@gmail.com. Notícias. Voltar ao topo. Pausar animações. Se for urgente, avise o grupo.
Idioma (project lead, 2026-11-18, "mais simples"): EN English version. PT Ver em português.
WhatsApp (project lead, 2026-11-18): WhatsApp do grupo: link em breve, veja Contato
Direitos (project lead, 2026-11-18): Gatos do C2. Todos os direitos reservados.

[Acessibilidade e privacidade](/acessibilidade-e-privacidade/)

## Página 404

Título (h1): Página não encontrada

O endereço não existe ou mudou de lugar.

Caminhos (mesma lista da página inicial):

- Encontrei um gato
- Quero adotar
- Quero ajudar
- Como cuidamos da colônia

Botão: Ir para o início

Se um link do nosso site não funciona, [avise o grupo](/contato/).

## Bloco "em construção" (único padrão)

Markup: `<div class="em-construcao" role="note">`. Três linhas: o que falta, por quê (só se ajudar), onde obter agora. Sem prazo, sem "volte em breve".

Variante colônia (números):

> **Em construção.** Ainda estamos reunindo os números da colônia. Para saber mais, [fale conosco](/contato/).

Variante WhatsApp (texto, não link morto):

> Grupo de WhatsApp: o link será publicado aqui. Por enquanto, use o Instagram ou o e-mail.

Enquanto o link não existir, o texto acima aparece como parágrafo, sem botão.
