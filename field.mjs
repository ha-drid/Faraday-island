import {add,directions,key,opposite,terminals} from './physics.mjs';
const threshold=0.002;

// Electrical wires share node potentials. Recover their local current by
// distributing branch injections over the wire network with equal segment weights.
export function makeWireNetwork(world) {
  const nodes=[...world.values()].filter(p=>p.type==='wire');
  const index=new Map(nodes.map((p,i)=>[key(p.p),i]));
  const edges=[], contacts=[];
  for(const [i,{p}] of nodes.entries()) for(const dir of terminals(nodes[i])) {
    const q=add(p,directions[dir]);
    const neighbor=world.get(key(q));
    if(!neighbor||!terminals(neighbor).includes(opposite[dir])) continue;
    const j=index.get(key(q));
    if(j!==undefined){
      if(i<j) edges.push({i,j,p,q,dir});
    } else contacts.push({i,p,q:p.map((v,a)=>v+directions[dir][a]*.5),dir,
      part:neighbor,terminal:opposite[dir],sign:neighbor.rot===opposite[dir]?1:-1});
  }
  return {nodes,index,edges,contacts};
}

export function wireFlows({nodes,edges,contacts}) {
  const n=nodes.length, rhs=new Float64Array(n), potential=new Float64Array(n);
  const current=contact=>contact.part.portCurrents?.[contact.terminal]??contact.sign*(contact.part.current??0);
  for(const contact of contacts) rhs[contact.i]-=current(contact);
  const residual=rhs.slice(), delta=rhs.slice(), applied=new Float64Array(n);
  const squared=a=>a.reduce((sum,v)=>sum+v*v,0);
  let energy=squared(residual);
  const limit=Math.max(1e-18,energy*1e-18);
  for(let iteration=0;iteration<n&&energy>limit;iteration++){
    applied.fill(0);
    let weight=0;
    for(const {i,j} of edges){
      const difference=delta[i]-delta[j];
      applied[i]+=difference; applied[j]-=difference; weight+=difference*difference;
    }
    if(weight<1e-24) break;
    const rate=energy/weight;
    for(let i=0;i<n;i++){potential[i]+=rate*delta[i]; residual[i]-=rate*applied[i];}
    const nextEnergy=squared(residual);
    for(let i=0;i<n;i++) delta[i]=residual[i]+nextEnergy/energy*delta[i];
    energy=nextEnergy;
  }
  return [
    ...edges.map(edge=>({...edge,flow:potential[edge.i]-potential[edge.j]})),
    ...contacts.map(contact=>({...contact,flow:current(contact)}))
  ];
}

export function nextElectronPhase(phase, current, dt) {
  // Electrons drift against conventional current; the speed is scaled for visibility.
  const speed=2.9*current/(.65+Math.abs(current));
  return ((phase-speed*dt)%1+1)%1;
}

export function wireRuns(network) {
  const {nodes,index,edges,contacts}=network;
  const groups=new Map();
  function segment({p,q,dir},flow) {
    if(Math.abs(flow)<threshold) return;
    const axis=directions[dir].findIndex(Boolean);
    const signed=flow*directions[dir][axis];
    const other=p.filter((_,a)=>a!==axis);
    const id=[axis,...other,Math.sign(signed)].join(',');
    if(!groups.has(id)) groups.set(id,[]);
    groups.get(id).push({axis,p,q,low:Math.min(p[axis],q[axis]),high:Math.max(p[axis],q[axis]),signed});
  }
  for(const flow of wireFlows(network)) segment(flow,flow.flow);
  const degree=new Uint8Array(nodes.length);
  for(const {i,j} of edges){degree[i]++;degree[j]++;}
  for(const {i} of contacts) degree[i]++;
  const runs=[];
  for(const group of groups.values()){
    let run=null;
    for(const edge of group.sort((a,b)=>a.low-b.low)){
      const junction=edge.p.map((v,i)=>i===edge.axis?edge.low:v);
      const at=index.get(key(junction));
      if(run&&run.high===edge.low&&degree[at]===2&&Math.abs(run.signed-edge.signed)<threshold){
        run.high=edge.high;
      } else {
        run={...edge}; runs.push(run);
      }
    }
  }
  return runs.map(({axis,p,low,high,signed})=>({
    center:p.map((v,i)=>(i===axis?(low+high)/2:v)-(i===1?.28:0)),
    axis:[0,1,2].map(i=>i===axis?Math.sign(signed):0),
    start:p.map((v,i)=>(i===axis?(signed>0?low:high):v)-(i===1?.28:0)),
    end:p.map((v,i)=>(i===axis?(signed>0?high:low):v)-(i===1?.28:0)),
    current:Math.abs(signed),
  }));
}

export function wireLines({center,axis},scale=1) {
  const reference=axis[1]?[0,0,1]:[0,1,0];
  const [a,b,c]=axis,[x,y,z]=reference;
  const tangent=[b*z-c*y,c*x-a*z,a*y-b*x];
  return [.20,.36,.53].map(radius=>Array.from({length:48},(_,i)=>{
    const angle=i*Math.PI*2/48;
    return center.map((n,j)=>n+radius*scale*(reference[j]*Math.cos(angle)+tangent[j]*Math.sin(angle)));
  }));
}

export function dipoleLines(center,axis,coil,scale=1) {
  const up=axis[1]?[0,0,1]:[0,1,0];
  const side=axis[1]?[axis[1],0,0]:[-axis[2],0,axis[0]];
  const count=coil?6:8;
  return Array.from({length:count},(_,line)=>{
    const azimuth=(line+.5)*Math.PI*2/count;
    const radial=up.map((v,i)=>v*Math.cos(azimuth)+side[i]*Math.sin(azimuth));
    const radius=(coil?1.09:1.23)+(line%2)*.38;
    const endAngle=.48;
    return Array.from({length:33},(_,i)=>{
      const angle=endAngle+(Math.PI-2*endAngle)*i/32;
      const r=scale*radius*Math.sin(angle)**2;
      return center.map((v,j)=>v+r*(axis[j]*Math.cos(angle)+radial[j]*Math.sin(angle)));
    });
  });
}

// The drawing uses a finite set of sample lines. Their extent and opacity encode current magnitude.
export function currentLineStyle(current) {
  const magnitude=Math.abs(current);
  return {
    scale:Math.min(2.1,.55+.91*Math.log1p(magnitude)),
    opacity:.18+.82*magnitude/(magnitude+.65)
  };
}

export function lampBrightness(current) {
  const power=12*current*current;
  return power/(power+17);
}
