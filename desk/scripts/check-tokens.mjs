// Build guard: the desk's tokens.css must match the website's css/tokens.css.
// Compares only the :root block, so the header comments can differ.
// If the website can't be reached (offline, not deployed yet) it warns and
// lets the build continue; a real difference stops the build.
import { readFileSync } from 'node:fs';

const LIVE = process.env.TOKENS_URL || 'https://concrete-surfers.com/css/tokens.css';
const rootBlock = (css) => {
  const m = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/:root\s*\{([\s\S]*?)\}/);
  return m ? m[1].replace(/\s+/g, '') : null;
};

const local = rootBlock(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8'));

let live = null;
try {
  const res = await fetch(LIVE, { signal: AbortSignal.timeout(8000) });
  if (res.ok) live = rootBlock(await res.text());
} catch { /* unreachable */ }

if (!live) {
  console.warn(`check-tokens: could not read ${LIVE}; skipping the comparison.`);
} else if (live !== local) {
  console.error(`check-tokens: desk/src/tokens.css differs from ${LIVE}.\nCopy the website file over, then build again.`);
  process.exit(1);
} else {
  console.log('check-tokens: tokens match the website.');
}
