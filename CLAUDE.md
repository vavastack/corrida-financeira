# Instruções para agentes

- `index.html` é gerado: edite `src/` e rode `npm run build`. Nunca edite `index.html` diretamente.
- Antes de cada commit: `npm run build && npm run check && npm run smoke`.
- O script da página (`src/app/*.js`) é um único escopo (IIFE) concatenado em ordem. Camadas posteriores substituem funções das anteriores; confira a última redefinição antes de mudar comportamento.
- Regras financeiras ficam no motor (`src/motor/capitulo1-v27.7.html`). A aventura só conversa com ele pela ponte `src/motor/ponte-cf2.js`. Não duplique regras na aventura.
- Os saves (`cf2-adventure-saves-v1`, `cf2-runner-save-v1` e as chaves do motor) precisam continuar compatíveis com partidas já salvas.
- Textos do jogo e documentação em português do Brasil.
