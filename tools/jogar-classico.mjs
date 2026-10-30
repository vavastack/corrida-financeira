// Joga uma partida completa do Modo Clássico pela interface, no jogo 2 (index.html) ou no
// Capítulo 1 (capitulo1.html, com --capitulo1):
// Novo jogo → Modo Clássico → configuração → compras, faturas, aplicação, curso, imprevisto → telas finais.
// Clica nos mesmos botões que o jogador usa e confere que a partida termina sem erros.
// Uso: node tools/jogar-classico.mjs [perfil] [--capitulo1] [--shots pasta]
//   perfis: planejada (padrão), apertada (paga só o mínimo em meses alternados), gastadora (gasta tudo no débito)
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const profileName = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--shots') || 'planejada';
const shotsArg = args.indexOf('--shots');
const chapter1 = args.includes('--capitulo1');
const shots = shotsArg >= 0 ? path.resolve(args[shotsArg + 1]) : null;
if (shots) fs.mkdirSync(shots, {recursive: true});

const PROFILES = {
  planejada: {invest: true, invoice: () => 'invoiceFull', extras: false, debit: false, course: 'course'},
  apertada: {invest: false, invoice: m => (m % 2 ? 'invoiceMinimum' : 'invoiceFull'), extras: true, debit: false, course: 'skip'},
  gastadora: {invest: false, invoice: () => 'invoiceFull', extras: true, debit: true, course: 'skip'},
};
const profile = PROFILES[profileName];
if (!profile) throw Error(`Perfil desconhecido: ${profileName}`);

