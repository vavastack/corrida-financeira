// Simula partidas completas do Modo Clássico com estratégias automáticas e
// mostra a pontuação final de cada uma. Serve para calibrar as faixas
// (Excelente, Muito Boa…) depois de mudar regras do motor.
// Usa as mesmas funções acionadas pelos botões do jogo (advance, confirmQuickPurchase).
// Uso: npm run simular  (ou node tools/simular-pontuacao.mjs --json saida.json)
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineUrl = pathToFileURL(path.join(root, 'src/motor/capitulo1-v27.7.html')).href;
const jsonArg = process.argv.indexOf('--json');

// buy: como escolhe e paga as compras.
//   needs    = só necessidades pendentes (a opção mais barata de cada uma)
//   all      = necessidades + todos os demais itens da vitrine que couberem
//   none     = não compra nada
//   budget   = necessidades + itens de maior benefício, só sem juros e se as parcelas couberem no mês
// pay: debit (débito se sobrar folga, senão cartão sem juros), free (cartão sem juros),
//      max (cartão no máximo de parcelas, mesmo com juros)
const STRATEGIES = [
  {id: 'otimizada', label: 'Necessidades cedo sem juros + extras que cabem no mês, reserva ativa', buy: 'budget', pay: 'free', invest: true, invoice: 'invoiceFull', course: true},
  {id: 'planejada', label: 'Planejada: necessidades no débito, reserva ativa', buy: 'needs', pay: 'debit', invest: true, invoice: 'invoiceFull', course: true},
  {id: 'sem-juros', label: 'Necessidades no cartão sem juros, reserva ativa', buy: 'needs', pay: 'free', invest: true, invoice: 'invoiceFull', course: true},
  {id: 'parcelado-max', label: 'Necessidades parceladas no máximo (com juros)', buy: 'needs', pay: 'max', invest: true, invoice: 'invoiceFull', course: true},
  {id: 'sem-reserva', label: 'Planejada, mas sem guardar dinheiro', buy: 'needs', pay: 'debit', invest: false, invoice: 'invoiceFull', course: true},
  {id: 'cauteloso', label: 'Não compra nada, só guarda', buy: 'none', pay: 'debit', invest: true, invoice: 'invoiceFull', course: false},
  {id: 'consumista', label: 'Compra tudo no cartão, paga a fatura inteira', buy: 'all', pay: 'max', invest: false, invoice: 'invoiceFull', course: false},
  {id: 'rotativo', label: 'Compra tudo no cartão, paga só o mínimo', buy: 'all', pay: 'max', invest: false, invoice: 'invoiceMinimum', course: false},
  {id: 'inadimplente', label: 'Compra necessidades no cartão e não paga a fatura', buy: 'needs', pay: 'max', invest: false, invoice: 'invoiceNoPay', course: false},
];
const SCENARIOS = [];
for (const months of [8, 12]) for (const limit of [2000, 3000, 5000]) SCENARIOS.push({months, limit});
// Partidas aleatórias: cada uma sorteia um perfil (disciplina com a fatura, gosto por compras) e decide com sorteios.
const RANDOM_GAMES = 40;

