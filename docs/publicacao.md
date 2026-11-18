# Publicação no servidor da EESC

Nenhuma IA e nenhum script conectam ao servidor: **uma pessoa** roda o envio (decisão 0018).
A senha fica só no gerenciador de senhas do responsável; nunca em arquivos, no terminal salvo ou no WinSCP/FileZilla.

## Uma vez por computador

1. Copie `upload.local.example.json` para `upload.local.json` e preencha `host`, `usuario`, `porta` e `pasta`
   com os dados que o responsável passar. Esse arquivo fica fora do git (`.gitignore`); o script recusa se ele estiver no git.
2. Se o servidor aceitar chave SSH: `ssh-keygen -t ed25519 -f ~/.ssh/gatosdoc2` (com frase-senha) e peça ao
   responsável para cadastrar a chave pública.

## A cada publicação

1. `git pull` e, se as dependências mudaram, `npm ci`.
2. `npm run check` → precisa terminar com `0 falhas`.
3. `npm run prepare-upload` → gera `upload.sftp` (um `put` por arquivo de `_site/`) e imprime o comando.
4. A pessoa roda o comando impresso:
   - com chave: `sftp -P <porta> -b upload.sftp <usuario>@<host>`;
   - com senha: `sftp -P <porta> <usuario>@<host>`, digita a senha e cola as linhas de `upload.sftp`.
   O `sftp` já vem no Windows 10/11 (PowerShell) e no Linux.
5. Arquivos que existiam no envio anterior e sumiram são listados com `rm …`: a pessoa decide e apaga à mão.
6. Peça à IA para conferir com `curl -sI` a página inicial, uma página interna e um endereço inexistente (deve dar 404).

Alternativa com janela (Windows): WinSCP, "Sincronizar", da pasta `_site/` para a pasta do servidor, sem salvar a senha.

## Ainda depende do teste do servidor (2026-11-18)

Pasta pública, se `.htaccess` funciona (página 404 própria, cabeçalhos de cache), se a chave SSH funciona e se
o `index.php` provisório da EESC precisa ser apagado. Até lá, isto é suposição; este guia será atualizado.
Teste no Windows: pendente (uma pessoa).
