// What makes each campaign chapter's star system different (docs/DESIGN-V2.md §7).
// The physics is the same everywhere; a chapter changes the system so that one
// method from earlier chapters no longer works and a new one is needed.

export interface SystemFeatures {
  /** The blue planet has a moon (chapter 2's doesn't). */
  moon: boolean;
  /** Terrestrial refraction coefficient near the horizon (thick air in chapter 3). */
  refraction: number;
  /** The blue planet orbits inside ours (chapter 5). */
  inner: boolean;
  /** The real Solar System: Mars to Earth (chapter 9). */
  real?: boolean;
}

/** Which version of the solve chain a system needs. */
export type ChainVariant = 'standard' | 'probe' | 'inner';

export const CHAPTER_FEATURES: Record<number, SystemFeatures> = {
  1: { moon: true, refraction: 0, inner: false },
  2: { moon: false, refraction: 0, inner: false },
  3: { moon: true, refraction: 0.55, inner: false },
  5: { moon: true, refraction: 0, inner: true },
  9: { moon: true, refraction: 0, inner: true, real: true },
};

export const featuresOf = (chapter: number): SystemFeatures => CHAPTER_FEATURES[chapter] ?? CHAPTER_FEATURES[1];

export const variantOf = (f: SystemFeatures): ChainVariant => (f.inner ? 'inner' : !f.moon ? 'probe' : 'standard');