function playInPage({months, limit, strategy}) {
  const alerts = [];
  window.alert = msg => alerts.push(String(msg));
  window.confirm = () => true;
  configureScenario(null);
  configureDuration(months);
  configureFinancialProfile(limit);
  GAME_MODE = 'player';
  PARTICIPANT_COUNT = 1;
  rebuildNames();
  if (typeof appRaceMode !== 'undefined') appRaceMode = false;
  undoStack = [];
  state = {month: 0, story: null, scenario: null, stage: 'invoice', feedback: false, next: null, blackFridayDone: false, teams: [team(0)], finished: false};
  startMonth();
  render();
  const t = () => state.teams[0];
  let seed = strategy.seed || 1;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const profile = strategy.random ? {discipline: rnd(), appetite: rnd(), saver: rnd() < .6, course: rnd() < .5} : null;
  if (profile) Object.assign(strategy, {invest: profile.saver, course: profile.course});

  const planFor = (p, cash) => {
    const max = installmentMonthsFor(p);
    const free = Math.min(max, Math.max(1, Number(p.freeInstallments) || 1));
    if (isLastMonth()) return {method: 'debit'};
    if (profile) {
      const r = rnd();
      if (r < .3 && cash - debitPrice(p) >= 0) return {method: 'debit'};
      if (r < .65 && free >= 2) return {method: 'card', installments: free, entry: 0};
      if (max >= 2) return {method: 'card', installments: max, entry: 0};
      return {method: 'credit1'};
    }
    if (strategy.pay === 'debit' && cash - debitPrice(p) >= 400) return {method: 'debit'};
    if (strategy.pay === 'max' && max >= 2) return {method: 'card', installments: max, entry: 0};
    if (free >= 2) return {method: 'card', installments: free, entry: 0};
    return cash - debitPrice(p) >= 0 ? {method: 'debit'} : {method: 'credit1'};
  };
  const tryBuy = (id, bf) => {
    const p = bf ? blackFridayPromoProduct(PRODUCTS[id]) : PRODUCTS[id];
    const tm = t();
    tm.openPurchaseId = id;
    tm.purchasePlans = {[id]: planFor(p, tm.cash)};
    confirmQuickPurchase(0, id);
    return productOwned(tm, id);
  };
  const shop = bf => {
    if (strategy.buy === 'none') return;
    if (profile) {
      for (const p of quickShowcase(t(), bf)) if (productEligible(t(), p.id) && rnd() < .15 + profile.appetite * .5) tryBuy(p.id, bf);
      return;
    }
    const items = quickShowcase(t(), bf).filter(p => productEligible(t(), p.id));
    const pending = items.filter(p => { const k = productNeedKey(p.id); return k && !needSatisfied(t(), k); })
      .sort((a, b) => a.price - b.price);
    const seen = new Set();
    for (const p of pending) {
      const k = productNeedKey(p.id);
      if (seen.has(k) || needSatisfied(t(), k)) continue;
      if (tryBuy(p.id, bf)) seen.add(k);
    }
    if (strategy.buy === 'all') for (const p of items) if (productEligible(t(), p.id)) tryBuy(p.id, bf);
    if (strategy.buy === 'budget') {
      const tm = t(), room = () => tm.salary - expense(tm) - Math.round((tm.grossSalary || 2500) * .1) - 150 - installments(tm);
      for (const p of items.filter(p => productEligible(tm, p.id)).sort((a, b) => (b.monthlyBenefit || 0) / b.price - (a.monthlyBenefit || 0) / a.price)) {
        const free = Math.min(installmentMonthsFor(p), Math.max(1, Number(p.freeInstallments) || 1));
        if (!isLastMonth() && free >= 2 && p.price / free <= room()) tryBuy(p.id, bf);
      }
    }
  };

  const choose = {
    invoice: () => { if (!profile) return strategy.invoice; const r = rnd(); return r < .45 + profile.discipline * .55 ? 'invoiceFull' : r < .9 ? 'invoiceMinimum' : 'invoiceNoPay'; },
    shortfall: () => (t().investment > 0 ? 'rescue' : 'special'),
    invest: () => (strategy.invest ? 'start' : 'stop'),
    raiseInvestmentDecision: () => (strategy.invest ? 'raiseInvestKeep' : 'raiseInvestStop'),
    course: () => (strategy.course ? 'course' : 'skip'),
    coursePayment: () => 'courseCard',
    surprise: () => (t().cash >= (typeof SURPRISE_AMOUNT === 'number' ? SURPRISE_AMOUNT : 600) ? 'solveCash' : 'solveInvest'),
    finalInvestment: () => (strategy.invest ? 'finalInvestAll' : 'finalKeep'),
  };

  let steps = 0, shoppedAt = -1;
  while (state.stage !== 'finalBoard' && steps++ < 800) {
    if (!state.feedback) {
      if ((state.stage === 'buy' || state.stage === 'blackFriday') && shoppedAt !== `${state.month}${state.stage}`) {
        shoppedAt = `${state.month}${state.stage}`;
        shop(state.stage === 'blackFriday');
      }
      const pick = choose[state.stage];
      if (pick) t().choice = pick();
    }
    const before = alerts.length;
    advance();
    if (alerts.length > before && state.stage === 'surprise') {
      // Opção indisponível: tenta as demais na ordem de preferência.
      for (const c of ['solveCash', 'solveInvest', 'solveSpecial', 'unresolvedSurprise']) {
        t().choice = c; const n = alerts.length; advance(); if (alerts.length === n) break;
      }
    }
  }
  const tm = t(), b = finalBreakdown(tm);
  return {
    ok: state.stage === 'finalBoard', steps, alerts: [...new Set(alerts)].slice(0, 3),
    total: b.total, level: (typeof resultDiagnosticLabel === 'function' ? resultDiagnosticLabel(tm, b) : strategyLevel(b.total)).replace(/^\S+\s/, ''),
    parts: {produtos: Math.floor(b.useBenefit), aplicacao: b.application, metas: b.savingsGoalBonus || 0, patrimonio: b.capitalBenefit || 0,
      metaReserva: b.reserveGoalBonus || 0, curso: b.courseBenefit, necessidades: b.needsBonus, juros: -b.interestCost, divida: -b.debtPts,
      obrigacoes: -b.obligationPenalty, resgates: -b.rescuePenalty, imprevisto: -b.surprisePenalty},
    needs: `${b.needs.done}/${b.needs.total}`, interestPaid: Math.round(tm.interestPaid || 0), investment: Math.round(tm.investment || 0),
  };
}

