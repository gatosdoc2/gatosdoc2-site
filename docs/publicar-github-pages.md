# Publicar no GitHub Pages

O site se publica sozinho quando alguém envia (push) para a branch `main`: o GitHub roda a verificação rápida,
gera o site e publica. Veja o andamento na aba **Actions** do repositório.

## Uma vez só (pessoa com acesso de administrador)

1. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Faça o primeiro push para `main`. O endereço aparece no fim da execução "Publicar no GitHub Pages".

## No dia a dia

- Rode `npm run check` no seu computador antes do push (precisa de `0 falhas`).
- Se a execução falhar no GitHub, abra o passo vermelho em **Actions**: a mensagem diz o arquivo e o problema.
- Para publicar de novo sem mudar nada: **Actions → Publicar no GitHub Pages → Run workflow**.

## Endereços

No GitHub Pages o site fica em `https://<conta>.github.io/<repositório>/`. Os links ganham esse prefixo no build
(`PATH_PREFIX`); escreva sempre caminhos como `/contato/` nos textos, nunca o endereço completo.
