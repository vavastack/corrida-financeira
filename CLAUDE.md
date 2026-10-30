# Instruções para agentes

- `index.html` (Capítulo 2) e `capitulo1.html` (Capítulo 1) são gerados: edite `src/` e rode `npm run build`. Nunca edite os dois diretamente.
- Os capítulos são independentes. Capítulo 1: `src/capitulo1/capitulo1.html`. Capítulo 2: `src/index.template.html`, `src/app/`, `src/motor/`, `src/minijogos/`. Altere só o capítulo pedido; leve uma mudança de um capítulo para o outro somente quando o usuário pedir explicitamente.
- Antes de cada commit: `npm run build && npm run check && npm run smoke`. Ao mudar o motor do Capítulo 2, rode também `npm run jogar:classico` (perfis planejada, apertada e gastadora) e `npm run simular` (que usa esse motor). Ao mudar o Capítulo 1, rode `npm run jogar:classico -- <perfil> --capitulo1`.
- O script da página (`src/app/*.js`) é um único escopo (IIFE) concatenado em ordem. Camadas posteriores substituem funções das anteriores; confira a última redefinição antes de mudar comportamento.
- No Capítulo 2, as regras financeiras ficam no motor (`src/motor/capitulo1-v27.7.html`). A aventura só conversa com ele pela ponte `src/motor/ponte-cf2.js`. Não duplique regras na aventura.
- Os saves (`cf2-adventure-saves-v1`, `cf2-runner-save-v1` e as chaves do motor) precisam continuar compatíveis com partidas já salvas.
- Textos do jogo e documentação em português do Brasil.
