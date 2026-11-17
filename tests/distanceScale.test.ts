import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deriveAll, keysFor, truthValues, type Primaries } from '../src/engine/chain';
import { variantOf } from '../src/engine/chapters';
import { DAY } from '../src/engine/constants';
import { nominalFlyby } from '../src/engine/probe';
import { generateSystem } from '../src/engine/system';
import { modelFromPrimaries, targetState } from '../src/engine/planner';
import { distanceGeometry, distanceReference, distanceTeachingObservation, observationDay, selectedDistanceReading } from '../src/game/distanceScale';
import { sendFromReadings } from '../src/game/tutorial';
import { useGame, type Reading } from '../src/game/store';
import { norm } from '../src/engine/vec';

beforeEach(()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});
});
afterEach(()=>vi.unstubAllGlobals());

it('recovers the same circular scale from changing dated separations, including inner targets',()=>{
  for(const inner of [false,true]){
    const base=distanceTeachingObservation(0,inner)!;
    const later=distanceTeachingObservation(base.synodicDays/4,inner)!;
    expect(later.p.dPar!.value/base.p.dPar!.value).toBeGreaterThan(2);
    expect(base.geometry.a2/1e9).toBeCloseTo(inner?60:160,8);
    expect(later.geometry.a2).toBeCloseTo(base.geometry.a2,3);
    const undated={...later.p,dPar:{...later.p.dPar!,at:undefined}};
    expect(Math.abs(deriveAll(undated,later.variant).a2!.value/base.geometry.a2-1)).toBeGreaterThan(1);
    expect(distanceReference(undated,later.variant)).toEqual({at:0,recorded:false});
  }
});
it('does not mistake a deliberately rough inferred scale for a changed physical teaching orbit',()=>{
  const base=distanceTeachingObservation(0)!,rough=distanceTeachingObservation(base.synodicDays/8,false,3)!;
  expect(rough.geometry.a2/base.geometry.a2).toBeCloseTo(1.03,10);
  expect(rough.actualSeparation).toBeLessThan(rough.p.dPar!.value);
  expect(distanceTeachingObservation(Infinity)).toBeNull();
});
it('selects a kept distance and preserves its date instead of averaging different epochs',()=>{
  const readings:Reading[]=[{id:'a',key:'dPar',kept:true,value:60e9,at:0,note:'A'},{id:'b',key:'dPar',kept:true,value:180e9,at:100*DAY,note:'B'},{id:'c',key:'g',kept:true,value:10,at:50,note:'g'}];
  expect(selectedDistanceReading(readings)!.id).toBe('b');
  expect(selectedDistanceReading(readings,'a')!.at).toBe(0);
  useGame.getState().newGame(316,{difficulty:'cadet',sound:false,survival:false,formulas:true});
  useGame.setState({readings});sendFromReadings('dPar',.02);
  expect(useGame.getState().sheet.dPar).toEqual({value:180e9,sigma:3.6e9,at:100*DAY});
  expect(selectedDistanceReading(readings.map(r=>({...r,kept:false})))).toBeUndefined();
});
it('labels absent dates honestly and uses the appropriate explicitly identified fallback',()=>{
  expect(observationDay(0)).toBe('day 0.0000');expect(observationDay()).toBe('date not recorded');
  expect(distanceReference({tOpp:{value:50,sigma:0},tOppG:{value:123,sigma:0}},'slingshot')).toEqual({at:123,recorded:false});
  expect(distanceGeometry({})).toBeNull();
  const base=distanceTeachingObservation(0)!;
  expect(distanceGeometry({...base.p,P1:{value:-1,sigma:0}})).toBeNull();
});
it('uses dated geometry off opposition for generated circular, inner, elliptical and giant scenarios',()=>{
  for(const chapter of [1,2,4,5,6,7,9]){
    const sys=generateSystem(17,'navigator',chapter),variant=variantOf(sys.features);
    for(const fraction of [.13,.27]){
      const t=sys.firstOpposition+fraction*sys.home.period;
      const dateKeys=['dPar','alpha2','thetaM','thetaMg'];
      const dates=Object.fromEntries(dateKeys.map((k,i)=>[k,{value:1,sigma:0,at:t+i*.07*sys.home.period}])) as Primaries;
      const fb=nominalFlyby(sys);
      const truth=truthValues(sys,dates,{vInf:fb.vInf,vPeak:fb.vPeak,rPeri:fb.rPeri});
      const p=Object.fromEntries(keysFor(variant).map(k=>[k,{value:truth[k],sigma:0,...(dates[k]?{at:dates[k]!.at}:{})}])) as Primaries;
      const d=deriveAll(p,variant);
      for(const key of ['a1','a2','Mstar','R2','M2'] as const){expect(d[key],`ch${chapter} ${key}`).toBeDefined();expect(Math.abs(d[key]!.value/truth[key]-1),`ch${chapter} ${key}`).toBeLessThan(.005);}
      const g=distanceGeometry(p,variant)!;expect(g).not.toBeNull();
      expect(Math.abs(g.separation/p.dPar!.value-1),`ch${chapter} dated separation`).toBeLessThan(.005);
      const model=modelFromPrimaries(p,variant)!;expect(model).not.toBeNull();
      const before=JSON.stringify(p);
      expect(Math.abs(model.a2/sys.target.a-1)).toBeLessThan(.005);
      const [position]=targetState(model,t+50*DAY);expect(norm(position)).toBeGreaterThan(0);
      expect(JSON.stringify(p)).toBe(before);
    }
  }
});
