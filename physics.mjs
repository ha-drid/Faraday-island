export const size = [12, 6, 10];
export const directions = [[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,1,0],[0,-1,0]];
export const opposite = [2,3,0,1,5,4];
export const key = p => p.join(',');
export const inside = p => p.every((n,i) => n >= 0 && n < size[i]);
export const add = (p,d) => p.map((n,i) => n+d[i]);
export const dot = (a,b) => a.reduce((s,n,i) => s+n*b[i],0);
export const electrical = new Set(['wire','battery','switch','button','lamp','coil','plunger','resistor','ammeter','voltmeter','capacitor','generator','selector']);
export const terminals = part => part.type === 'wire' ? [0,1,2,3,4,5] :
  electrical.has(part.type) ? [part.rot,(part.rot+2)%4,
    ...(part.type==='selector'?[(part.rot+1)%4]:[])] : [];
export const defaultCapacitance=.10;
export function capacitorDimensions(capacitance){
  const ratio=capacitance/defaultCapacitance;
  return {side:.34*ratio**(1/6),gap:.105*ratio**(-2/3)};
}
export const defaultFrequency=1;

export const defaultInductance=.32;
export const defaultCoilResistance=3;
export const coilInductance=part=>part.inductance??defaultInductance;
// In this model the coil dimensions and core are fixed, so L is proportional to N squared.
export const windingRatio=part=>Math.sqrt(coilInductance(part)/defaultInductance);
export const windingCount=part=>Math.round((part.type==='plunger'?9:7)*windingRatio(part));
export const isCoil = part => part?.type==='coil'||part?.type==='plunger';
export const inductionDemo = name => name==='induction'||name==='powered';
export const partBaseTop=-.3175;
export const plungerMagnetHeight=.58;
export const plungerCoilY=-.085;
export const plungerRest=partBaseTop+plungerMagnetHeight/2-plungerCoilY;
const plungerMax=.95;
const plungerMass=.14, spring=10, damping=1.50;
const coupling=.62, bore=.42;

export function linkedFlux(s) {
  return coupling/(1+(s/bore)**2)**1.5;
}
export function linkedFluxSlope(s) {
  return -3*coupling*s/(bore*bore*(1+(s/bore)**2)**2.5);
}
export function setMagnetGrip(part, fraction) {
  part.grip=fraction===null?null:plungerRest+Math.max(0,Math.min(fraction,1))*(plungerMax-plungerRest);
}
function driftMagnet(part,dt) {
  const from=part.height??plungerRest;
  const next=from+(part.speed??0)*dt;
  part.height=Math.max(plungerRest,Math.min(plungerMax,next));
  if(part.height!==next) part.speed=0;
  return from;
}
function accelerateMagnet(part,dt) {
  const y=part.height;
  const held=part.grip!=null;
  const target=held?part.grip:plungerRest;
  const stiffness=held?76:spring;
  const drag=held?5.8:damping;
  const acceleration=(part.current*windingRatio(part)*linkedFluxSlope(y)-stiffness*(y-target))/plungerMass;
  const speed=((part.speed??0)+dt*acceleration)/(1+dt*drag/plungerMass);
  part.speed=(y===plungerRest&&speed<0)||(y===plungerMax&&speed>0)?0:speed;
}

