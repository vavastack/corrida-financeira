# Instruções para agentes

- `index.html` (Capítulo 2) e `capitulo1.html` (Capítulo 1) são gerados: edite `src/` e rode `npm run build`. Nunca edite os dois diretamente. O Capítulo 1 é o motor sozinho; mudanças no motor valem para os dois capítulos.
- Antes de cada commit: `npm run build && npm run check && npm run smoke`. Ao mudar o motor, rode também `npm run jogar:classico` (perfis planejada, apertada e gastadora, com e sem `--capitulo1`) e `npm run simular`.
- O script da página (`src/app/*.js`) é um único escopo (IIFE) concatenado em ordem. Camadas posteriores substituem funções das anteriores; confira a última redefinição antes de mudar comportamento.
- Regras financeiras ficam no motor (`src/motor/capitulo1-v27.7.html`). A aventura só conversa com ele pela ponte `src/motor/ponte-cf2.js`. Não duplique regras na aventura.
- Os saves (`cf2-adventure-saves-v1`, `cf2-runner-save-v1` e as chaves do motor) precisam continuar compatíveis com partidas já salvas.
- Textos do jogo e documentação em português do Brasil.
