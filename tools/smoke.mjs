// Teste de fumaça no navegador (Playwright + Chromium).
// Percorre: abertura → motor financeiro → nova aventura → cidade → modo clássico → tela de celular.
// Uso: node tools/smoke.mjs [--shots pasta]   (salva capturas se --shots for informado)
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? path.resolve(process.argv[shotsArg + 1]) : null;
if (shots) fs.mkdirSync(shots, {recursive: true});

const failures = [];
const check = (ok, label) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures.push(label); };

async function openPage(browser, viewport) {
  const page = await browser.newPage({viewport});
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', e => page.errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => !!document.getElementById('b-engine').contentWindow?.cf2, null, {timeout: 15000});
  return page;
}
const shot = (page, name) => shots && page.screenshot({path: path.join(shots, `${name}.png`)});
const clickButton = async (page, text) => {
  await page.locator('button:visible').filter({hasText: text}).first().click();
  await page.waitForTimeout(900);
};

const browser = await chromium.launch();
try {
  // Abertura e motor
  const page = await openPage(browser, {width: 1280, height: 800});
  await shot(page, '01-inicio');
  check(await page.locator('button:visible', {hasText: 'Novo jogo'}).count() > 0, 'tela inicial mostra "Novo jogo"');
  const snap = await page.evaluate(() => document.getElementById('b-engine').contentWindow.cf2.snapshot());
  check(snap.month === 1 && snap.salary > 0 && snap.limit > 0 && snap.goods.length > 0, 'motor financeiro responde snapshot');

  // Nova aventura até a cidade
  await clickButton(page, 'Novo jogo');
  await page.locator('dialog[open] button').filter({hasText: 'Caminhos de Miguel'}).click();
  await page.waitForTimeout(1200);
  await clickButton(page, 'Escolher meu começo');
  await page.locator('label:visible').filter({hasText: 'Vida real'}).click();
  await page.waitForTimeout(1200);
  await clickButton(page, 'Entrar na cidade');
  await page.waitForTimeout(800);
  await shot(page, '02-cidade-missoes');
  check(await page.locator('dialog[open]', {hasText: 'Última entrega do dia'}).count() === 1, 'cidade abre com a missão inicial');
  await page.locator('dialog[open] button', {hasText: '×'}).click();
  await page.waitForTimeout(500);
  check(await page.locator('#b-rpg').isVisible() && await page.locator('#b-canvas').isVisible(), 'mundo 2D visível');
  check(page.errors.length === 0, `sem erros no console (aventura)${page.errors.length ? ': ' + page.errors.join(' | ') : ''}`);
  const savedCount = () => page.evaluate(() => JSON.parse(localStorage.getItem('cf2-adventure-saves-v1') || '[]').length);
  await page.waitForTimeout(1000);
  check(await savedCount() === 1, 'aventura salva ao entrar na cidade');
  // Aba em segundo plano (troca de app no celular) também grava.
  await page.evaluate(() => {
    localStorage.removeItem('cf2-adventure-saves-v1');
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  check(await savedCount() === 1, 'aventura salva quando a aba fica oculta');
  // Sair da página (pagehide) grava a aventura; ao voltar, ela aparece em "Carregar jogo".
  await page.evaluate(() => localStorage.removeItem('cf2-adventure-saves-v1'));
  await page.reload();
  await page.waitForFunction(() => !!document.getElementById('b-engine').contentWindow?.cf2);
  const saves = await page.evaluate(() => JSON.parse(localStorage.getItem('cf2-adventure-saves-v1') || '[]').length);
  check(saves === 1, 'aventura salva ao sair da página');
  await page.close();

  // Modo clássico
  const classic = await openPage(browser, {width: 1280, height: 800});
  await clickButton(classic, 'Novo jogo');
  await classic.locator('dialog[open] button').filter({hasText: 'Modo Clássico'}).click();
  await classic.waitForFunction(() => !!document.getElementById('b-fast').contentWindow?.cf2Native, null, {timeout: 15000}).catch(() => {});
  await classic.waitForTimeout(1200);
  await shot(classic, '03-classico');
  check(await classic.evaluate(() => !!document.getElementById('b-fast').contentWindow?.cf2Native), 'modo clássico carrega o motor');
  check(classic.errors.length === 0, `sem erros no console (clássico)${classic.errors.length ? ': ' + classic.errors.join(' | ') : ''}`);
  await classic.close();

  // Celular
  const phone = await openPage(browser, {width: 390, height: 844});
  await shot(phone, '04-celular');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 0, `sem rolagem horizontal no celular (excesso ${overflow}px)`);
  check(phone.errors.length === 0, 'sem erros no console (celular)');
  await phone.close();
} finally {
  await browser.close();
}

if (failures.length) { console.error(`\n${failures.length} verificação(ões) falharam.`); process.exit(1); }
console.log('\nTudo certo.');