export function preset(name,{meters=true,raisedMeter=false}={}) {
  const parts = [];
  function put(type,x,y,z,rot=0,extra={}) {
    parts.push({type,p:[x,y,z],rot,...extra});
  }
  if(name === 'empty') return parts;
  for(let x=0;x<12;x++) for(let z=0;z<10;z++) {
    if(x>1 && x<10 && z>1 && z<8) put('tile',x,0,z);
  }
  // A small open-sided instrument shelter at the back of the platform.
  for(const [x,z] of [[2,2],[9,2]]) {
    put('stone',x,1,z); put('stone',x,2,z); put('tile',x,3,z);
  }
  for(let x=3;x<9;x++) put('tile',x,3,2);
  put('glass',3,1,2); put('glass',8,1,2);
  if(name === 'magnet') {
    put('magnet',5,1,5,0); put('magnet',8,1,5,2);
    put('stone',4,1,3); put('glass',4,2,3);
    return parts;
  }
  if(inductionDemo(name)||name==='old-induction') {
    put(name==='old-induction'?'coil':'plunger',6,1,4);
    put(name==='powered'?'battery':'lamp',6,1,7,0,name==='powered'?{value:9}:{});
    for(const x of [5,7]) for(let z=4;z<=7;z++) {
      if(name==='powered'&&x===7&&z===6) put('switch',x,1,z,1,{on:false});
      else if(meters&&name!=='old-induction'&&x===5&&z===6) put('ammeter',x,1,z,1);
      else put('wire',x,1,z);
    }
    if(name==='old-induction') put('magnet',3,1,4);
    else if(meters){
      put('wire',5,1,3); put('voltmeter',6,1,3); put('wire',7,1,3);
    }
    return parts;
  }
  if((name==='oscillation'||name==='alternating')&&!raisedMeter){
    const free=name==='oscillation';
    put(free?'selector':'wire',6,1,3);
    put('capacitor',6,1,6,3);
    put(free?'battery':'generator',2,1,6,3,free?{value:6}:{value:8});
    put(free?'wire':'resistor',2,1,5,1,free?{}:{value:4});
    put('coil',10,1,6,1,{inductance:.65,resistance:.22});
    put(free?'wire':'switch',10,1,5,1,free?{}:{on:true});
    put(meters?'ammeter':'wire',10,1,7,1);
    for(const x of [2,3,4,5,7,8,9,10]) put('wire',x,1,3);
    for(const [x,z] of [[2,4],[2,7],[10,4],[6,4],[6,5],[6,7]]) put('wire',x,1,z);
    for(let z=3;z<8;z++) put('tile',10,0,z);
    for(let x=2;x<=10;x++){
      put('tile',x,0,8);
      put('wire',x,1,8);
    }
    if(meters){
      put('wire',5,1,5); put('wire',4,1,5);
      put('voltmeter',4,1,6,3); put('wire',4,1,7);
    }
    return parts;
  }
  // Retained to recognize the original starter layout in browser saves.
  if(name==='oscillation'||name==='alternating'){
    const free=name==='oscillation';
    put(free?'selector':'wire',6,1,4);
    put('capacitor',6,1,6,3);
    put(free?'battery':'generator',3,1,6,3,free?{value:6}:{value:8});
    put('coil',9,1,6,1,{inductance:.65,resistance:.22});
    put(free?'wire':'resistor',3,1,5,1,free?{}:{value:4});
    if(!free) put('switch',9,1,5,1,{on:true});
    else put('wire',9,1,5);
    put('wire',6,1,5); put('wire',6,1,7);
    put('wire',3,1,7);
    put(meters?'ammeter':'wire',9,1,7,1);
    for(const x of [3,4,5,7,8,9]) put('wire',x,1,4);
    for(let x=3;x<=9;x++){
      put('tile',x,0,8);
      put('wire',x,1,8);
    }
    // The voltmeter is in parallel with the capacitor via a separate side spur.
    if(meters){
      put('wire',6,2,5); put('wire',5,2,5); put('wire',5,2,6); put('wire',5,1,6);
      put('voltmeter',5,1,7,3);
    }
    return parts;
  }
  put('battery',4,1,4,0,{value:9}); put('switch',6,1,4,0,{on:false});
  put('lamp',6,1,7,0); put('coil',4,1,7,0);
  for(const x of [3,8]) for(let z=4;z<=7;z++){
    if(meters&&x===3&&z===5) put('ammeter',x,1,z,1);
    else put('wire',x,1,z);
  }
  if(meters){
    for(let x=5;x<=7;x++) put('tile',x,0,8);
    put('wire',5,1,8); put('voltmeter',6,1,8); put('wire',7,1,8);
  }
  for(const [x,z] of [[5,4],[7,4],[5,7],[7,7]]) put('wire',x,1,z);
  return parts;
}

// Softened dipole field, with cell lengths and a scaled field for visualization.
export function dipole(point, center, axis, strength) {
  const r=point.map((n,i)=>n-center[i]);
  const s=dot(r,r)+0.32;
  const projection=dot(axis,r);
  return r.map((n,i)=>strength*(3*n*projection-axis[i]*s)/s**2.5);
}

