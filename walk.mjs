import {key,size} from './physics.mjs';
const solid=new Set(['stone','tile','glass']);
const radius=.18, height=.89;
const ground=-.5;
export const defaultBody=()=>({x:5,y:ground,z:9,yaw:0,pitch:-.20});
const bounded=(v,axis)=>Math.max(-.5+radius,Math.min(size[axis]-.5-radius,v));

function hits(world,x,z) {
  const obstacles=[];
  for(let ix=Math.floor(x-radius+.5);ix<=Math.floor(x+radius+.5);ix++)
    for(let iz=Math.floor(z-radius+.5);iz<=Math.floor(z+radius+.5);iz++)
      for(let iy=0;iy<size[1];iy++) {
        const part=world.get(key([ix,iy,iz]));
        if(solid.has(part?.type)) obstacles.push([iy-.5,iy+.5]);
      }
  return obstacles;
}
const clear=(obstacles,feet)=>obstacles.every(([bottom,top])=>feet>=top-.001||feet+height<=bottom+.001);
export function at(world,x,y,z) {
  const obstacles=hits(world,x,z);
  return y>=ground&&clear(obstacles,y)&&
    (y===ground||obstacles.some(([,top])=>Math.abs(top-y)<.001));
}
export function safeBody(world,body) {
  if(body&&at(world,body.x,body.y,body.z)&&
    body.x===bounded(body.x,0)&&body.z===bounded(body.z,2)) return body;
  for(const y of [ground,.5,1.5,2.5,3.5,4.5,5.5])
    for(let z=9;z>=0;z--) for(let x of [5,6,4,7,3,8,2,9,1,10,0,11])
      if(at(world,x,y,z)) return {...defaultBody(),x,y,z};
  return {...defaultBody(),y:5.5};
}
export function moveBody(world,body,dx,dz) {
  for(const [axis,delta] of [['x',dx],['z',dz]]) {
    if(!delta) continue;
    const x=axis==='x'?bounded(body.x+delta,0):body.x;
    const z=axis==='z'?bounded(body.z+delta,2):body.z;
    const obstacles=hits(world,x,z);
    const floor=Math.max(ground,...obstacles.map(([,top])=>top).filter(top=>top<=body.y+1.001));
    if(!clear(obstacles,floor)) continue;
    body.x=x; body.z=z; body.y=floor;
  }
}
export function bodyOccupies(body,p) {
  return Math.abs(p[0]-body.x)<.5+radius&&Math.abs(p[2]-body.z)<.5+radius&&
    p[1]+.5>body.y+.001&&p[1]-.5<body.y+height;
}
