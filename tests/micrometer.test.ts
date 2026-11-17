import { expect, it, vi } from 'vitest';
import { useGame } from '../src/game/store';
import { clock } from '../src/game/clock';
import { doMicrometer } from '../src/game/tutorial';
import { ARCSEC, DAY } from '../src/engine/constants';
import { distanceGeometry, distanceTeachingObservation } from '../src/game/distanceScale';
import { interpretAngularSize, nudgeWire, pickWire, radiusFromAngle, wireDiameter } from '../src/game/micrometer';

it('measures the angle between tangent-plane wires without depending on their order',()=>{
  expect(wireDiameter(Math.tan(-.001),Math.tan(.002))).toBeCloseTo(.003,14);
  expect(wireDiameter(.002,-.001)).toBe(wireDiameter(-.001,.002));
  expect(wireDiameter(1,1)).toBe(0);expect(wireDiameter(NaN,0)).toBeNull();
});
it('nudges by an angular increment and clamps at the visible field',()=>{
  const p=Math.tan(5*ARCSEC);
  expect(Math.atan(nudgeWire(p,.1,60*ARCSEC))/ARCSEC).toBeCloseTo(5.1,10);
  expect(Math.atan(nudgeWire(p,100,60*ARCSEC))/ARCSEC).toBeCloseTo(30,10);
  expect(nudgeWire(p,1,0)).toBe(p);
});
it('uses the nearest wire, scales the hit area for high DPI and resolves ties by selection',()=>{
  expect(pickWire(140,100,180,2,'A')).toBe('A');
  expect(pickWire(140,100,180,1,'A')).toBe('pan');
  expect(pickWire(128,100,130,2,'A')).toBe('B');
  expect(pickWire(120,100,140,2,'B')).toBe('B');
  expect(pickWire(120,100,140,2,'A')).toBe('A');
  expect(pickWire(NaN,100,140,2,'A')).toBe('pan');
});
it('doubles physical radius at the same apparent diameter when distance doubles',()=>{
  const a=radiusFromAngle(80e9,2e9,30*ARCSEC,.5*ARCSEC)!;
  const b=radiusFromAngle(160e9,2e9,30*ARCSEC,.5*ARCSEC)!;
  expect(b.radius/a.radius).toBeCloseTo(2,12);
  expect(a.sigma).toBeCloseTo(Math.hypot(a.sigmaModel,a.sigmaAngle),10);
  expect(b.sigmaAngle/a.sigmaAngle).toBeCloseTo(2,12);
});
it('propagates distance and angular ranges with the exact first derivatives',()=>{
  const d=80e9,sd=2e9,alpha=30*ARCSEC,sa=.5*ARCSEC;
  const r=radiusFromAngle(d,sd,alpha,sa)!;
  const h=1e-9, numerical=d*(Math.tan((alpha+h)/2)-Math.tan((alpha-h)/2))/(2*h)*sa;
  expect(r.sigmaAngle).toBeCloseTo(numerical,4);
  expect(r.sigmaModel/r.radius).toBeCloseTo(sd/d,12);
  expect(radiusFromAngle(d,-1,alpha,sa)).toBeNull();
  expect(radiusFromAngle(d,sd,alpha,alpha)).toBeNull();
  expect(radiusFromAngle(Infinity,sd,alpha,sa)).toBeNull();
});
it('uses the model distance at the diameter date rather than the earlier parallax separation',()=>{
  const base=distanceTeachingObservation(0)!,at=base.synodicDays/8*DAY;
  const g=distanceGeometry(base.p,'standard',at)!,radius=6000e3;
  const alpha=2*Math.atan(radius/g.separation);
  const r=interpretAngularSize(base.p,'standard',{value:alpha,sigma:.3*ARCSEC,at})!;
  expect(r.radius).toBeCloseTo(radius,5);
  expect(r.distance/g.separation).toBeCloseTo(1,12);
  expect(r.anchorAt).toBe(0);expect(r.at).toBe(at);expect(r.assumedAnchor).toBe(false);
  expect(r.sigma).toBeCloseTo(Math.hypot(r.sigmaModel,r.sigmaAngle),3);
  expect(Math.abs(base.p.dPar!.value/r.distance-1)).toBeGreaterThan(.3);
});
it('keeps the interpretation dependent on player inputs and labels an undated anchor assumption',()=>{
  const base=distanceTeachingObservation(0)!;
  const observation={value:30*ARCSEC,sigma:.3*ARCSEC,at:0};
  const a=interpretAngularSize(base.p,'standard',observation)!;
  const p={...base.p,dPar:{...base.p.dPar!,value:base.p.dPar!.value*2,at:undefined}};
  const b=interpretAngularSize(p,'standard',observation)!;
  expect(b.radius/a.radius).toBeCloseTo(2,12);expect(b.assumedAnchor).toBe(true);
  expect(interpretAngularSize({},'standard',observation)).toBeNull();
  expect(interpretAngularSize(base.p,'standard',{...observation,at:undefined})).toBeNull();
});

it('labels ECHO-supplied practice readings and advances repeated paused sightings without inventing wire metadata',()=>{
  const data=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});
  try {
    useGame.getState().newGame(316,{difficulty:'cadet',sound:false,survival:false,formulas:true,freeRoam:true});
    useGame.setState({phase:'play',schoolSession:{id:'size',start:0,end:0,completedSteps:[],assisted:true}});
    clock.t=500;clock.paused=true;
    doMicrometer();doMicrometer();doMicrometer();
    const readings=useGame.getState().readings.filter(r=>r.key==='alpha2');
    expect(readings.map(r=>r.at)).toEqual([500,560,620]);
    expect(readings.every(r=>r.note.startsWith('ECHO')&&!r.micrometer)).toBe(true);
    expect(clock.paused).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});
