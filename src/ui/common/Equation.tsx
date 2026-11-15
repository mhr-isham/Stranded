import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { EQUATIONS, equationKey } from '../../game/equations';

/** Authored TeX only; MathML supplies a semantic alternative to the visual formula. */
export function Equation({ tex, text }: { tex?: string; text?: string }) {
  const source = tex ?? EQUATIONS[equationKey(text ?? '')];
  const lines = useMemo(
    () =>
      source?.split(/\\\\/).map((line) =>
        katex.renderToString(line.trim(), {
          displayMode: true,
          output: 'htmlAndMathml',
          throwOnError: false,
          trust: false,
        }),
      ),
    [source],
  );
  return (
    <div className="equation">
      {lines ? (
        lines.map((html, i) => <div className="equation-line" key={i} dangerouslySetInnerHTML={{ __html: html }} />)
      ) : (
        <span>{text}</span>
      )}
    </div>
  );
}
