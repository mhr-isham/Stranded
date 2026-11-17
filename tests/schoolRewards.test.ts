import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { freshSchoolRewards, discoveryCard, earnSchoolPatch, earnSchoolMilestone, backfillSchoolRewards } from '../src/game/schoolRewards';
import { useGame } from '../src/game/store';
import { recordTraining, recordSchoolMilestone } from '../src/game/training';
import { practiceSnapshot, leaveFlightPractice } from '../src/ui/common/flightPractice';
import { loadSlot, saveSlot } from '../src/game/checkpoints';
import { analyzeMoon, moonStudy } from '../src/game/moonObservations';
import { ARCSEC } from '../src/engine/constants';
import { makeShadowCapture, markedShadow, nextShadowNoon } from '../src/game/shadowObservation';
import { currentWorld } from '../src/game/sim';

beforeEach(() => {
  const data = new Map<string,string>();
  vi.stubGlobal('localStorage', { getItem: (k:string)=>data.get(k)??null, setItem: (k:string,v:string)=>data.set(k,v), removeItem: (k:string)=>data.delete(k) });
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, sound: false, formulas: true, freeRoam: true });
  useGame.setState({ phase: 'play', schoolRewards: freshSchoolRewards(), training: {}, schoolSession: { id: 'year', start: 0, end: 0, completedSteps: [], assisted: false }, starObs: [0, 1, 26].map((d) => ({ at: d * DAY, v: (20 + d) * DEG })) });
});
afterEach(() => vi.unstubAllGlobals());

it('keeps player-marked shadow provenance on a discovery card without changing their expedition', () => {
  const sys = currentWorld().system, at = nextShadowNoon(sys, 0)!;
  const frame = makeShadowCapture(sys, at, 800000, 1000, 'school')!;
  expect(frame).not.toBeNull();
  const marks = [markedShadow(frame, 'camp', frame.camp.length, .01)!, markedShadow(frame, 'rover', frame.rover.length, .02)!];
  const back = practiceSnapshot();
  useGame.setState({ practiceReturn: back, schoolSession: { id: 'shadows', start: 0, end: 0, completedSteps: [], assisted: false }, shadows: marks });
  recordTraining('exercise:shadows', 'completed');
  const card = useGame.getState().schoolRewards.cards['exercise:shadows'].latest;
  expect(card.plot).toEqual([{ x: 0, y: marks[0].length }, { x: 800, y: marks[1].length }]);
  expect(card.summary.some((r) => r.value.includes('0.02'))).toBe(true);
  leaveFlightPractice(); expect(useGame.getState().shadows).toEqual(back.state.shadows);
  expect(useGame.getState().schoolRewards.cards['exercise:shadows'].latest).toEqual(card);
});

it('archives selected moon observations and restores expedition comparison work after practice', () => {
  const obs = Array.from({ length: 81 }, (_, i) => ({ at: i * DAY / 4, v: 30 * Math.sin(2 * Math.PI * i / 4 / 3.3) * ARCSEC }));
  const track = Array.from({ length: 21 }, (_, i) => ({ at: i * DAY, v: 0 }));
  const original = moonStudy(analyzeMoon(obs, track, [0, 10]), 'A')!;
  useGame.setState({ moonStudies: [original] });
  const back = practiceSnapshot();
  const practice = moonStudy(analyzeMoon(obs, track, [4, 18]), 'A')!;
  useGame.setState({ practiceReturn: back, schoolSession: { id: 'moon', start: 0, end: 0, completedSteps: [], assisted: false }, moonStudies: [practice], moonTrack: obs });
  recordTraining('exercise:moon', 'completed');
  const card = useGame.getState().schoolRewards.cards['exercise:moon'].latest;
  expect(card.plot).toEqual(practice.plot);
  expect(card.summary.some((s) => s.value.includes('57 sightings'))).toBe(true);
  expect(card.summary.some((s) => /true|correct|certified/i.test(s.value))).toBe(false);
  leaveFlightPractice();
  expect(useGame.getState().moonStudies).toEqual([original]);
  expect(useGame.getState().schoolRewards.cards['exercise:moon'].latest).toEqual(card);
  saveSlot(0); useGame.setState({ moonStudies: [] }); loadSlot(0);
  expect(useGame.getState().moonStudies).toEqual([original]);
});

it('awards the first completion equally with help recorded, without modifying expedition resources', () => {
  const before = useGame.getState();
  recordTraining('exercise:year', 'started');
  expect(Object.keys(useGame.getState().schoolRewards.patches)).toHaveLength(0);
  recordTraining('exercise:year', 'completed', true);
  const s = useGame.getState();
  expect(s.schoolRewards.patches['exercise:year'].assisted).toBe(true);
  expect(s.schoolRewards.cards['exercise:year'].first.summary.some((p) => p.value.includes('360'))).toBe(true);
  expect(s.schoolRewards.cards['exercise:year'].first.plot).toHaveLength(3);
  expect(s.penaltyDv).toBe(before.penaltyDv); expect(s.hintsUsed).toBe(before.hintsUsed); expect(s.checksUsed).toBe(before.checksUsed);
  expect(s.achievements).toEqual(before.achievements);
});

it('keeps the first card and one latest replay, with no duplicate patch or callback reward', () => {
  recordTraining('exercise:year','completed');
  const first = useGame.getState().schoolRewards;
  recordTraining('exercise:year','completed');
  expect(useGame.getState().schoolRewards).toBe(first);
  useGame.setState({runId: useGame.getState().runId+1, seed: 99});
  recordTraining('exercise:year','completed',true);
  const now = useGame.getState().schoolRewards;
  expect(Object.keys(now.patches)).toHaveLength(1);
  expect(now.cards['exercise:year'].first.seed).toBe(316);
  expect(now.cards['exercise:year'].latest.seed).toBe(99);
  expect(now.lastAward!.id).toMatch(/^card:/);
});