export function fluxAt(coil, magnets) {
  const vertical=coil.type==='plunger';
  const axis=vertical?directions[4]:directions[coil.rot];
  const transverse=axis.flatMap((value,i)=>value===0?[i]:[]);
  let flux=0;
  // Average the normal component over a small cross-section.
  for(const a of [-0.24,0.24]) for(const b of [-0.24,0.24]) {
    const sample=[...coil.p];
    sample[transverse[0]]+=a; sample[transverse[1]]+=b;
    if(vertical) sample[1]+=plungerCoilY;
    for(const {center,axis:magAxis,strength} of magnets)
      flux+=dot(axis,dipole(sample,center,magAxis,strength))*0.17;
  }
  return flux;
}

export function compile(parts) {
  const items=[...parts.values()].filter(part=>electrical.has(part.type));
  const ports=new Map();
  const parents=[];
  const branches=[];
  function find(i) {
    while(parents[i]!==i) { parents[i]=parents[parents[i]]; i=parents[i]; }
    return i;
  }
  function join(a,b) { parents[find(a)]=find(b); }
  function node() { const i=parents.length; parents.push(i); return i; }
  const portKey=(p,d)=>key(p)+'/'+d;
  for(const part of items) {
    const sides=terminals(part);
    // Three-terminal devices have two branches that share the movable contact.
    const nodes=part.type==='wire'?Array(sides.length).fill(node()):sides.map(node);
    sides.forEach((d,i)=>ports.set(portKey(part.p,d),nodes[i]));
    if(part.type==='wire') continue;
    const [a,b,common]=nodes;
    const [da,db,dc]=sides;
    if(sides.length===2) branches.push({part,a,b,da,db});
    else branches.push({part,a,b:common,da,db:dc,leg:0},
      {part,a:common,b,da:dc,db,leg:1});
  }
  for(const part of items) for(const d of terminals(part)) {
    const neighbor=ports.get(portKey(add(part.p,directions[d]),opposite[d]));
    if(neighbor!==undefined) join(ports.get(portKey(part.p,d)),neighbor);
  }
  const groups=new Map();
  for(const branch of branches) for(const k of ['a','b']) {
    const root=find(branch[k]);
    if(!groups.has(root)) groups.set(root,groups.size);
    branch[k]=groups.get(root);
  }
  // A single reference per connected component keeps floating circuits well posed.
  const circuitParents=Array.from({length:groups.size},(_,i)=>i);
  function circuitRoot(i) {
    while(circuitParents[i]!==i) i=circuitParents[i];
    return i;
  }
  for(const {a,b} of branches) circuitParents[circuitRoot(a)]=circuitRoot(b);
  const referenceByCircuit=new Map(circuitParents.map((_,i)=>[circuitRoot(i),circuitRoot(i)]));
  const poweredCircuits=new Set();
  for(const {part,b} of branches){
    if(part.type!=='battery'&&part.type!=='generator') continue;
    const root=circuitRoot(b);
    if(poweredCircuits.has(root)) continue;
    poweredCircuits.add(root);
    referenceByCircuit.set(root,b);
  }
  const references=new Set(referenceByCircuit.values());
  const wireNodes=new Map(items.filter(part=>part.type==='wire').map(part=>
    [part,groups.get(find(ports.get(portKey(part.p,0))))]));
  const unknowns=new Map();
  for(let i=0;i<groups.size;i++) if(!references.has(i)) unknowns.set(i,unknowns.size);
  return {branches,unknowns,wireNodes,contactStates:new Map(),settleSteps:2};
}

