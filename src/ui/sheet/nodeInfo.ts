// Descriptions and graded hints for every node on the progress sheet.

import type { ChainVariant, QuantityKey } from '../../engine/chain';

export const NODE_INFO: Record<QuantityKey, { what: string; formula?: string; tool?: string; toolName?: string }> = {
  g: { what: 'How strongly this planet pulls on things at its surface.', formula: 'g = 4π² L / T²', tool: 'pendulum', toolName: 'the pendulum rig' },
  R1: { what: 'The radius of the planet we crashed on.', formula: 'R = h·cos θ / (1 − cos θ) ≈ 2h/θ²', tool: 'hill', toolName: 'the hill' },
  P1: { what: 'How long our planet takes to go once around the star (our year).', formula: 'P₁ = 360° / daily drift of the star', tool: 'observatory', toolName: 'the observatory' },
  S2: { what: 'Time between two oppositions of the blue planet — how often we overtake it.', formula: 'S = t(opp 2) − t(opp 1)', tool: 'observatory', toolName: 'the tracker' },
  tOpp: { what: 'The date of an opposition: the blue planet directly opposite the star, closest to us. It fixes where the planets are.', tool: 'observatory', toolName: 'the tracker' },
  dPar: { what: 'Distance to the blue planet when you imaged it from two sites.', formula: 'd = B / p', tool: 'rover', toolName: 'the rover' },
  alpha2: { what: 'The angle the blue planet’s disk spans in the telescope.', tool: 'observatory', toolName: 'the micrometer' },
  thetaM: { what: 'How far the moon swings from the blue planet at its widest.', tool: 'observatory', toolName: 'the moon tracker' },
  Pm: { what: 'How long the moon takes to orbit the blue planet once.', tool: 'observatory', toolName: 'the moon tracker' },
  M1: { what: 'Mass of our planet. Sets the escape speed — the biggest part of the fuel bill.', formula: 'M₁ = g R₁² / G' },
  P2: { what: 'The blue planet’s year.', formula: '1/P₂ = 1/P₁ − 1/S' },
  ratio: { what: 'How much bigger the blue planet’s orbit is than ours. Kepler’s third law — no masses needed.', formula: 'a₂/a₁ = (P₂/P₁)^(2/3)' },
  a1: { what: 'Radius of our orbit around the star — the absolute distance scale of the whole system.', formula: 'a₁ = d / √(1 + r² − 2r cos ψ),  ψ = 360°(t − t₀)/S' },
  a2: { what: 'Radius of the blue planet’s orbit.', formula: 'a₂ = (a₂/a₁) · a₁' },
  Mstar: { what: 'Mass of the star. It sets every orbital speed in the system.', formula: 'M★ = 4π² a₁³ / (G P₁²)' },
  R2: { what: 'Radius of the blue planet: where we will park our orbit.', formula: 'R₂ = d(t) · tan(α₂/2)' },
  aM: { what: 'Radius of the moon’s orbit around the blue planet.', formula: 'aₘ = d(t) · tan θₘ' },
  M2: { what: 'Mass of the blue planet. Sets how hard we must brake to stay in orbit.', formula: 'M₂ = 4π² aₘ³ / (G Pₘ²)' },
  vInf: { what: 'The probe’s speed relative to the blue planet while still far away, before it starts to fall in.', tool: 'probe', toolName: 'the probe tracker' },
  vPeak: { what: 'The probe’s speed at closest approach — the fastest it goes, having fallen into the planet’s gravity.', tool: 'probe', toolName: 'the probe tracker' },
  rPeri: { what: 'How close the probe passed: its distance from the planet’s centre at closest approach.', tool: 'probe', toolName: 'the probe tracker' },
  Porb: { what: 'How long the blue planet takes to go once round its ellipse, from fitting Kepler’s laws to its path across our sky.', tool: 'observatory', toolName: 'the orbit fit in the observatory' },
  ecc: { what: 'How stretched the blue planet’s orbit is: 0 is a circle; the closest and farthest points are a(1 − e) and a(1 + e) from the star.', tool: 'observatory', toolName: 'the orbit fit in the observatory' },
  wPeri: { what: 'Which way the orbit’s closest point (perihelion) lies, measured from the direction of the blue planet at opposition.', tool: 'observatory', toolName: 'the orbit fit in the observatory' },
};

