import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ARCSEC } from '../src/engine/constants';
import { angleBetween, sub, unit } from '../src/engine/vec';
import { compareParallax, measuredParallax, projectedBaseline, type ParallaxPair } from '../src/game/parallaxObservation';
import { useGame } from '../src/game/store';
import { practiceSnapshot, leaveFlightPractice } from '../src/ui/common/flightPractice';
import { schoolExerciseComplete, exerciseRange } from '../src/ui/tutorial/schoolPractice';
import { STEPS } from '../src/ui/tutorial/steps';
import { loadSlot, saveSlot } from '../src/game/checkpoints';

const pair = (): ParallaxPair => ({ id:'case:1',at:50,dirA:[1,0,0],dirB:[1,-.0001,0],radius:1e-5,baseline:4e6,projectedBaseline:3e6,seeing:1,roverDistance:4e6,marks:{A:null,B:null},viewedB:false });
beforeEach(() => {
  const data = new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});
});
afterEach(()=>vi.unstubAllGlobals());

it('uses the sideways baseline and avoids the full-baseline distance bias in an oblique geometry',()=>{
  const a:[number,number,number]=[0,0,0],b:[number,number,number]=[3e6,3e6,0],target:[number,number,number]=[1e11,0,0];
  const perp=projectedBaseline(a,b,target);
  expect(perp).toBe(3e6);
  const p=angleBetween(sub(target,a),sub(target,b));
  const result=measuredParallax({projectedBaseline:perp,marks:{A:{x:0,y:0},B:{x:Math.tan(p),y:0}}})!;
  expect(Math.abs(result.distance/1e11-1)).toBeLessThan(.0001);
  expect(Math.abs(Math.hypot(...b)/p/1e11-1)).toBeGreaterThan(.4);
});
it('handles aligned, sideways and invalid baselines without inventing a nonzero projection',()=>{
  expect(projectedBaseline([0,0,0],[3,0,0],[1,0,0])).toBe(0);
  expect(projectedBaseline([0,0,0],[0,3,0],[100,0,0])).toBe(3);
  expect(projectedBaseline([0,0,0],[0,3,0],[0,0,0])).toBe(0);
  expect(projectedBaseline([NaN,0,0],[0,3,0],[1,0,0])).toBe(0);
});
it('converts tangent-plane marks to angular separation and rejects missing/zero/nonfinite measurements',()=>{
  const p=pair();p.marks={A:{x:.001,y:.002},B:{x:.0012,y:.0021}};
  expect(measuredParallax(p)!.shift).toBeCloseTo(angleBetween([1,.001,.002],[1,.0012,.0021]),14);
  p.marks.B=p.marks.A;expect(measuredParallax(p)).toBeNull();
  p.marks.B={x:Infinity,y:0};expect(measuredParallax(p)).toBeNull();
  p.marks.B=null;expect(measuredParallax(p)).toBeNull();
});
it('compares only manually marked directions even when the rendered target points elsewhere',()=>{
  const p=pair();p.prediction={direction:'left'};p.marks={A:{x:0,y:0},B:{x:0,y:20*ARCSEC}};
  const resolved=compareParallax(p);
  expect(resolved.prediction!.comparison!.direction).toBe('down');
  expect(resolved.prediction!.comparison!.shift/ARCSEC).toBeCloseTo(20,5);
  resolved.marks.B={x:-40*ARCSEC,y:0};
  expect(compareParallax(resolved)).toBe(resolved);
  expect(resolved.prediction!.comparison!.direction).toBe('down');
});
it('keeps predictions pending without two marks and treats sub-blur directions as inconclusive',()=>{
  const p=pair();p.prediction={direction:'right'};
  expect(compareParallax(p)).toBe(p);
  p.seeing=2;p.marks={A:{x:0,y:0},B:{x:2*ARCSEC,y:0}};
  expect(compareParallax(p).prediction!.comparison!.direction).toBe('unresolved');
  p.seeing=1;expect(compareParallax(p).prediction!.comparison!.direction).toBe('right');
});
it('restores a saved expedition pair after practice and resets run observations for a new game',()=>{
  useGame.getState().newGame(316,{difficulty:'cadet',sound:false,survival:false,formulas:true});
  useGame.setState({parallaxPair:pair(),parallaxInvestigations:[]});
  const back=practiceSnapshot();
  useGame.setState({practiceReturn:back,parallaxPair:{...pair(),id:'practice'}});
  leaveFlightPractice();expect(useGame.getState().parallaxPair!.id).toBe('case:1');
  useGame.getState().newGame(91,useGame.getState().settings);
  expect(useGame.getState().parallaxPair).toBeNull();expect(useGame.getState().parallaxInvestigations).toEqual([]);
});
it('restores the photographed pair through checkpoints without changing its observed date or marks',()=>{
  useGame.getState().newGame(316,{difficulty:'cadet',sound:false,survival:false,formulas:true});
  const p=pair();p.dirB=unit(p.dirB);p.marks={A:{x:0,y:0},B:{x:.0001,y:0}};
  useGame.setState({parallaxPair:p});saveSlot(0);
  useGame.setState({parallaxPair:null});loadSlot(0);
  expect(useGame.getState().parallaxPair).toEqual(p);
});

it('does not make the optional prediction or geometry lesson a distance-exercise completion requirement',()=>{
  useGame.getState().newGame(316,{difficulty:'cadet',sound:false,survival:false,formulas:true});
  const range=exerciseRange('distance');
  useGame.setState({schoolSession:{id:'distance',...range,assisted:false,completedSteps:STEPS.slice(range.start,range.end+1).filter(s=>s.done).map(s=>s.id)},parallaxPair:null,parallaxInvestigations:[]});
  expect(schoolExerciseComplete(useGame.getState())).toBe(true);
});
