import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { readFileSync, readdirSync } from 'node:fs';
import { EQUATIONS, equationKey } from '../src/game/equations';

describe('authored mathematical notation', () => {
  it('typesets every equation and lesson line without parse errors', () => {
    const sources = [...Object.values(EQUATIONS)];
    for (const file of readdirSync('src/ui/tutorial/lessons').filter((s) => s.endsWith('.tsx'))) {
      const content = readFileSync(`src/ui/tutorial/lessons/${file}`, 'utf8');
      for (const match of content.matchAll(/tex=\{("(?:\\.|[^"\\])*")\}/g)) sources.push(JSON.parse(match[1]));
    }
    expect(sources.length).toBeGreaterThan(45);
    for (const source of sources)
      for (const line of source.split(/\\\\/)) {
        const html = katex.renderToString(line, { throwOnError: true, strict: 'error', trust: false, output: 'htmlAndMathml' });
        expect(html).toContain('<math');
        expect(html).not.toContain('katex-error');
      }
  });
  it('covers static tool and sheet formulas rather than leaving raw fractions behind', () => {
    const files = readdirSync('src/ui/tools')
      .filter((s) => s.endsWith('.tsx'))
      .map((s) => `src/ui/tools/${s}`);
    files.push('src/ui/launch/Launch.tsx');
    for (const file of files)
      for (const m of readFileSync(file, 'utf8').matchAll(/<Formula>([^<{]+)<\/Formula>/g)) {
        expect(EQUATIONS[equationKey(m[1])], m[1]).toBeDefined();
      }
    for (const m of readFileSync('src/ui/sheet/nodeInfo.ts', 'utf8').matchAll(/formula: '([^']+)'/g))
      expect(EQUATIONS[equationKey(m[1])], m[1]).toBeDefined();
  });
});