export const HINTS: Record<QuantityKey, string[]> = {
  g: ['What swings faster when gravity is stronger?', 'Time N full swings of a pendulum of known length L; T = time/N.', 'Example: 20 swings in 56.0 s with L = 2.00 m → T = 2.80 s → g = 4π²·2.00/2.80² ≈ 10.07 m/s².'],
  R1: ['On a small ball the horizon drops away quickly. On a big one, slowly.', 'From height h, measure how far below level the horizon is (θ). Higher hills give bigger, easier angles.', 'Example: h = 1000 m, θ = 1.00° = 0.01745 rad → R ≈ 2·1000/0.01745² ≈ 6,570 km.'],
  P1: ['The star seems to move against the background stars as we orbit it.', 'Log the star’s position at dusk or dawn, wait weeks, log again. Divide 360° by the drift per day.', 'Example: 18.4° in 20 days → 0.92°/day → P₁ = 360/0.92 ≈ 391 days.'],
  S2: ['How often do we lap the blue planet?', 'Time from one opposition to the next.', 'Mark the middle of two retrograde loops in the tracker; their separation is S.'],
  tOpp: ['When is the blue planet exactly opposite the star?', 'In the middle of its backward (retrograde) loop against the stars.', 'Zoom into the loop; the midpoint between where it stops and turns back on each side is opposition.'],
  dPar: ['Hold a finger up and blink each eye. What changes?', 'Image the planet from two sites at the same instant. Its shift p against far-away stars gives d = B/p.', 'Example: B = 3000 km, p = 8.0″ = 3.88×10⁻⁵ rad → d = 3000/3.88×10⁻⁵ ≈ 77 million km.'],
  alpha2: ['How big does the disk look?', 'Zoom right in and put the micrometer wires on opposite edges.', 'Measure near opposition; repeat several times and average.'],
  thetaM: ['The moon swings back and forth. How far?', 'Log its offset for a few weeks and fit a sine wave; the amplitude is θₘ.', 'Use data around opposition, when the planet is closest and the swing looks biggest.'],
  Pm: ['How long is one full swing of the moon?', 'Fit the same sine wave; its period is Pₘ.', 'Longer runs of data pin down the period much better.'],
  M1: ['Weight depends on mass and distance from the centre.', 'g = GM/R², so M = gR²/G.', 'Enter g and R₁ — ECHO computes M₁ with the propagated error.'],
  P2: ['We lap the blue planet because our year is shorter.', '1/S = 1/P₁ − 1/P₂.', 'Rearranged: 1/P₂ = 1/P₁ − 1/S.'],
  ratio: ['Kepler: P² ∝ a³.', 'a₂/a₁ = (P₂/P₁)^(2/3).', 'Example: P₂/P₁ = 1.88 → a₂/a₁ = 1.88^(2/3) = 1.52.'],
  a1: ['You know the shape of the system, not its size. What gives an absolute distance?', 'Parallax gives the distance d between the planets at a known time; geometry turns it into a₁.', 'At opposition the planets line up: d = a₂ − a₁ = a₁(r − 1), so a₁ = d/(r − 1).'],
  a2: ['Scale the ratio by a₁.', 'a₂ = r·a₁.', '—'],
  Mstar: ['How heavy must the star be to swing us round in one year?', 'Kepler’s third law with G: M = 4π²a³/(GP²).', 'Note: a₁ enters cubed — a 1% error in distance becomes 3% in mass.'],
  R2: ['Angle × distance = size.', 'R₂ = d·tan(α/2), with d at the time you measured α.', '—'],
  aM: ['Angle × distance again.', 'aₘ = d·tan θₘ.', '—'],
  M2: ['Moons are scales for planets.', 'Kepler’s third law around the blue planet: M₂ = 4π²aₘ³/(GPₘ²).', '—'],
  vInf: ['How fast is the probe going before the planet pulls on it?', 'Read the flat part of the Doppler curve, far from closest approach.', 'Average the speed over the first and last hours of the chart.'],
  vPeak: ['Things speed up as they fall.', 'Read the top of the Doppler curve — the moment of closest approach.', 'Zoom into the peak; its height is vₚ.'],
  rPeri: ['How close did it pass?', 'The probe’s radar altimeter reports its height above the cloud tops at closest approach; add the planet’s radius.', 'rₚ = R₂ + altitude.'],
  Porb: ['The planet repeats its path once per orbit.', 'Log the blue planet’s position on as many nights as you can, over most of an orbit.', 'Then run the orbit fit in the observatory and send P₂ to the sheet.'],
  ecc: ['An oval orbit makes the planet speed up near the star and slow down far from it.', 'The orbit fit finds the ellipse that matches every night’s position.', 'More nights, spread over more of the orbit, give a tighter e.'],
  wPeri: ['Where on its orbit is the planet closest to the star?', 'The orbit fit draws the ellipse; its closest point is the perihelion.', 'Send ϖ from the orbit fit.'],
};

/** Node text for a chain variant: an inner planet has transits; chapter 2 weighs the planet with a probe. */
export function nodeInfoFor(k: QuantityKey, variant: ChainVariant = 'standard') {
  if (variant === 'inner') {
    if (k === 'S2') return { ...NODE_INFO.S2, what: 'Time between two transits of the blue planet across the star — how often it laps us.', formula: 'S = t(transit 2) − t(transit 1)', toolName: 'the transit timer' };
    if (k === 'tOpp') return { ...NODE_INFO.tOpp, what: 'The moment of a transit: the blue planet passes between us and the star, exactly in line. It fixes where the planets are.', toolName: 'the transit timer' };
    if (k === 'P2') return { ...NODE_INFO.P2, what: 'The blue planet’s year — shorter than ours, it orbits inside us.', formula: '1/P₂ = 1/P₁ + 1/S' };
  }
  if (variant === 'probe' && k === 'M2') return { ...NODE_INFO.M2, formula: 'M₂ = rₚ (vₚ² − v∞²) / (2G)' };
  return NODE_INFO[k];
}

export function hintsFor(k: QuantityKey, variant: ChainVariant = 'standard') {
  if (variant === 'inner') {
    if (k === 'S2') return ['How often does the blue planet lap us?', 'Time from one transit to the next.', 'Log the middle of two transits in the transit timer; their separation is S.'];
    if (k === 'tOpp') return ['When is the blue planet exactly between us and the star?', 'During a transit you see it as a black dot crossing the star’s disk.', 'Log the time the dot is midway across.'];
    if (k === 'P2') return ['It laps us, so its year is shorter.', '1/S = 1/P₂ − 1/P₁.', 'Rearranged: 1/P₂ = 1/P₁ + 1/S.'];
  }
  if (variant === 'probe' && k === 'M2') return ['Falling things speed up — more for heavier planets.', 'Energy: ½vₚ² − GM/rₚ = ½v∞².', 'Rearranged: M₂ = rₚ(vₚ² − v∞²)/(2G).'];
  return HINTS[k];
}