const browser = await chromium.launch();
const errors = [];
let result;
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 1000}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push(`alerta inesperado: ${d.message()}`); d.accept(); });
  const wait = ms => page.waitForTimeout(ms);

  let game;
  if (chapter1) {
    await page.goto(pathToFileURL(path.join(root, 'capitulo1.html')).href);
    await page.locator('button:visible', {hasText: 'Novo jogo'}).click(); await wait(600);
    await page.locator('button:visible', {hasText: 'Modo Clássico'}).click(); await wait(900);
    for (const choice of ['Individual', '8 meses', 'Intermediário']) {
      await page.locator('button:visible').filter({hasText: choice}).first().click(); await wait(300);
    }
    await page.locator('#runStart').click(); await wait(1500);
    game = page.mainFrame();
    // Telas de objetivos/abertura antes da primeira vitrine.
    for (let i = 0; i < 5 && !await game.evaluate(() => state.teams.length > 0 && !!document.getElementById('advanceBtn')?.offsetParent); i++) {
      const next = page.locator('button:visible').filter({hasText: /Começar|Avançar|Continuar|Iniciar/});
      if (!await next.count()) break;
      await next.last().click(); await wait(900);
    }
  } else {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => !!document.getElementById('b-engine').contentWindow?.cf2);
    await page.locator('button:visible', {hasText: 'Novo jogo'}).first().click(); await wait(800);
    await page.locator('dialog[open] button', {hasText: 'Modo Clássico'}).click(); await wait(2000);
    await page.locator('button:visible', {hasText: 'Configurar partida'}).click(); await wait(900);
    for (const choice of ['Equilibrado', '8 meses', 'Individual', '1 participante', 'R$ 3.000']) {
      await page.locator('label:visible').filter({hasText: choice}).first().click(); await wait(800);
    }
    await page.locator('button:visible', {hasText: 'Avançar'}).last().click(); await wait(900);
    await page.locator('button:visible', {hasText: 'Começar corrida'}).click(); await wait(2500);
    game = page.frame({name: 'b-fast'});
  }
  const status = () => game.evaluate(() => {
    const t = state.teams[0];
    return {stage: state.stage, feedback: state.feedback, month: state.month, cash: Math.round(t.cash), reserve: Math.round(t.investment), debt: Math.round(totalBankDebt(t)), live: liveScore(t)};
  });
  // Janelas de revisão de compra e de fechamento de bloco: confirma ou continua.
  const closeDialogs = async () => {
    for (let i = 0; i < 4; i++) {
      const dialog = game.locator('dialog[open]');
      if (!await dialog.count()) return;
      const button = dialog.first().locator('button:visible', {hasText: /Confirmar|Continuar|Seguir|Fechar|OK|Entendi|Avançar/});
      if (await button.count()) await button.last().click(); else await page.keyboard.press('Escape');
      await wait(500);
    }
  };
  const advance = async () => { await closeDialogs(); await game.locator('#advanceBtn').click(); await wait(500); await closeDialogs(); };
  const pick = async choice => {
    await closeDialogs();
    const option = game.locator(`button.option[data-choice="${choice}"]:visible`);
    if (!await option.count()) return false;
    await option.first().click(); await wait(250);
    return true;
  };
  const options = () => game.evaluate(() => [...document.querySelectorAll('button.option')].filter(e => e.offsetParent).map(e => e.dataset.choice));
  const buy = async name => {
    await closeDialogs();
    const card = game.locator('button:visible').filter({hasText: name}).first();
    if (!await card.count()) return false;
    await card.click(); await wait(300);
    const method = game.locator('select:visible').first();
    const methods = await method.evaluate(s => [...s.options].map(o => o.textContent));
    const lastMonth = await game.evaluate(() => isLastMonth());
    if (!lastMonth && !profile.debit && methods.includes('Crédito parcelado')) {
      await method.selectOption({label: 'Crédito parcelado'}); await wait(300);
      const plans = game.locator('select:visible').last();
      const labels = await plans.evaluate(s => [...s.options].map(o => o.textContent));
      await plans.selectOption({label: labels.filter(x => x.includes('sem juros')).pop() || labels.at(-1)});
    } else {
      await method.selectOption({index: 1});
    }
    await wait(250);
    await game.locator('button:visible', {hasText: 'Revisar compra'}).click(); await wait(300);
    const confirm = game.locator('button:visible', {hasText: 'Confirmar compra'});
    if (await confirm.count()) { await confirm.click(); await wait(500); }
    const refused = await game.evaluate(() => state.teams[0].quickPurchaseError || '');
    if (refused) {
      const cancel = game.locator('button:visible', {hasText: 'Cancelar'});
      if (await cancel.count()) await cancel.first().click();
    }
    return !refused;
  };

  const seenStages = new Set(), surpriseOptions = [];
  let shoppedAt = '', steps = 0;
  while (steps++ < 300) {
    const s = await status();
    seenStages.add(s.stage);
    if (['finalBoard', 'finalDetails', 'strategyFeedback', 'finalRecommendations'].includes(s.stage)) {
      if (shots) await page.screenshot({path: path.join(shots, `${profileName}-${s.stage}.png`), fullPage: true});
      if (s.stage === 'finalRecommendations') break;
      await advance(); continue;
    }
    if (s.feedback) { await advance(); continue; }
    if (s.stage === 'buy' && shoppedAt !== `m${s.month}`) {
      shoppedAt = `m${s.month}`;
      const showcase = await game.evaluate(() => {
        const t = state.teams[0];
        return quickShowcase(t).filter(x => productEligible(t, x.id)).map(x => {
          const need = productNeedKey(x.id);
          return {name: x.name, need, pending: !!need && !needSatisfied(t, need), price: x.price};
        });
      });
      const bought = new Set();
      for (const item of showcase.filter(x => x.pending).sort((a, b) => a.price - b.price)) {
        if (!bought.has(item.need) && await buy(item.name)) bought.add(item.need);
      }
      if (profile.extras) for (const item of showcase.filter(x => !x.need)) await buy(item.name);
      const after = await status();
      console.log(`mês ${s.month + 1}: conta ${after.cash} · reserva ${after.reserve} · dívidas ${after.debt} · placar ${after.live}`);
      await advance(); continue;
    }
    if (s.stage === 'invoice') await pick(profile.invoice(s.month));
    else if (s.stage === 'invest') profile.invest ? (await pick('start') || await pick('keep')) : (await pick('stop') || await pick('keep'));
    else if (s.stage === 'course') await pick(profile.course);
    else if (s.stage === 'coursePayment') await pick('courseDebit') || await pick('courseCard');
    else if (s.stage === 'surprise') { surpriseOptions.push(...await options()); await pick('solveCash') || await pick('solveInvest') || await pick('unresolvedSurprise'); }
    else if (s.stage === 'shortfall') await pick('rescue') || await pick('special');
    else if (s.stage === 'raiseInvestmentDecision') await pick(profile.invest ? 'raiseInvestKeep' : 'raiseInvestStop');
    await advance();
  }
  result = await game.evaluate(() => {
    const t = state.teams[0], b = finalBreakdown(t);
    return {stage: state.stage, total: b.total, label: resultDiagnosticLabel(t, b), needs: `${b.needs.done}/${b.needs.total}`,
      reserve: b.application, goals: b.savingsGoalBonus, capital: b.capitalBenefit, interest: -b.interestCost, surprise: -b.surprisePenalty};
  });
  result.finalInvestmentStage = seenStages.has('finalInvestment');
  result.surpriseWithCredit = surpriseOptions.includes('solveSpecial');
} finally {
  await browser.close();
}

console.log(`\n${chapter1 ? 'Capítulo 1 · ' : ''}${profileName}: ${result.total} pts · ${result.label} · necessidades ${result.needs}`);
console.log(`saldo aplicado +${result.reserve} · metas +${result.goals} · patrimônio +${result.capital} · juros ${result.interest} · imprevisto ${result.surprise}`);
const failures = [
  result.stage !== 'finalRecommendations' && 'a partida não chegou às recomendações finais',
  result.finalInvestmentStage && 'a etapa de aporte final ainda aparece',
  result.surpriseWithCredit && 'o imprevisto ainda oferece pagamento no crédito',
  errors.length && `erros no navegador: ${errors.join(' | ')}`,
].filter(Boolean);
if (failures.length) { console.error(`\n✗ ${failures.join('\n✗ ')}`); process.exit(1); }
console.log('✓ partida concluída pela interface, sem erros');