export function step(network, dt, magnets, resetFlux=false) {
  const {branches,unknowns,wireNodes,contactStates}=network;
  for(const {part,leg} of branches){
    if(leg===1||!['switch','button','selector'].includes(part.type)) continue;
    const closed=Boolean(part.on);
    if(contactStates.get(part)!==closed) network.settleSteps=2;
    contactStates.set(part,closed);
  }
  // Two implicit steps absorb switching impulses before returning to trapezoidal integration.
  const settling=network.settleSteps>0;
  if(settling&&!resetFlux) network.settleSteps--;
  const n=unknowns.size;
  const matrix=Array.from({length:n},()=>new Float64Array(n+1));
  const idx=i=>unknowns.get(i)??-1;
  const models=[];
  for(const branch of branches) {
    const {part,a,b,leg}=branch;
    let resistance=12, voltage=0;
    switch(part.type) {
      case 'battery': resistance=0.6; voltage=-(part.value??9); break;
      case 'generator': {
        resistance=.6;
        if(!resetFlux) part.phase=((part.phase??0)+2*Math.PI*(part.frequency??defaultFrequency)*dt)%(2*Math.PI);
        voltage=-(part.value??12)*Math.sin(part.phase??0);
        break;
      }
      case 'switch':
      case 'button': resistance=part.on?0.04:Infinity; break;
      case 'selector': resistance=Number(!part.on)===leg ? .02 : Infinity; break;
      case 'capacitor': {
        // Trapezoidal capacitor companion, preserving charge between steps.
        const previousVoltage=part.capVoltage??0;
        resistance=dt/((settling?1:2)*(part.capacitance??defaultCapacitance));
        voltage=-previousVoltage-(settling?0:resistance*(part.capCurrent??0));
        break;
      }
      case 'resistor': resistance=part.value??22; break;
      case 'ammeter': resistance=.02; break;
      case 'voltmeter': resistance=10_000_000; break;
      case 'coil':
      case 'plunger': {
        const flux=fluxAt(part,magnets);
        let induced=resetFlux?0:((part.flux??flux)-flux)/dt;
        if(part.type==='plunger'){
          part.height??=plungerRest;
          if(!resetFlux){
            const previousHeight=driftMagnet(part,dt);
            induced+=(linkedFlux(previousHeight)-linkedFlux(part.height))/dt;
          }
        }
        part.flux=flux;
        // Keep flux normalized to the reference winding so adjusting the slider
        // does not create an artificial EMF in a stationary magnetic field.
        induced*=windingRatio(part);
        part.emf=induced;
        // Trapezoidal integration avoids damping the LC oscillations numerically.
        const transient=(settling?1:2)*coilInductance(part)/dt;
        const windingResistance=part.resistance??defaultCoilResistance;
        resistance=windingResistance+transient;
        const previousResistance=part.lastResistance??windingResistance;
        const history=settling?0:(part.voltage??0)-previousResistance*(part.current??0)+(part.lastEmf??0);
        if(!resetFlux) part.lastResistance=windingResistance;
        voltage=transient*(part.current??0)+induced+history;
        break;
      }
    }
    const g=1/resistance;
    models.push({...branch,g,voltage});
    const x=idx(a), y=idx(b);
    if(x===y) continue;
    if(x>=0) { matrix[x][x]+=g; matrix[x][n]-=g*voltage; }
    if(y>=0) { matrix[y][y]+=g; matrix[y][n]+=g*voltage; }
    if(x>=0 && y>=0) { matrix[x][y]-=g; matrix[y][x]-=g; }
  }
  for(let col=0;col<n;col++) {
    let pivot=col;
    for(let row=col+1;row<n;row++)
      if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col])) pivot=row;
    if(Math.abs(matrix[pivot][col])<1e-11) continue;
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
    for(let row=col+1;row<n;row++) {
      const factor=matrix[row][col]/matrix[col][col];
      if(Math.abs(factor)<1e-14) continue;
      for(let j=col;j<=n;j++) matrix[row][j]-=factor*matrix[col][j];
    }
  }
  const values=new Float64Array(n);
  for(let i=n-1;i>=0;i--) {
    if(Math.abs(matrix[i][i])<1e-11) continue;
    let rhs=matrix[i][n];
    for(let j=i+1;j<n;j++) rhs-=matrix[i][j]*values[j];
    values[i]=rhs/matrix[i][i];
  }
  for(const [part,node] of wireNodes) part.voltage=values[idx(node)]??0;
  for(const {part,leg} of models) if(leg===0) {
    part.portCurrents={}; part.portVoltages={}; part.legCurrents=[];
  }
  for(const {part,a,b,da,db,leg,g,voltage} of models) {
    const va=values[idx(a)]??0, vb=values[idx(b)]??0;
    const difference=va-vb;
    const current=g*(difference+voltage);
    if(leg!==undefined){
      part.legCurrents[leg]=current;
      part.portCurrents[da]=(part.portCurrents[da]??0)+current;
      part.portCurrents[db]=(part.portCurrents[db]??0)-current;
      part.portVoltages[da]=va;
      part.portVoltages[db]=vb;
      continue;
    }
    if(resetFlux&&(isCoil(part)||part.type==='capacitor')) continue;
    part.voltage=difference;
    part.current=current;
    if(part.type==='capacitor'){
      part.capVoltage=difference;
      part.capCurrent=current;
    }
    if(isCoil(part)) part.lastEmf=part.emf;
    if(part.type==='plunger') accelerateMagnet(part,dt);
  }
}
