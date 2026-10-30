# Corrida Financeira 2

Jogo educativo sobre trabalho, escolhas e vida financeira. Funciona offline, em um único arquivo (`index.html`), no PC e no celular.

Tem dois modos:

- **Caminhos de Miguel**: aventura 2D pela cidade, com 8 capítulos (janeiro a dezembro), 5 missões, favores e equipamentos.
- **Modo Clássico**: a Corrida do Capítulo 1 (v27.7), com compras, cartão, parcelamento e pontuação.

Os dois usam o **mesmo motor financeiro** (v27.7). Na aventura, ele roda escondido num `iframe` e é usado pela ponte `window.cf2`. Assim as regras de cartão, rotativo e pontuação ficam num só lugar.

## Estrutura

`index.html` (Capítulo 2) e `capitulo1.html` (Capítulo 1) são **gerados**. Edite sempre os arquivos em `src/` e depois rode a montagem.

Os dois capítulos são **independentes**. O Capítulo 1 tem fonte própria (`src/capitulo1/capitulo1.html`); o Capítulo 2 embute o seu motor (`src/motor/capitulo1-v27.7.html`) para a aventura e o Modo Clássico. Hoje os dois têm as mesmas regras (motor 28.0, síntese da V33), mas uma mudança em um só é levada ao outro quando isso for pedido.

```
src/
  capitulo1/capitulo1.html  Capítulo 1 completo (independente do Capítulo 2)
  index.template.html     marcação da página, com os pontos de inclusão
  styles/NN-*.css         blocos de estilo, na ordem em que entram na página
  app/NN-*.js             script da página (um único escopo, concatenado nesta ordem)
  motor/
    capitulo1-v27.7.html  motor financeiro + interface do modo clássico
    ponte-cf2.js          API usada pela aventura (snapshot, buy, pay, next, capture, restore…)
    integracao-classico.js  API do modo clássico dentro da página (cf2Native)
  minijogos/
    corre-miguel.html     corrida avulsa "Corre, Miguel!"
    missoes.html          as 5 missões principais (comunicação via postMessage)
tools/
  build.mjs               monta index.html a partir de src/
  smoke.mjs               teste de fumaça no navegador (Playwright)
  simular-pontuacao.mjs   joga partidas completas do Modo Clássico com estratégias automáticas e aleatórias
  jogar-classico.mjs      joga uma partida do Modo Clássico pela interface do jogo 2, clicando nos botões
legacy/                   versões anteriores, só para consulta
```

Marcadores usados pela montagem:

- `{{include:caminho}}` insere o arquivo como está.
- `{{base64:caminho}}` insere o arquivo codificado em base64 (UTF-8). É assim que motor e minijogos entram nos `iframe` via `srcdoc`.

### Módulos do script (`src/app`)

| Arquivo | Conteúdo |
|---|---|
| 01-mundo-base | estado do mundo, som procedural, áreas, desenho, movimento, loja, fechamento do mês |
| 02-interface-opcoes | sprites em pixel, mapa da cidade, opções unificadas, tema e tela |
| 03-motor-ponte | carrega o motor v27.7 e a ponte `cf2` |
| 04-campanha | os 8 capítulos, relatórios e finais |
| 05-ajustes-mundo | câmera, iluminação, bairros novos, retratos e diálogos |
| 06-treino-aberturas | treino no armazém, aberturas dos modos, confirmações, descanso e portas |
| 07-plataforma | minijogo de entregas com rolagem lateral |
| 08-menu-inicial-saves | tela inicial única, saves da aventura, ajuda, glossário, créditos |
| 09-corrida-runner | "Corre, Miguel!" como terceiro modo |
| 10-jornada-missoes | jornada integrada: missões, equipamentos, relações, mapa |
| 11-revisao-controles-saves | revisão de controles, interação por toque, 5 vagas de save |
| 12-revisoes-visuais-hud | carteira, conversas, ajuda, primeiros passos, relatório final |
| 13-inicializacao | liga o motor e os botões de modo |

> As camadas mais novas reaproveitam as funções das anteriores e as substituem (por exemplo `const base=update; update=function(){base(); …}`). Ao mudar um comportamento, procure a **última** redefinição da função.

## Comandos

```bash
npm run build   # gera index.html a partir de src/
npm run check   # falha se index.html não corresponde a src/
npm run smoke   # abre o jogo no Chromium e percorre os fluxos principais
npm run simular # pontuação de cada estratégia por duração e limite; use ao mudar regras ou faixas
npm run jogar:classico -- apertada   # partida pela interface (perfis: planejada, apertada, gastadora)
npm run jogar:classico -- planejada --capitulo1   # a mesma partida no Capítulo 1
```

Não há dependências para a montagem (só Node 18+). O teste de fumaça precisa do Playwright com Chromium.

## Pontuação (motor 28.0)

As regras de pontuação seguem a síntese da V33.4J Júnior: a reserva pontua pelo saldo mantido (+1 por R$ 200 em cada fechamento) e pela meta mensal de poupança (+1), o patrimônio líquido conta no encerramento (+1 por R$ 100), os juros custam −1 por R$ 10 e o imprevisto de R$ 1.000 é pago só com conta e aplicação. O histórico completo está no cabeçalho de `src/motor/capitulo1-v27.7.html`.