it('does not archive unrelated expedition data as work from a standalone lesson', () => {
  const card = discoveryCard(useGame.getState(),'lesson:year',false);
  expect(card.kind).toBe('lesson'); expect(card.plot).toBeUndefined();
  expect(card.summary).toEqual([{label:'Practice record',value:'Interactive lesson completed'}]);
});

it('recognizes tested ideas once, independent of prediction correctness', () => {
  recordSchoolMilestone('predict-motion',true);
  const before = useGame.getState().schoolRewards;
  recordSchoolMilestone('predict-motion',false);
  expect(useGame.getState().schoolRewards).toBe(before);
  expect(before.milestones['predict-motion'].assisted).toBe(true);
  expect(earnSchoolMilestone(before,'unknown',false)).toBe(before);
});

it('preserves profile rewards through practice return, new games and checkpoints', () => {
  const back = practiceSnapshot();
  recordTraining('exercise:year','completed');
  useGame.setState({practiceReturn:back}); leaveFlightPractice();
  expect(useGame.getState().schoolRewards.patches['exercise:year']).toBeDefined();
  saveSlot(0); recordSchoolMilestone('first-observation'); loadSlot(0);
  expect(useGame.getState().schoolRewards.milestones['first-observation']).toBeDefined();
  useGame.getState().newGame(77,useGame.getState().settings);
  expect(useGame.getState().schoolRewards.patches['exercise:year']).toBeDefined();
});

it('backfills remembered completions without inventing old observations or replaying rewards', () => {
  const rewards = backfillSchoolRewards(freshSchoolRewards(), {'lesson:year':{status:'completed',updated:123},'exercise:gravity':{status:'completed',updated:456,assisted:true},'lesson:measure':{status:'started',updated:789}});
  expect(Object.keys(rewards.patches)).toHaveLength(2);
  expect(rewards.cards['exercise:gravity'].first.kind).toBe('legacy');
  expect(rewards.cards['exercise:gravity'].first.plot).toBeUndefined();
  expect(rewards.lastAward).toBeUndefined();
  expect(backfillSchoolRewards(rewards,{})).toBe(rewards);
});

it('bounds archived plot size and strips nested source objects from a saved overview', () => {
  useGame.setState({starObs: Array.from({length:1000},(_,i)=>({at:i*DAY,v:i*.01*DEG}))});
  const card = discoveryCard(useGame.getState(),'exercise:year',false);
  expect(card.plot).toHaveLength(180);
  expect(Object.keys(card.plot![0]).sort()).toEqual(['x','y']);
  const rewards = earnSchoolPatch(freshSchoolRewards(),card);
  expect(rewards.cards['exercise:year'].latest).toEqual(card);
});

it('archives a tested motion prediction with its recorded comparison rather than a truth verdict', () => {
  const s=useGame.getState();
  useGame.setState({schoolSession:{...s.schoolSession!,id:'opposition'},retroStudy:{anchorAt:DAY,anchorValue:.1,prediction:'west',result:{at:2*DAY,delta:.2,direction:'east'}},track:[{at:DAY,v:.1},{at:2*DAY,v:.1+.2*DEG}]});
  recordTraining('exercise:opposition','completed');
  const card=useGame.getState().schoolRewards.cards['exercise:opposition'].first;
  expect(card.summary).toContainEqual({label:'Committed motion prediction',value:'west from day 1.0000'});
  expect(card.summary.find(r=>r.label==='Next saved sighting')?.value).toContain('east');
  expect(card.plot).toHaveLength(2);
});

it('keeps the completed parallax investigation on its card after the camera pair is closed', () => {
  const s=useGame.getState();
  useGame.setState({schoolSession:{...s.schoolSession!,id:'distance'},parallaxPair:null,parallaxInvestigations:[{captureId:'test:1',at:123,projectedBaseline:2e6,prediction:'up',comparison:{dx:0,dy:1e-5,shift:1e-5,direction:'down'}}]});
  recordTraining('exercise:distance','completed');
  const card=useGame.getState().schoolRewards.cards['exercise:distance'].first;
  expect(card.summary).toContainEqual({label:'Committed parallax prediction',value:'up'});
  expect(card.summary.find(r=>r.label==='Compared camera marks')?.value).toContain('down');
  expect(card.summary).toContainEqual({label:'Compared sideways baseline',value:'2000.0 km'});
});

it('archives a saved micrometer interpretation as the player’s dated work without an accuracy verdict',()=>{
  const s=useGame.getState();
  useGame.setState({schoolSession:{...s.schoolSession!,id:'size'},readings:[{id:'size-review',key:'alpha2',kept:true,value:1e-4,at:123,note:'manual',micrometer:{sightingId:'s:123',wireA:-.00005,wireB:.00005,field:.001,stepArcsec:.1,realSampleMs:100,revisions:1,interpretation:{radius:6000e3,sigma:200e3,distance:120e9,sigmaModel:150e3,sigmaAngle:132e3,alpha:1e-4,sigmaAlpha:1e-6,at:123,anchorAt:0,assumedAnchor:false}}}]});
  recordTraining('exercise:size','completed');
  const card=useGame.getState().schoolRewards.cards['exercise:size'].first;
  expect(card.summary.find(r=>r.label==='Your size interpretation')?.value).toContain('6000.0');
  expect(card.summary.find(r=>r.label==='Model separation at diameter date')?.value).toContain('120.000');
  expect(card.summary.find(r=>r.label==='Uncertainty contributions')?.value).toContain('model 150.0');
});