const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(engineUrl);
  await page.waitForFunction(() => typeof advance === 'function' && typeof finalBreakdown === 'function');
  for (const sc of SCENARIOS) {
    for (const strategy of STRATEGIES) {
      const r = await page.evaluate(playInPage, {...sc, strategy});
      results.push({...sc, strategy: strategy.id, ...r});
    }
    for (let g = 1; g <= RANDOM_GAMES; g++) {
      const r = await page.evaluate(playInPage, {...sc, strategy: {id: 'aleatoria', random: true, seed: g * 7919 + sc.months * 31 + sc.limit, buy: 'random', pay: 'random', invoice: 'invoiceFull'}});
      results.push({...sc, strategy: 'aleatoria', ...r});
    }
  }
} finally {
  await browser.close();
}

for (const sc of SCENARIOS) {
  console.log(`\n## ${sc.months} meses · limite R$ ${sc.limit}`);
  console.log('estratégia'.padEnd(15), 'pts'.padStart(4), ' faixa'.padEnd(26), 'necess.', 'juros', 'reserva', ' composição');
  const random = results.filter(r => r.months === sc.months && r.limit === sc.limit && r.strategy === 'aleatoria');
  for (const r of results.filter(r => r.months === sc.months && r.limit === sc.limit && r.strategy !== 'aleatoria')) {
    const parts = Object.entries(r.parts).filter(([, v]) => v).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    console.log(r.strategy.padEnd(15), String(r.total).padStart(4), ` ${r.level}`.padEnd(26), r.needs.padEnd(7), String(r.interestPaid).padStart(5), String(r.investment).padStart(7), ` ${parts}${r.ok ? '' : ' ⚠️ não terminou'}${r.alerts.length ? ' · alertas: ' + r.alerts.join(' | ') : ''}`);
  }
}
for (const sc of SCENARIOS) {
  const random = results.filter(r => r.months === sc.months && r.limit === sc.limit && r.strategy === 'aleatoria').map(r => r.total).sort((a, b) => a - b);
  const q = f => random[Math.min(random.length - 1, Math.floor(f * random.length))];
  const levels = {};
  for (const r of results.filter(r => r.months === sc.months && r.limit === sc.limit && r.strategy === 'aleatoria')) levels[r.level] = (levels[r.level] || 0) + 1;
  console.log(`aleatórias ${sc.months}m/${sc.limit}: mín ${random[0]} · p25 ${q(.25)} · mediana ${q(.5)} · p75 ${q(.75)} · p90 ${q(.9)} · máx ${random.at(-1)} ·`, Object.entries(levels).map(([k, v]) => `${k} ${v}`).join(', '));
}
if (jsonArg > 0) fs.writeFileSync(process.argv[jsonArg + 1], JSON.stringify(results, null, 2));
