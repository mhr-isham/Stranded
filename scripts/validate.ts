// Validation run: generates many systems, has the automatic solver play each,
// and writes a report of how well every analysis step recovers the truth.
// Usage: npm run validate -- [systemsPerDifficulty]

import { mkdirSync, writeFileSync } from 'node:fs';
import { DERIVED_KEYS, PRIMARY_KEYS, QUANTITY_INFO, deriveAll, truthValues, type QuantityKey } from '../src/engine/chain';
import { botPlay, COMPETENT, PERFECT } from '../src/engine/solver';
import { generateSystem } from '../src/engine/system';
import type { Difficulty } from '../src/engine/types';

const N = Number(process.argv[2] ?? 40);
const KEYS: QuantityKey[] = [...PRIMARY_KEYS, ...DERIVED_KEYS];
const lines: string[] = [];
const out = (s = '') => {
  lines.push(s);
  console.log(s);
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const pct = (x: number) => `${(100 * x).toFixed(3)}%`;

out('# Stranded: validation report');
out();
out(`Generated ${new Date().toISOString()} with ${N} systems per difficulty.`);
out();

// 1. Known-value injection: a noise-free solver must recover every quantity.
out('## 1. Known-value recovery (noise-free solver)');
out();
out('Max relative error of each quantity across all systems. Non-zero values come only from model');
out('approximations (e.g. measuring near, not exactly at, opposition; topocentric offsets).');
out();
const exactWorst: Record<string, number> = {};
for (let seed = 1; seed <= N; seed++) {
  const sys = generateSystem(seed);
  const run = botPlay(sys, PERFECT, seed);
  const all = { ...Object.fromEntries(Object.entries(run.primaries).map(([k, e]) => [k, e!.value])), ...Object.fromEntries(Object.entries(deriveAll(run.primaries)).map(([k, e]) => [k, e!.value])) };
  const truth = truthValues(sys, run.primaries);
  for (const k of KEYS) {
    if (k === 'tOpp') continue;
    const rel = Math.abs((all[k] as number) / truth[k] - 1);
    exactWorst[k] = Math.max(exactWorst[k] ?? 0, rel);
  }
}
out('| Quantity | Worst relative error |');
out('|---|---|');
for (const k of KEYS) if (k !== 'tOpp') out(`| ${QUANTITY_INFO[k].label} (${QUANTITY_INFO[k].symbol}) | ${pct(exactWorst[k])} |`);
out();

// 2. Competent noisy solver, per difficulty.
out('## 2. Noisy solver (competent player skill)');
out();
for (const diff of ['cadet', 'navigator', 'astronomer'] as Difficulty[]) {
  const rel: Record<string, number[]> = {};
  const z: Record<string, number[]> = {};
  const outcomes: Record<string, number> = {};
  const fuelLeft: number[] = [];
  for (let seed = 1; seed <= N; seed++) {
    const sys = generateSystem(seed, diff);
    const run = botPlay(sys, COMPETENT, seed * 101);
    const est = { ...run.primaries, ...deriveAll(run.primaries) };
    const truth = truthValues(sys, run.primaries);
    for (const k of KEYS) {
      const e = est[k];
      if (!e) continue;
      (rel[k] ??= []).push(k === 'tOpp' ? Math.abs(e.value - truth[k]) / sys.synodic : Math.abs(e.value / truth[k] - 1));
      (z[k] ??= []).push(Math.abs(e.value - truth[k]) / e.sigma);
    }
    const o = run.result?.outcome ?? 'no-plan';
    outcomes[o] = (outcomes[o] ?? 0) + 1;
    if (run.result) fuelLeft.push(run.result.fuelLeft / sys.fuelDv);
  }
  out(`### ${diff}`);
  out();
  out(`Outcomes: ${Object.entries(outcomes).map(([k, v]) => `${k} ${v}/${N}`).join(', ')}. Median fuel left: ${pct(median(fuelLeft))} of budget.`);
  out();
  out('| Quantity | Median rel. error | Within stated 1σ | Within 2σ |');
  out('|---|---|---|---|');
  for (const k of KEYS) {
    const zs = z[k] ?? [];
    out(`| ${QUANTITY_INFO[k].symbol} | ${pct(median(rel[k] ?? []))} | ${pct(zs.filter((v) => v <= 1).length / zs.length)} | ${pct(zs.filter((v) => v <= 2).length / zs.length)} |`);
  }
  out();
}

mkdirSync('reports', { recursive: true });
writeFileSync('reports/validation.md', lines.join('\n') + '\n');
console.log('\nWrote reports/validation.md');
