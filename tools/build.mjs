// Monta o index.html (Capítulo 2) e o capitulo1.html a partir de src/.
//   {{include:caminho}} insere o arquivo como está (recursivo).
//   {{base64:caminho}}  insere o arquivo codificado em base64 (UTF-8), para srcdoc/atob.
// Uso: node tools/build.mjs            gera index.html
//      node tools/build.mjs --check    falha se index.html não corresponde a src/
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const outFile = path.join(root, 'index.html');

const read = rel => {
  const file = path.join(srcDir, rel);
  if (!file.startsWith(srcDir + path.sep)) throw Error(`Caminho fora de src/: ${rel}`);
  return fs.readFileSync(file, 'utf8');
};

function render(text, stack = []) {
  return text
    .replace(/\{\{include:([^}]+)\}\}/g, (_, rel) => {
      if (stack.includes(rel)) throw Error(`Inclusão circular: ${[...stack, rel].join(' → ')}`);
      return render(read(rel), [...stack, rel]);
    })
    .replace(/\{\{base64:([^}]+)\}\}/g, (_, rel) => Buffer.from(read(rel), 'utf8').toString('base64'));
}

// Capítulo 2 (jogo integrado) e Capítulo 1 (o motor sozinho, jogável como Modo Clássico).
const outputs = [
  [outFile, render(read('index.template.html'))],
  [path.join(root, 'capitulo1.html'), read('motor/capitulo1-v27.7.html')],
];

if (process.argv.includes('--check')) {
  const stale = outputs.filter(([file, html]) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '') !== html);
  if (stale.length) {
    console.error(`${stale.map(([file]) => path.basename(file)).join(', ')} desatualizado(s) em relação a src/. Rode: npm run build`);
    process.exit(1);
  }
  console.log('index.html e capitulo1.html correspondem a src/.');
} else {
  for (const [file, html] of outputs) {
    fs.writeFileSync(file, html);
    console.log(`${path.basename(file)} gerado (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB).`);
  }
}
