// History cards unlocked as the player re-discovers each method.

export interface CodexCard {
  id: string;
  title: string;
  year: string;
  text: string;
}

export const CODEX: CodexCard[] = [
  {
    id: 'meteorite',
    title: 'Stones from the sky',
    year: '1794 – today',
    text: 'For centuries scientists refused to believe stones could fall from the sky. In 1794 Ernst Chladni argued they came from space; a shower of stones over L’Aigle, France, in 1803 settled it. Iron meteorites are fragments of the metal cores of shattered early planetesimals — samples of how planets are built.',
  },
  {
    id: 'galileo',
    title: 'The pendulum clock',
    year: '1602 – 1673',
    text: 'Galileo noticed that a pendulum’s swing takes the same time whether it swings wide or narrow — almost. Huygens later built the first pendulum clock and showed how its period depends on length and gravity: T = 2π√(L/g). Pendulums were used to map Earth’s gravity for three centuries.',
  },
  {
    id: 'biruni',
    title: 'Al-Bīrūnī measures the Earth',
    year: 'c. 1020',
    text: 'From a mountain near Nandana in present-day Pakistan, Abū Rayḥān al-Bīrūnī measured how far the horizon dipped below level. Knowing the mountain’s height, he found Earth’s radius to within about 1% — exactly the method you just used.',
  },
  {
    id: 'twinkle',
    title: 'Why stars twinkle',
    year: 'atmospheric optics',
    text: 'Turbulent air bends starlight in random directions many times a second. A star is so far away it is effectively a single point, so its light flickers. A planet shows a tiny disk: the flickers from different parts of the disk average out, and the planet shines steadily.',
  },
  {
    id: 'copernicus',
    title: 'The moving Sun',
    year: 'antiquity – 1543',
    text: 'Ancient astronomers tracked the Sun’s slow eastward drift through the constellations of the zodiac — one full circle per year. Copernicus explained it as our own orbit seen from the inside.',
  },
  {
    id: 'retrograde',
    title: 'Retrograde loops',
    year: 'Ptolemy → Copernicus',
    text: 'Mars sometimes stops, moves backwards and then forwards again. Ptolemy needed epicycles to explain it; Copernicus saw it simply as Earth overtaking Mars on an inner track. The middle of the loop is opposition — Mars is closest and opposite the Sun.',
  },
  {
    id: 'cassini',
    title: 'Cassini & Richer, 1672',
    year: '1672',
    text: 'Giovanni Cassini in Paris and Jean Richer in Cayenne observed Mars at the same time during its opposition. The tiny shift against the stars gave the distance to Mars — and, through Kepler’s laws, the first good value for the size of the solar system.',
  },
  {
    id: 'moons',
    title: 'Weighing planets with moons',
    year: '1610 → today',
    text: 'Once Newton generalised Kepler’s third law, any moon became a scale: M = 4π²a³/(GP²). Galileo’s four moons of Jupiter were the first to weigh another world.',
  },
  {
    id: 'kepler',
    title: 'Kepler’s third law',
    year: '1619',
    text: 'After years of struggling with Tycho Brahe’s records, Kepler found that the square of a planet’s year is proportional to the cube of its orbit size. Ratios of orbits came from periods alone — but the absolute scale needed a measured distance.',
  },
  {
    id: 'hohmann',
    title: 'The Hohmann transfer',
    year: '1925',
    text: 'Walter Hohmann, a German engineer, showed that the cheapest way between two circular orbits is half an ellipse touching both. It only works when the target sits at the right angle ahead — which is why missions to Mars launch every 26 months.',
  },
];

/** Which card each mission unlocks. */
export const MISSION_CODEX: Record<string, string> = {
  gravity: 'galileo',
  radius: 'biruni',
  identify: 'twinkle',
  year: 'copernicus',
  opposition: 'retrograde',
  parallax: 'cassini',
  moon: 'moons',
  synodic: 'kepler',
  plan: 'hohmann',
};
