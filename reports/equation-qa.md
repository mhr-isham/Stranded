# Equation typography — 15 November 2026

Replaced plain-text primary formula panels with authored KaTeX equations in tools, progress-sheet nodes and the 19 lesson formula blocks. Multiple equations are separate lines; functions, fractions, radicals, powers, subscripts, units and explanatory text have their proper notation. Mathematical calculations and player-entered values are unchanged. The existing formula visibility setting is preserved in tools and the sheet.

The registry explicitly maps existing tool/sheet formula text to authored TeX; it does not guess how to parse arbitrary player input. KaTeX uses `trust: false`, bundled CSS/fonts and HTML plus semantic MathML. Long lines scroll inside their panel rather than widening the page. Other prose, labels and canvas diagram text retain their existing notation.

Validation:

- 47 tests in 15 files pass, including strict parsing of every authored equation and coverage of static tool/sheet formulas.
- Production build passes; mathematical fonts are emitted as local assets. The existing bundle-size warning remains, and KaTeX adds rendering code and font assets.
- `python scripts/check_math.py` opens real tool and sheet equations and all 24 lessons at 1440 px and 390 px viewport widths. It checks MathML, parse errors, page overflow and failed font requests. Screenshots in `/tmp/stranded-math-check` support visual inspection.
- Audio checks remain separate in `scripts/check_audio.py`; the background composition is unchanged.
