import data from '../data/kepler-archive.json';

export interface ArchivePoint { day: number; ppm: number }

export interface ArchiveProgress {
  marks: number[];
  tested: boolean;
  discovery: { period: number; depth: number } | null;
}

export const freshArchive = (): ArchiveProgress => ({ marks: [], tested: false, discovery: null });
export const SURVEY_END = 3.7;
export const FOLLOW_UP_HALF_WIDTH = .25;
const READING_CENTRE_WIDTH = .025;
const FLANK_IN = .11;
const FLANK_OUT = .23;
const MIN_DIP_PERCENT = .32;

export const archivePoints: ArchivePoint[] = data.map(([day, ppm]) => ({ day, ppm }));
export const surveyPoints = archivePoints.filter(point => point.day <= SURVEY_END);

function median(samples: ArchivePoint[]) {
  if (!samples.length) return NaN;
  const values = samples.map(p => p.ppm).sort((a, b) => a - b);
  const middle = values.length >> 1;
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/** Local depth relative to the neighboring continuum. A gap is not a dip. */
export function measureArchiveDip(points: ArchivePoint[], day: number) {
  if (!Number.isFinite(day)) return null;
  const core = points.filter(p => Math.abs(p.day - day) <= READING_CENTRE_WIDTH);
  const left = points.filter(p => p.day >= day - FLANK_OUT && p.day <= day - FLANK_IN);
  const right = points.filter(p => p.day >= day + FLANK_IN && p.day <= day + FLANK_OUT);
  if (core.length < 3 || left.length < 3 || right.length < 3) return null;
  const baseline = median([...left, ...right]);
  const depth = (baseline - median(core)) / (1e6 + baseline) * 100;
  return Number.isFinite(depth) ? depth : null;
}

export function archiveMarkIssue(marks: number[], day: number) {
  if (marks.length >= 2) return 'Remove a mark before placing another.';
  if (marks.length && day - marks[0] < .35) return 'Mark the next dip to the right of your first mark.';
  const depth = measureArchiveDip(surveyPoints, day);
  if (depth === null) return 'There aren’t enough readings on both sides here. Try a dip surrounded by readings.';
  if (depth < MIN_DIP_PERCENT) return 'This mark misses the deepest part of a dip. Zoom in or move the cursor a little.';
  return null;
}

export function archivePrediction(marks: number[]) {
  if (marks.length !== 2 || archiveMarkIssue([], marks[0]) || archiveMarkIssue([marks[0]], marks[1])) return null;
  const [first, second] = marks;
  const period = second - first;
  const day = second + period;
  if (day - FOLLOW_UP_HALF_WIDTH <= SURVEY_END || day + FOLLOW_UP_HALF_WIDTH > archivePoints.at(-1)!.day) return null;
  const depth = (measureArchiveDip(surveyPoints, first)! + measureArchiveDip(surveyPoints, second)!) / 2;
  return { period, depth, day };
}

export function archiveFollowUp(day: number) {
  const points = archivePoints.filter(p => p.day >= day - FOLLOW_UP_HALF_WIDTH && p.day <= day + FOLLOW_UP_HALF_WIDTH && p.day > SURVEY_END);
  // Test a window around the prediction against held-back photometry, without a stored ephemeris.
  const dip = points.find(p => {
    if (Math.abs(p.day - day) > .12) return false;
    const depth = measureArchiveDip(points, p.day);
    return depth !== null && depth >= MIN_DIP_PERCENT;
  });
  return { points, detected: !!dip };
}

export function archiveReading(points: ArchivePoint[], day: number) {
  let nearest: ArchivePoint | undefined;
  for (const point of points) {
    if (!nearest || Math.abs(point.day - day) < Math.abs(nearest.day - day)) nearest = point;
  }
  return nearest && Math.abs(nearest.day - day) < .006 ? nearest : null;
}
