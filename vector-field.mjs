import {add,directions,electrical,plungerCoilY,windingRatio} from './physics.mjs';

const cross=([a,b,c],[x,y,z])=>[b*z-c*y,c*x-a*z,a*y-b*x];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const offset=(point,direction,distance)=>point.map((v,i)=>v+direction[i]*distance);
const minCurrent=.002;

function segment(start,end,current) {
  const delta=end.map((v,i)=>v-start[i]);
  const length=Math.hypot(...delta);
  return {start,end,current,length,axis:delta.map(v=>v/length)};
}

function coilSegments(part) {
  const vertical=part.type==='plunger';
  const axis=directions[vertical?4:part.rot];
  const center=add(part.p,[0,vertical?plungerCoilY:-.06,0]);
  const u=vertical?[1,0,0]:[0,1,0];
  const v=cross(axis,u);
  const result=[];
  const ampereTurns=part.current*windingRatio(part);
  function point(loop,angle) {
    const radius=vertical?.25:.20;
    return loop.map((n,i)=>n+radius*(u[i]*Math.cos(angle)+v[i]*Math.sin(angle)));
  }
  for(const shift of [-.17,-.055,.055,.17]){
    const loop=offset(center,axis,shift);
    let previous=point(loop,0);
    for(let i=1;i<=16;i++){
      const next=point(loop,i*Math.PI/8);
      result.push(segment(previous,next,ampereTurns));
      previous=next;
    }
  }
  return result;
}

export function fieldSources(runs,branches,magnets) {
  const segments=runs.map(({start,end,current})=>segment(start,end,current));
  for(const {part,da,db,leg} of branches){
    if(!electrical.has(part.type)) continue;
    const current=leg===undefined?part.current:part.legCurrents?.[leg];
    if(Math.abs(current??0)<minCurrent) continue;
    const center=add(part.p,[0,-.28,0]);
    // Approximate the current path through the body between its two contacts.
    segments.push(segment(offset(center,directions[da??part.rot],.5),offset(center,directions[db??(part.rot+2)%4],.5),current));
    if(part.type==='coil'||part.type==='plunger') segments.push(...coilSegments(part));
  }
  return {segments,magnets};
}

// Finite straight segments (Biot–Savart), with regularization at the conductor axis.
export function resultantAt(point,{segments,magnets}) {
  const result=[0,0,0];
  for(const {start,current,length,axis:[ax,ay,az]} of segments){
    const x=point[0]-start[0], y=point[1]-start[1], z=point[2]-start[2];
    const axial=ax*x+ay*y+az*z;
    const dx=x-ax*axial, dy=y-ay*axial, dz=z-az*axial;
    const distanceSquared=dx*dx+dy*dy+dz*dz+.018;
    const end=axial-length;
    const factor=current*(axial/Math.sqrt(distanceSquared+axial*axial)-
      end/Math.sqrt(distanceSquared+end*end))/distanceSquared;
    result[0]+=factor*(ay*z-az*y);
    result[1]+=factor*(az*x-ax*z);
    result[2]+=factor*(ax*y-ay*x);
  }
  for(const {center,axis,strength} of magnets){
    const r=[point[0]-center[0],point[1]-center[1],point[2]-center[2]];
    const radiusSquared=dot(r,r), soft=.13;
    const factor=strength/(radiusSquared+soft)**2.5;
    const along=3*dot(axis,r);
    for(let i=0;i<3;i++) result[i]+=factor*(along*r[i]+(2*soft-radiusSquared)*axis[i]);
  }
  return result;
}

function radicalInverse(index, base) {
  let fraction=1/base, result=0;
  while(index>0){
    result+=(index%base)*fraction;
    index=Math.floor(index/base);
    fraction/=base;
  }
  return result;
}

// The points fill a continuous volume independently of cell coordinates.
export function fieldSamplePoints(density, size) {
  const count=density*Math.max(3,Math.ceil(density*.45))*Math.max(3,Math.round(density*.83));
  return Array.from({length:count},(_,i)=>[
    -1+radicalInverse(i+1,2)*(size[0]+1),
    -.35+radicalInverse(i+1,3)*4.9,
    -1+radicalInverse(i+1,5)*(size[2]+1)
  ]);
}
