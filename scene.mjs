import * as T from 'three';
import {IslandCanvas} from './canvas-renderer.mjs';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {size,directions,opposite,key,inside,add,terminals,electrical,defaultCapacitance,capacitorDimensions,defaultFrequency,preset,compile,step,isCoil,defaultInductance,defaultCoilResistance,coilInductance,windingRatio,windingCount,inductionDemo,partBaseTop,plungerMagnetHeight,plungerRest,plungerCoilY,setMagnetGrip} from './physics.mjs';
import {makeWireNetwork,wireFlows,wireRuns,nextElectronPhase,wireLines,dipoleLines,currentLineStyle,lampBrightness} from './field.mjs';
import {fieldSamplePoints,fieldSources,resultantAt} from './vector-field.mjs';
import {defaultBody,at,safeBody,moveBody,bodyOccupies} from './walk.mjs';

const $=id=>document.getElementById(id);
const ui={
  inspect:['Осмотр','#c4d9e5','◉'], stone:['Камень','#a9b4c2',''],
  tile:['Плитка','#e2c7a1',''], glass:['Стекло','#8ed5d8',''],
  wire:['Провод','#e4ab6a','⌁'], battery:['Батарейка','#a5c783','＋'],
  switch:['Выключатель','#efab8f','↗'], button:['Кнопка','#efa799','●'], lamp:['Лампа','#f1d977','✦'],
  magnet:['Магнит','#ee888b','N'], coil:['Катушка','#dbaa72','≋'],
  plunger:['Катушка с магнитом','#d89f7a','↕'],
  resistor:['Резистор','#cbc3ed','Ω'],
  capacitor:['Конденсатор','#88bed6','‖'],
  generator:['Генератор','#ec9d70','∿'], selector:['Переключатель','#dfb37f',''],
  ammeter:['Амперметр','#86d6d2','A'], voltmeter:['Вольтметр','#b5b6ef','V']
};
const experiments={
  circuit:['ЦЕПЬ','Электрическая цепь','Коснись рычага, чтобы замкнуть цепь. Амперметр покажет ток в цепи, а вольтметр — напряжение на лампе.'],
  magnet:['ПОЛЕ','Постоянные магниты','Выбери магнит и поверни его на 90°. Сравни поле до и после поворота.'],
  induction:['ИНДУКЦИЯ','Индукция в катушке','Поднимай и опускай магнит ползунком. Сравни показания приборов и вспышки лампы при медленном и быстром движении.'],
  powered:['ЭЛЕКТРОМАГНИТ','Катушка с батарейкой','Нажми на рычаг и посмотри, как сместится магнит. Поменяй полярность, чтобы изменить направление силы.'],
  alternating:['ПЕРЕМЕННЫЙ ТОК','Переменный ток','Выбери генератор и меняй амплитуду и частоту. Меняй сопротивление резистора, чтобы сравнить ток в цепи. В режиме «Осмотр» коснись конденсатора или катушки, чтобы открыть график.'],
  oscillation:['LC','Колебательный контур','Дождись зарядки от батареи. Коснись трёхконтактного переключателя, чтобы отключить батарею и замкнуть конденсатор на катушку. Колебания постепенно затухают.'],
  empty:['ПЕСОЧНИЦА','Пустой остров','Поставь батарейку, лампу и провода. Соедини оба полюса батарейки через лампу.']
};
const canvas=document.createElement('canvas');
const gl=canvas.getContext('webgl2',{alpha:true,antialias:true});
const renderer=gl?new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true}):new IslandCanvas(canvas);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.outputColorSpace=T.SRGBColorSpace;
$('view').append(renderer.domElement);
const scene=new T.Scene();
const camera=new T.OrthographicCamera(-10,10,10,-10,0.1,120);
const eyes=new T.PerspectiveCamera(66,1,.045,70);
eyes.rotation.order='YXZ';
const controls=new OrbitControls(camera,renderer.domElement);
controls.enablePan=false;
controls.minPolarAngle=.16;
controls.maxPolarAngle=Math.PI/2-.12;
controls.minZoom=.65;
controls.maxZoom=3.6;
controls.touches.TWO=T.TOUCH.DOLLY_PAN;
function resetCamera(){
  camera.position.set(20,18,23); camera.zoom=1; controls.target.set(5.5,.12,4.5);
  camera.updateProjectionMatrix(); controls.update();
}
resetCamera();
const hemi=new T.HemisphereLight(0xf8fdff,0xac8b75,1.75);
const sun=new T.DirectionalLight(0xfff2da,1.85); sun.position.set(-7,15,10);
const fill=new T.DirectionalLight(0xb9e7ff,.55); fill.position.set(12,8,-12);
scene.add(hemi,sun,fill);
const terrain=new T.Group(), objects=new T.Group(), fieldLayer=new T.Group();
scene.add(terrain,objects,fieldLayer);
const geometry={}, materials={};
function material(color,props={}) {
  const spec=JSON.stringify([color,props]);
  return materials[spec]??=new T.MeshStandardMaterial({color,roughness:.76,...props});
}
function mesh(g,m,parent,x,y,z) {
  const ob=new T.Mesh(g,m); ob.position.set(x,y,z); parent.add(ob); return ob;
}
function box(parent,w,h,d,color,x=0,y=0,z=0,props={}) {
  const id=[w,h,d].join('/');
  return mesh(geometry[id]??=new T.BoxGeometry(w,h,d),material(color,props),parent,x,y,z);
}
function cyl(parent,r,h,color,x,y,z,across=false) {
  const id='c/'+r+'/'+h;
  const result=mesh(geometry[id]??=new T.CylinderGeometry(r,r,h,16),material(color),parent,x,y,z);
  if(across) result.rotation.z=Math.PI/2;
  return result;
}
function ring(parent,rad,tube,color,x,y,z) {
  const id='r/'+rad+'/'+tube;
  const result=mesh(geometry[id]??=new T.TorusGeometry(rad,tube,7,20),material(color),parent,x,y,z);
  result.rotation.y=Math.PI/2;
  return result;
}
function textMark(parent,txt,color,x,y,z) {
  const id=txt+color;
  if(!materials[id]) {
    const c=document.createElement('canvas'); c.width=c.height=64;
    const cx=c.getContext('2d'); cx.font='700 49px sans-serif'; cx.textAlign='center';
    cx.textBaseline='middle'; cx.fillStyle=color; cx.fillText(txt,32,34);
    const map=new T.CanvasTexture(c); map.colorSpace=T.SRGBColorSpace;
    materials[id]=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false});
  }
  const flat=mesh(geometry.label??=new T.PlaneGeometry(.24,.24),materials[id],parent,x,y,z);
  flat.rotation.x=-Math.PI/2;
}
const glowCanvas=document.createElement('canvas');
glowCanvas.width=glowCanvas.height=96;
const glowContext=glowCanvas.getContext('2d');
const glowGradient=glowContext.createRadialGradient(48,48,2,48,48,48);
glowGradient.addColorStop(0,'#ffe579e8');
glowGradient.addColorStop(.32,'#ffcb5f9e');
glowGradient.addColorStop(1,'#ffae3000');
glowContext.fillStyle=glowGradient;
glowContext.fillRect(0,0,96,96);
const lampGlow=new T.CanvasTexture(glowCanvas);
lampGlow.colorSpace=T.SRGBColorSpace;
const bulbOff=new T.Color(0x817b6d),bulbOn=new T.Color(0xffdf78);
const shadowCanvas=document.createElement('canvas'); shadowCanvas.width=shadowCanvas.height=128;
const shadowCtx=shadowCanvas.getContext('2d'), gradient=shadowCtx.createRadialGradient(64,64,12,64,64,64);
gradient.addColorStop(0,'#294a62a0'); gradient.addColorStop(.65,'#456b8555');
gradient.addColorStop(1,'#456b8500'); shadowCtx.fillStyle=gradient; shadowCtx.fillRect(0,0,128,128);
const shadow=mesh(new T.PlaneGeometry(18,15),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),terrain,5.7,-1.36,4.8);
shadow.rotation.x=-Math.PI/2;
box(terrain,11.97,.58,9.97,0xa86d59,5.5,-1.03,4.5).userData.coveredTop=true;
box(terrain,11.99,.17,9.99,0x785449,5.5,-1.24,4.5).userData.coveredTop=true;
const ground=[];
for(let x=0;x<size[0];x++) for(let z=0;z<size[2];z++){
  const grass=[0x83ab69,0x89b16e,0x7fa568,0x92b970][(x*13+z*29+x*z)%4];
  const cell=box(terrain,.994,.28,.994,grass,x,-.64,z);
  cell.userData.ground=[x,0,z]; ground.push(cell);
  if(x===0||z===0||x===size[0]-1||z===size[2]-1)
    box(terrain,.982,.38,.982,[0xab735f,0xbb7e65,0x9c6758][(x+z*5)%3],x,-.95,z);
}
const cursor=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.01,1.01,1.01)),
  new T.LineBasicMaterial({color:0x087c73,transparent:true,opacity:.92,depthTest:false}));
cursor.renderOrder=10; cursor.visible=false; scene.add(cursor);
const avatar=new T.Group();
scene.add(avatar);
box(avatar,.32,.36,.24,0x226b64,0,.34,0);
box(avatar,.30,.28,.28,0xf4cd87,0,.67,0);
box(avatar,.26,.09,.028,0x264b5c,0,.682,-.148);
for(const x of [-.10,.10]) box(avatar,.12,.17,.17,0x355165,x,.085,0);

const world=new Map(), models=new Map(), undo=[];
let mode='circuit', tool='inspect', rotation=0, chosen=null, fieldMode='off', density=8, network;
let heldMagnet=null, gripPercent=0;
let movement=null, fieldDirty=true, lastReadings=0, accumulator=0;
let renderNeeded=true;
let body=defaultBody(), firstPerson=false, placingBody=false, wireNetwork;
let fieldSignature='', wireCurrents='', cachedRuns=[], fullScreenStarted=false;
const moveKeys=new Set();
const look=new Map();
const mobile=matchMedia('(pointer: coarse)');
const portrait=matchMedia('(orientation: portrait)');
const activeCamera=()=>firstPerson?eyes:camera;
const magnetReach=2.15/2;
const hotbar=document.querySelector('.workbench');
const fieldModes=new Set(['off','lines','charges','vectors']);
const chargeLayer=new T.Group();
chargeLayer.visible=false;
scene.add(chargeLayer);
const chargePaths=new Map();
let flowSignature=null, currentFlows=[];
const distToMagnet=part=>Math.hypot(body.x-part.p[0],body.y+.5-part.p[1],body.z-part.p[2]);
function releaseMagnet(){
  if(!heldMagnet) return;
  setMagnetGrip(heldMagnet,null);
  heldMagnet=null; gripPercent=0;
}
function magnetControls(){
  const active=selected();
  const part=firstPerson?(heldMagnet??(active?.type==='plunger'?active:null)):
    active?.type==='plunger'?active:inductionDemo(mode)?first('plunger'):null;
  const inReach=part&&(!firstPerson||distToMagnet(part)<=magnetReach);
  $('walk-magnet').hidden=!firstPerson||!inReach;
  $('overview-magnet').hidden=firstPerson||!inReach;
  for(const id of ['walk-magnet','overview-magnet']){
    const label=$(id);
    const value=part===heldMagnet?gripPercent:0;
    label.querySelector('output').value=value+'%';
    label.querySelector('input').value=value;
  }
  return inReach?part:null;
}
for(const id of ['walk-magnet','overview-magnet']){
  const input=$(id).querySelector('input');
  input.addEventListener('input',()=>{
    const value=Number(input.value);
    const part=magnetControls();
    if(!part) return;
    if(heldMagnet!==part) releaseMagnet();
    heldMagnet=part; gripPercent=value;
    setMagnetGrip(part,value/100);
    magnetControls();
  });
  input.addEventListener('pointerup',()=>input.blur());
}
function updateBodyView(){
  avatar.visible=!firstPerson;
  avatar.position.set(body.x,body.y,body.z); avatar.rotation.y=body.yaw;
  eyes.position.set(body.x,body.y+.76,body.z);
  eyes.rotation.set(body.pitch,body.yaw,0,'YXZ');
  renderNeeded=true;
}
function orientationHint(){
  const needsTurn=mobile.matches&&portrait.matches===firstPerson;
  $('orientation').hidden=!needsTurn;
  document.querySelector('.orientation-phone').setAttribute('transform',firstPerson?'rotate(-39 48 48)':'rotate(34 48 48)');
  $('orientation-text').textContent=firstPerson?'Поверни телефон горизонтально':'Поверни телефон вертикально';
  $('orientation-back').hidden=!firstPerson;
}
async function configureOrientation(enabled){
  if(!mobile.matches) return;
  if(enabled&&!document.fullscreenElement&&screen.orientation?.lock&&document.documentElement.requestFullscreen){
    try {
      await document.documentElement.requestFullscreen();
      fullScreenStarted=true;
      if(firstPerson) await screen.orientation.lock('landscape');
    } catch {}
    if(!firstPerson&&fullScreenStarted&&document.fullscreenElement){
      fullScreenStarted=false;
      await document.exitFullscreen().catch(()=>{});
    }
  } else if(!enabled&&fullScreenStarted&&document.fullscreenElement){
    fullScreenStarted=false;
    screen.orientation?.unlock?.();
    await document.exitFullscreen().catch(()=>{});
  }
  orientationHint();
}
async function toggleFullscreen(){
  if(document.fullscreenElement){
    await document.exitFullscreen().catch(()=>{});
    return;
  }
  try {
    await document.documentElement.requestFullscreen();
    $('open-standalone').hidden=true;
    if(firstPerson&&mobile.matches&&screen.orientation?.lock) await screen.orientation.lock('landscape').catch(()=>{});
  } catch {
    $('open-standalone').href=location.href;
    $('open-standalone').hidden=false;
  }
}
$('fullscreen').onclick=()=>void toggleFullscreen();
function changeView(enabled){
  releaseMagnet();
  firstPerson=enabled;
  if(enabled&&tool==='erase') tool='inspect';
  if(enabled) document.querySelector('.stage').append(hotbar);
  else $('orientation').before(hotbar);
  placingBody=false; controls.enabled=!enabled;
  resetWalkInput();
  cursor.visible=false;
  document.body.classList.toggle('first-person',enabled);
  updateBodyView(); updateUI(); resize(); updateAim(); orientationHint(); save();
  void configureOrientation(enabled);
}
$('perspective').onclick=()=>changeView(!firstPerson);
$('orientation-back').onclick=()=>changeView(false);
portrait.addEventListener('change',orientationHint);
mobile.addEventListener('change',orientationHint);
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement) fullScreenStarted=false;
  const label=document.fullscreenElement?'Выйти из полноэкранного режима':'На весь экран';
  $('fullscreen').setAttribute('aria-label',label); $('fullscreen').title=label;
  orientationHint();
});
$('body-place').onclick=()=>{
  placingBody=!placingBody; cursor.visible=false; updateUI();
};
const activeButtons=new Map();
controls.addEventListener('change',()=>{renderNeeded=true;});
const storageKey='faraday-island-v1';
const simulationStep=1/60;
const electricalStep=simulationStep/4;
const scopeSamples=[];
let scopePart=null;
const isMeter=part=>part?.type==='ammeter'||part?.type==='voltmeter';
const visualPosition=part=>[part.p[0]+(part.shift??0),part.p[1],part.p[2]];
function magnetData() {
  return [...world.values()].filter(p=>p.type==='magnet').map(part=>({
    center:visualPosition(part),axis:directions[part.rot],strength:part.value??11
  }));
}
function makeMeter(group,amps){
  const canvas=document.createElement('canvas');
  canvas.width=384; canvas.height=216;
  const context=canvas.getContext('2d');
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const displayMaterial=new T.MeshBasicMaterial({map:texture});
  const centerY=-.075;
  box(group,.64,.112,.64,amps?0x284e51:0x3c4061,0,-.252);
  box(group,.37,.34,.37,amps?0x284e51:0x3c4061,0,centerY);
  const tilt=-Math.PI/12;
  for(let i=0;i<4;i++){
    const direction=i*Math.PI/2;
    const panel=new T.Group();
    panel.rotation.y=direction;
    panel.position.set(Math.sin(direction)*.245,centerY,Math.cos(direction)*.245);
    group.add(panel);
    const bezel=box(panel,.39,.305,.058,amps?0x68a8a3:0x8e88b7);
    bezel.rotation.x=tilt;
    const screen=mesh(geometry.meterFace??=new T.PlaneGeometry(.355,.265),
      displayMaterial,panel,0,-Math.sin(tilt)*.034,Math.cos(tilt)*.034);
    screen.rotation.x=tilt;
    screen.userData.meterScreen=true;
  }
  const cap=box(group,.36,.026,.36,amps?0x6fbeb0:0xa5a0da,0,centerY+.18);
  textMark(group,amps?'A':'V','#193746',0,cap.position.y+.015,0);
  return {canvas,context,texture,material:displayMaterial,text:null};
}
const copper=0xc38450;
function windingTube(group,path,segments,radius){
  mesh(new T.TubeGeometry(path,segments,radius,6),material(copper),group,0,0,0);
}
function updateWinding(part,model){
  const count=windingCount(part);
  if(model.turnCount===count) return;
  model.turnCount=count;
  const vertical=part.type==='plunger';
  const radius=vertical?.248:.178;
  const span=vertical?Math.min(count*.032,.36):Math.min(count*.067,.522);
  const thickness=Math.min(vertical?.015:.032,span/count*.46);
  const top=plungerCoilY+.18;
  const helix=new T.Curve();
  helix.getPoint=(t,target=new T.Vector3(),offset=0)=>{
    const angle=t*count*2*Math.PI, radial=radius+offset;
    return vertical?
      target.set(radial*Math.sin(angle),top-span*(1-t),radial*Math.cos(angle)):
      target.set(span*(.5-t),-.06+radial*Math.cos(angle),radial*Math.sin(angle));
  };
  // Both paths start at the positive local-X terminal, for the branch current convention.
  for(const child of model.winding.children) child.geometry.dispose();
  model.winding.clear();
  windingTube(model.winding,helix,count*16,thickness);
  if(vertical) for(const [sign,t] of [[-1,1],[1,0]]){
    const end=helix.getPoint(t);
    const points=[
      end,new T.Vector3(sign*.31,end.y,.18),new T.Vector3(sign*.33,end.y,.075),
      new T.Vector3(sign*.373,-.193,.045),new T.Vector3(sign*.414,-.193,.045)
    ];
    windingTube(model.winding,new T.CatmullRomCurve3(points),18,Math.max(.011,thickness*.85));
  }
  const charges=model.windingCharges??=new T.Group();
  model.group.add(charges);
  charges.clear();
  charges.visible=false;
  model.windingPath={helix,thickness,phase:0};
  renderNeeded=true;
}
function animateWindingCharges(part,model,dt){
  const group=model.windingCharges;
  const current=part.current??0;
  const moving=Math.abs(current)>=.002;
  const visible=fieldMode==='charges'&&(moving||group.children.length>0);
  if(group.visible!==visible) renderNeeded=true;
  group.visible=visible;
  if(!visible||!moving) return;
  const {helix,thickness}=model.windingPath;
  if(!group.children.length){
    const count=Math.min(42,Math.max(7,model.turnCount*3));
    const shape=geometry.windingElectron??=new T.SphereGeometry(1,8,6);
    const tint=materials.electron??=new T.MeshBasicMaterial({color:0x063d64});
    for(let i=0;i<count;i++) mesh(shape,tint,group,0,0,0).scale.setScalar(thickness*.95);
  }
  const phase=nextElectronPhase(model.windingPath.phase,current,dt*3/model.turnCount);
  model.windingPath.phase=phase;
  for(const [i,dot] of group.children.entries()){
    helix.getPoint((phase+i/group.children.length)%1,dot.position,thickness*1.5);
  }
  renderNeeded=true;
}
const plateThickness=.044;
const plateRows=[[0,0],[-1,-1],[1,1],[1,-1],[-1,1],[0,-1],[0,1],[-1,0],[1,0],
  [-2,-2],[2,2],[2,-2],[-2,2],[-2,0],[2,0],[0,-2],[0,2],[-1,-2],[1,2],[1,-2],[-1,2],
  [-2,-1],[2,1],[2,-1],[-2,1]];
function makeCapacitor(group,model){
  model.plates=[-1,1].map(sign=>({
    sign, plate:box(group,plateThickness,1,1,sign>0?0xce8c52:0xb07a4d),
    lead:box(group,1,.045,.09,0xc08650),
    charges:new T.Group(), dots:[]
  }));
  for(const face of model.plates){
    group.add(face.charges);
    face.charges.visible=false;
  }
}
function updateCapacitor(part,model){
  const {side,gap}=capacitorDimensions(part.capacitance??defaultCapacitance);
  const center=partBaseTop+.018+side*.5;
  for(const {sign,plate,lead} of model.plates){
    plate.position.set(sign*(gap+plateThickness)/2,center,0);
    plate.scale.set(1,side,side);
    const outside=gap/2+plateThickness-.012;
    lead.position.set(sign*(.414+outside)/2,-.204,0);
    lead.scale.x=.414-outside;
  }
}
function updatePlateCharges(part,model){
  const charge=(part.capacitance??defaultCapacitance)*(part.capVoltage??0);
  const count=Math.ceil(plateRows.length*Math.abs(charge)/(Math.abs(charge)+.38));
  const visible=fieldMode==='charges'&&Math.abs(charge)>.001;
  if(model.plateChargeCount===count&&model.plateChargeSign===Math.sign(charge)&&model.plateChargeVisible===visible) return;
  model.plateChargeCount=count;
  model.plateChargeSign=Math.sign(charge);
  model.plateChargeVisible=visible;
  for(const {sign,plate,charges,dots} of model.plates){
    renderNeeded ||= charges.visible||visible;
    charges.visible=visible;
    if(!visible) continue;
    const positive=charge*sign>0;
    const shape=geometry.plateCharge??=new T.SphereGeometry(.019,8,6);
    const tint=positive?
      (materials.positiveCharge??=new T.MeshBasicMaterial({color:0xbc2626})):
      (materials.negativeCharge??=new T.MeshBasicMaterial({color:0x063d64}));
    while(dots.length<count) dots.push(mesh(shape,tint,charges,0,0,0));
    for(const [i,dot] of dots.entries()){
      const [row,col]=plateRows[i];
      dot.visible=i<count;
      dot.material=tint;
      const gap=2*Math.abs(plate.position.x)-plateThickness;
      const size=Math.min(1,gap/.08);
      dot.scale.setScalar(size);
      dot.position.set(
        plate.position.x-sign*(plateThickness/2+.012*size),
        plate.position.y+plate.scale.y*row*.175,
        col*plate.scale.z*.175
      );
    }
  }
}
function makePart(part) {
  const group=new T.Group(); objects.add(group);
  group.position.set(...visualPosition(part));
  // Wire branches are derived from neighboring terminals in world coordinates.
  if(part.type!=='wire') group.rotation.y=-part.rot*Math.PI/2;
  const r={group};
  const base=color=>{
    box(group,.89,.13,.85,0x34495a,0,-.435);
    box(group,.9,.065,.86,color,0,partBaseTop-.065/2);
  };
  const contacts=()=>{
    for(const sign of [-1,1]) {
      box(group,.19,.085,.19,0xd79551,sign*.405,-.25);
      box(group,.12,.027,.13,0xffce84,sign*.414,-.196);
    }
  };
  switch(part.type) {
    case 'tile':
    case 'stone': {
      const tile=part.type==='tile';
      box(group,.983,.972,.983,tile?0xd4b891:0x9ba8b6);
      box(group,.957,.055,.957,tile?0xe1c6a4:0xb4bec8,0,.459);
      break;
    }
    case 'glass':
      box(group,.96,.96,.96,0x59c7ce,0,0,0,{transparent:true,opacity:.42,depthWrite:false});
      for(const x of [-.43,.43]) for(const z of [-.43,.43])
        box(group,.07,.96,.07,0x4ba9af,x,0,z);
      for(const y of [-.44,.44]) box(group,.95,.07,.95,0x7ec8cc,0,y,0,{transparent:true,opacity:.66});
      break;
    case 'wire': {
      const links=terminals(part).filter(d=>{
        const neighbor=world.get(key(add(part.p,directions[d])));
        return neighbor&&terminals(neighbor).includes(opposite[d]);
      });
      box(group,.26,.11,.26,0x465768,0,-.42);
      cyl(group,.106,.07,0xe8ad68,0,-.313,0);
      for(const side of links.length?links:[0,2]) {
        const [x,y,z]=directions[side];
        if(y) box(group,.11,y>0?.77:.31,.11,0xcc8549,0,y>0?.04:-.49,0);
        else box(group,x?.50:.105,.085,z?.50:.105,0xd59551,x*.28,-.28,z*.28);
      }
      break;
    }
    case 'battery':
      base(0x6eaa72); contacts();
      cyl(group,.206,.62,0x569568,0,-.084,0,true);
      cyl(group,.209,.13,0x264c4e,-.29,-.084,0,true);
      cyl(group,.209,.14,0xd49a48,.26,-.084,0,true);
      cyl(group,.105,.13,0xf6d48d,.351,-.084,0,true);
      textMark(group,'+','#fff8de',.25,.126,0);
      textMark(group,'−','#fff8de',-.235,.126,0);
      break;
    case 'switch':
      base(0xd6a98b); contacts();
      box(group,.47,.17,.53,0x445c6c,0,-.235);
      r.lever=box(group,.36,.105,.31,0xd17e46,0,-.1);
      r.lever.rotation.z=part.on?0:.7;
      break;
    case 'button':
      base(0xb69b85); contacts();
      cyl(group,.29,.15,0x445c6c,0,-.24,0);
      r.plunger=cyl(group,.202,.135,0xd85b47,0,-.11,0);
      break;
    case 'lamp':
      base(0xccae72); contacts();
      cyl(group,.172,.17,0x455668,0,-.22,0);
      cyl(group,.15,.055,0x917153,0,-.103,0);
      r.glow=new T.MeshStandardMaterial({color:bulbOff,emissive:0xffad36,emissiveIntensity:0,roughness:.34});
      r.halo=new T.Sprite(new T.SpriteMaterial({map:lampGlow,transparent:true,opacity:0,depthWrite:false}));
      r.halo.position.set(0,.075,0);
      r.halo.visible=false;
      group.add(r.halo);
      mesh(geometry.bulb??=new T.SphereGeometry(.247,17,12),r.glow,group,0,.075,0);
      break;
    case 'coil':
      base(0xb39172); contacts();
      cyl(group,.16,.63,0x505f71,0,-.06,0,true);
      r.winding=new T.Group();group.add(r.winding);
      updateWinding(part,r);
      for(const s of [-1,1]) cyl(group,.241,.064,0x79523e,s*.33,-.06,0,true);
      break;
    case 'plunger': {
      base(0xb99d85); contacts();
      r.winding=new T.Group();group.add(r.winding);
      updateWinding(part,r);
      for(const offset of [-.222,.222]){
        const rim=ring(group,.248,.034,0x61556a,0,plungerCoilY+offset,0);
        rim.rotation.set(Math.PI/2,0,0);
      }
      for(const x of [-.195,.195]) box(group,.036,.59,.035,0xa8b9c8,x,-.013,-.026);
      r.slider=new T.Group(); group.add(r.slider);
      r.slider.position.y=plungerCoilY+(part.height??plungerRest);
      const halfHeight=plungerMagnetHeight/2;
      box(r.slider,.227,halfHeight,.227,0x447eae,0,-halfHeight/2);
      box(r.slider,.227,halfHeight,.227,0xc95158,0,halfHeight/2);
      textMark(r.slider,'N','#ffffff',0,halfHeight+.003,0);
      r.handleHit=mesh(geometry.sliderHit??=new T.BoxGeometry(.30,.59,.30),
        materials.hit??=new T.MeshBasicMaterial({visible:false}),objects,part.p[0],
        part.p[1]+r.slider.position.y,part.p[2]);
      r.handleHit.userData.part=part;
      break;
    }
    case 'magnet':
      base(0xa4afba);
      box(group,.42,.34,.61,0x4b80ad,-.21,-.12);
      box(group,.42,.34,.61,0xc75055,.21,-.12);
      textMark(group,'N','#ffffff',.21,.055,0);
      textMark(group,'S','#ffffff',-.21,.055,0);
      break;
    case 'ammeter':
    case 'voltmeter': {
      const amps=part.type==='ammeter';
      base(amps?0x66a8a2:0x8886bb); contacts();
      r.display=makeMeter(group,amps);
      textMark(group,'+','#d18e57',.35,-.188,.14);
      break;
    }
    case 'capacitor':
      base(0x829eaf); contacts();
      makeCapacitor(group,r);
      updateCapacitor(part,r);
      break;
    case 'selector': {
      base(0xa2a9aa); contacts();
      box(group,.19,.085,.17,0xd79551,0,-.25,.41);
      box(group,.12,.027,.11,0xffce84,0,-.196,.414);
      box(group,.69,.12,.55,0x44505a,0,-.239,.015);
      for(const sign of [-1,1]){
        box(group,.195,.04,.079,0xce8b53,sign*.326,-.158,-.10);
        cyl(group,.064,.074,sign<0?0xd69a47:0xc1ab73,sign*.24,-.132,-.10);
      }
      box(group,.072,.044,.24,0xde9c54,0,-.161,.31);
      cyl(group,.087,.085,0xc48748,0,-.128,.20);
      const arm=new T.Group();
      arm.position.set(0,-.075,.20);group.add(arm);
      box(arm,.056,.039,.414,0xe9af68,0,0,-.175);
      cyl(arm,.082,.102,0x284651,0,.060,-.232);
      cyl(arm,.062,.046,0xd8e5e1,0,.127,-.232);
      r.selectorArm=arm;
      arm.rotation.y=part.on?-.675:.675;
      break;
    }
    case 'generator':
      base(0x766d65); contacts();
      box(group,.60,.275,.48,0x565b62,0,-.15);
      box(group,.57,.15,.46,0xd56649,0,.086);
      box(group,.30,.12,.045,0xf28d58,0,-.17,.247);
      for(const z of [-.26,.26]){
        box(group,.68,.055,.055,0x353d42,0,.175,z);
        for(const x of [-.33,.33]) box(group,.055,.40,.055,0x353d42,x,-.02,z);
      }
      for(const x of [-.32,.32]) box(group,.055,.055,.56,0x353d42,x,.175,0);
      for(const x of [-.22,-.15,-.08,.08,.15,.22]) box(group,.023,.10,.023,0x303b42,x,-.14,-.249);
      box(group,.10,.032,.10,0x373b44,.12,.171,-.05);
      textMark(group,'∿','#fff2d2',0,.166,0);
      break;
    case 'resistor':
      base(0xb4a5cd); contacts();
      cyl(group,.133,.55,0xd1bd90,0,-.153,0,true);
      for(const [x,color] of [[-.18,0x594339],[-.05,0xa8544e],[.08,0x335c63],[.2,0xaa7840]])
        cyl(group,.137,.035,color,x,-.153,0,true);
      break;
  }
  const wireHit=part.type==='wire';
  const hitShape=wireHit?(geometry.wireHit??=new T.BoxGeometry(.998,.33,.998)):
    (geometry.hit??=new T.BoxGeometry(.998,.998,.998));
  const hitPosition=visualPosition(part);
  if(wireHit) hitPosition[1]-=.28;
  const hit=mesh(hitShape,materials.hit??=new T.MeshBasicMaterial({visible:false}),objects,...hitPosition);
  hit.userData.part=part;
  r.hit=hit;
  models.set(key(part.p),r);
}
function redraw() {
  for(const model of models.values()){
    if(model.winding) for(const child of model.winding.children) child.geometry.dispose();
    model.glow?.dispose();
    model.halo?.material.dispose();
    model.display?.texture.dispose();
    model.display?.material.dispose();
  }
  objects.clear(); models.clear();
  for(const part of world.values()) makePart(part);
  network=compile(world); wireNetwork=makeWireNetwork(world); wireCurrents=null;
  chargeLayer.clear(); chargePaths.clear(); flowSignature=null;
  step(network,electricalStep,magnetData(),true);
  body=safeBody(world,body); updateBodyView();
  cursor.visible=false; fieldSignature=''; fieldDirty=true; renderNeeded=true;
}
function snapshot() {
  return {mode,showField:fieldMode!=='off',fieldMode,density,body:{...body},parts:[...world.values()].map(({p,rot,type,value,on,shift,inductance,resistance,capacitance,frequency,rms})=>({p,rot,type,value,on:type==='button'?undefined:on,shift,inductance,resistance,capacitance,frequency,rms}))};
}
function save() {
  try { localStorage.setItem(storageKey,JSON.stringify(snapshot())); } catch {}
}
function checkpoint() {
  undo.push(snapshot()); if(undo.length>35) undo.shift();
  $('undo').disabled=false;
}
function restore(data) {
  releaseMagnet();
  movement=null; activeButtons.clear(); scopeSamples.length=0; mode=data.mode; placingBody=false;
  fieldMode=data.fieldMode==='electric'?'charges':
    fieldModes.has(data.fieldMode)?data.fieldMode:data.showField?'lines':'off';
  density=Number.isInteger(data.density)?Math.max(4,Math.min(12,data.density)):8;
  body=data.body&&['x','y','z','yaw','pitch'].every(k=>Number.isFinite(data.body[k]))?{...data.body}:defaultBody();
  world.clear();
  for(const part of data.parts) world.set(key(part.p),part);
  chosen=null; tool='inspect'; rotation=0;
  redraw(); updateUI(); updateAim();
}
function setPreset(name) {
  checkpoint();
  restore({mode:name,fieldMode:name==='magnet'?'lines':fieldMode,density,parts:preset(name)});
  save();
}
function switchPart(part) {
  checkpoint(); part.on=!part.on; renderNeeded=true; updateUI(); save();
}
function pressPart(part) {
  part.on=true; activeButtons.set(part,.75); renderNeeded=true;
}
function selected() { return world.get(chosen); }
const first=type=>[...world.values()].find(p=>p.type===type);
function animateMagnet(part,target) {
  if(movement) return;
  const start=part.shift??0;
  const destination=Math.max(-.45,Math.min(2.1,target));
  if(Math.abs(destination-start)<.005) return;
  const low=part.p[0]+Math.min(start,destination)-.85;
  const high=part.p[0]+Math.max(start,destination)+.85;
  const obstruction=[...world.values()].some(other=>other!==part&&other.type!=='wire'&&other.p[1]===part.p[1]&&
    other.p[2]===part.p[2]&&visualPosition(other)[0]>low&&visualPosition(other)[0]<high);
  if(obstruction||part.p[0]+destination>size[0]-.55){
    $('hint').textContent='Освободи место для движения магнита вдоль оси X.';
    return;
  }
  checkpoint();
  movement={part,start,target:destination,t:0};
  $('move-magnet')?.setAttribute('disabled','');
}
function setField(value) {
  fieldMode=value; fieldDirty=true; updateUI(); save();
}
function toggleFieldMenu(force){
  const open=force??$('field-options').hidden;
  $('field-options').hidden=!open;
  $('field').setAttribute('aria-expanded',String(open));
}
$('field-mode').onchange=event=>setField(event.target.value);
$('field-density').oninput=event=>{
  density=Number(event.target.value);
  $('density-value').value=density; fieldDirty=true; save();
};
document.addEventListener('pointerdown',event=>{
  if(!$('field-options').hidden&&!event.target.closest('#field-options,#field')) toggleFieldMenu(false);
  if(!$('open-standalone').hidden&&!event.target.closest('#open-standalone,#fullscreen')) $('open-standalone').hidden=true;
});
for(const [type,[name,color,symbol]] of Object.entries(ui)) {
  const button=document.createElement('button');
  button.className='piece'; button.dataset.tool=type;
  const icon=document.createElement('i');
  icon.style.setProperty('--swatch',color); icon.textContent=symbol; icon.setAttribute('aria-hidden','true');
  if(type==='selector'){
    icon.innerHTML='<svg viewBox="0 0 24 20" width="23" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="15" r="2"/><path d="M12 13 6.5 6.5"/></svg>';
  }
  const label=document.createElement('span'); label.className='piece-label'; label.textContent=name;
  button.title=name; button.append(icon,label);
  button.addEventListener('click',()=>{releaseMagnet();placingBody=false;tool=type; chosen=null; cursor.visible=false; updateUI(); updateAim();});
  $('palette').append(button);
}
function updateUI() {
  renderNeeded=true;
  const [badge,title,description]=experiments[mode];
  $('preset').value=mode; $('badge').textContent=badge; $('experiment-title').textContent=title;
  $('experiment-description').textContent=description;
  $('undo').disabled=!undo.length;
  $('field').setAttribute('aria-pressed',String(fieldMode!=='off'));
  $('field-mode').value=fieldMode;
  $('field').textContent=fieldMode==='charges'?'Заряды':fieldMode==='off'?'Поле':'Поле B';
  chargeLayer.visible=fieldMode==='charges';
  updateScope();
  $('field-density').value=density;
  $('density-value').value=density;
  $('vector-options').hidden=fieldMode!=='vectors';
  $('body-place').setAttribute('aria-pressed',String(placingBody));
  $('perspective').textContent=firstPerson?'Общий вид':'От 1-го лица';
  $('remove').setAttribute('aria-pressed',String(tool==='erase'));
  for(const button of $('palette').children){
    button.classList.toggle('active',button.dataset.tool===tool);
    button.setAttribute('aria-pressed',String(button.dataset.tool===tool));
  }
  const active=selected(), rotatePart=rotationTarget();
  $('placement').textContent=placingBody?'Позиция фигурки':tool==='erase'?'Ластик':ui[tool][0];
  const placementRotation=tool!=='inspect'&&tool!=='wire'&&tool!=='erase';
  $('angle').textContent=((rotatePart?.rot??(placementRotation?rotation:0))*90)+'°';
  $('rotate').disabled=placingBody||(!rotatePart&&!placementRotation);
  $('hint').textContent=placingBody?'Коснись земли или верха блока, чтобы поставить фигурку':
    firstPerson?'Коснись прибора для настройки · удерживай 2 с для удаления':
    tool==='inspect'?'Потяни сцену для поворота · коснись детали для осмотра':
    tool==='erase'?'Коснись детали, чтобы удалить её':'Коснись блока для установки или прибора для настройки';
  $('polarity').hidden=mode!=='powered'||!first('battery');
  magnetControls();
  updateDetails(active);
  updatePartControls(active);
}
const batterySetting={key:'value',label:'ЭДС',unit:'В',min:0,max:24,step:.1,defaultValue:9};
const coilSetting={key:'inductance',label:'Индуктивность',unit:'Гн',min:.02,max:3,step:.01,defaultValue:defaultInductance};
const coilResistanceSetting={key:'resistance',label:'Активное сопротивление',unit:'Ом',min:0,max:30,step:.01,defaultValue:defaultCoilResistance};
const resistorSetting={key:'value',label:'Сопротивление',unit:'Ом',min:1,max:100,step:1,defaultValue:22};
const magnetSetting={key:'value',label:'Сила магнита',unit:'',min:2,max:22,step:1,defaultValue:11};
const capacitorSetting={key:'capacitance',label:'Ёмкость',unit:'мФ',min:10,max:500,step:1,defaultValue:defaultCapacitance,factor:1000};
const generatorSetting={key:'value',label:'Амплитуда ЭДС',unit:'В',min:0,max:24,step:.1,defaultValue:12};
const frequencySetting={key:'frequency',label:'Частота',unit:'Гц',min:.25,max:10,step:.05,defaultValue:defaultFrequency};
const partRange=$('part-range'), partExtra=$('part-extra');
const isDevice=part=>Boolean(part&&part.type!=='wire'&&(electrical.has(part.type)||part.type==='magnet'));
function rotationTarget(){
  const part=selected();
  return part&&part.type!=='wire'&&closedSettings!==part&&(tool==='inspect'||isDevice(part))?part:null;
}
let closedSettings=null, editingPart=null, partEditStarted=false;
const settingsByType={battery:batterySetting,coil:coilSetting,plunger:coilSetting,
  resistor:resistorSetting,magnet:magnetSetting,capacitor:capacitorSetting,generator:generatorSetting};
const extraByType={generator:frequencySetting,coil:coilResistanceSetting,plunger:coilResistanceSetting};
const selectorState=part=>part.on?'Свободные колебания':'Зарядка от батареи';
function updateRange(input,label,output,part,setting){
  input.min=setting.min; input.max=setting.max; input.step=setting.step;
  const value=(part[setting.key]??setting.defaultValue)*(setting.factor??1);
  label.textContent=setting.label;
  output.value=[number(value),setting.unit].filter(Boolean).join(' ');
  input.value=value;
  input.setAttribute('aria-valuetext',output.value);
}
function updatePartControls(part){
  const setting=settingsByType[part?.type];
  const extra=extraByType[part?.type];
  const visible=isDevice(part)&&closedSettings!==part;
  $('part-controls').hidden=!visible;
  if(!visible){
    editingPart=null; partEditStarted=false;
    return;
  }
  $('part-controls-title').textContent=ui[part.type][0];
  $('rotate-part').textContent='⟳ '+part.rot*90+'°';
  $('part-parameter').hidden=!setting;
  $('part-status').hidden=part.type!=='selector';
  $('meter-mode').hidden=!isMeter(part);
  $('meter-mode').textContent=part.rms?'Действующее (RMS)':'Мгновенное значение';
  $('meter-mode').setAttribute('aria-pressed',String(Boolean(part.rms)));
  $('part-status').value=part.type==='selector'?selectorState(part):'';
  $('part-extra-label').hidden=partExtra.hidden=!extra;
  if(!setting){
    editingPart=null; partEditStarted=false;
    return;
  }
  if(editingPart!==part){
    editingPart=part; partEditStarted=false;
  }
  $('part-windings').textContent=isCoil(part)?'Витки на модели: '+windingCount(part):'';
  $('part-windings').hidden=!isCoil(part);
  updateRange(partRange,$('part-range-label'),$('part-value'),part,setting);
  if(extra) updateRange(partExtra,$('part-extra-label').firstElementChild,$('part-extra-value'),part,extra);
}
for(const [input,settings] of [[partRange,settingsByType],[partExtra,extraByType]]){
  input.addEventListener('input',()=>{
    const part=editingPart;
    if(!part||part!==selected()) return;
    if(!partEditStarted){checkpoint();partEditStarted=true;}
    const setting=settings[part.type];
    part[setting.key]=Number(input.value)/(setting.factor??1);
    const model=models.get(key(part.p));
    if(setting.key==='inductance') updateWinding(part,model);
    if(part.type==='capacitor'){
      updateCapacitor(part,model);
      model.plateChargeCount=null;
    }
    updatePartControls(part);
    fieldDirty=true; renderNeeded=true;
  });
  for(const event of ['change','blur','pointercancel']) input.addEventListener(event,finishPartEdit);
}
function finishPartEdit(){
  if(partEditStarted) save();
  partEditStarted=false;
}
$('close-part-controls').onclick=()=>{
  finishPartEdit();
  closedSettings=selected();updateUI();
};
$('meter-mode').onclick=()=>{
  const part=selected();
  if(!isMeter(part)) return;
  checkpoint();part.rms=!part.rms;updatePartControls(part);save();
};
function updateDetails(part) {
  const panel=$('details'); panel.replaceChildren();
  if(!part) return;
  const title=document.createElement('strong'); title.textContent=ui[part.type][0]; panel.append(title);
  const value=document.createElement('p'); value.id='detail-value'; panel.append(value);
  if(part.type==='button') {
    const button=document.createElement('button');
    button.textContent='Нажать кнопку'; button.onclick=()=>pressPart(part);
    panel.append(button);
  }
  if(part.type==='magnet') {
    const button=document.createElement('button'); button.id='move-magnet';
    button.textContent=(part.shift??0)>1?'Вернуть магнит':'Сдвинуть по оси X';
    button.disabled=Boolean(movement);
    button.onclick=()=>animateMagnet(part,(part.shift??0)>1?0:2.1);
    panel.append(button);
  }
}
$('polarity').onclick=()=>{
  const battery=first('battery');
  if(!battery) return;
  checkpoint(); battery.rot=(battery.rot+2)%4; redraw(); updateAim(); save();
};
$('preset').onchange=e=>setPreset(e.target.value);
$('undo').onclick=()=>{if(undo.length){restore(undo.pop());save();}};
$('help').onclick=()=>$('guide').showModal();
$('field').onclick=()=>toggleFieldMenu();
$('camera').onclick=resetCamera;
$('remove').onclick=()=>{releaseMagnet();placingBody=false;tool=tool==='erase'?'inspect':'erase';chosen=null;cursor.visible=false;updateUI();};
function rotateSelected(part){
  if(movement) return;
  finishPartEdit();
  checkpoint(); part.rot=(part.rot+1)%4; redraw(); updateUI(); updateAim(); save();
}
$('rotate-part').onclick=()=>{
  const part=rotationTarget();
  if(part) rotateSelected(part);
};
$('rotate').onclick=()=>{
  const part=rotationTarget();
  if(part) rotateSelected(part);
  else {rotation=(rotation+1)%4; updateUI();}
};
const raycaster=new T.Raycaster(), pointer=new T.Vector2(), down=new Map();
let multitouch=false;
function pick(event) {
  if(!event) pointer.set(0,0);
  else {
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  }
  const view=activeCamera();
  scene.updateMatrixWorld(); view.updateMatrixWorld();
  raycaster.far=firstPerson?4.2:Infinity;
  raycaster.setFromCamera(pointer,view);
  const targets=[...models.values()].flatMap(model=>{
    if(placingBody&&!['stone','tile','glass'].includes(model.hit.userData.part.type)) return [];
    return model.handleHit?[model.hit,model.handleHit]:[model.hit];
  });
  const hits=raycaster.intersectObjects([...ground,...targets],false);
  if(!hits.length) return null;
  const {object,face}=hits[0], part=object.userData.part;
  if(!part){
    const target=object.userData.ground;
    return {target,foot:face.normal.y>.5?[target[0],-.5,target[2]]:null};
  }
  const faceNormal=face.normal;
  const foot=faceNormal.y>.5?[part.p[0],part.p[1]+.5,part.p[2]]:null;
  return {part,foot,target:add(part.p,[faceNormal.x,faceNormal.y,faceNormal.z])};
}
function blocked(target) {
  if(!target||!inside(target)||world.has(key(target))||bodyOccupies(body,target)) return true;
  if(world.get(key(add(target,[0,-1,0])))?.type==='plunger') return true;
  if(tool==='plunger'&&world.has(key(add(target,[0,1,0])))) return true;
  return [...world.values()].some(p=>p.type==='magnet'&&(p.shift??0)!==0&&
      p.p[1]===target[1]&&p.p[2]===target[2]&&Math.abs(visualPosition(p)[0]-target[0])<.95);
}
function pointerCell(target,bad=false) {
  renderNeeded=true;
  cursor.visible=Boolean(target&&inside(target));
  if(!cursor.visible) return;
  cursor.position.set(...target);
  cursor.material.color.setHex(bad?0xc65f4f:0x087c73);
}
const surface=renderer.domElement;
const deletionHoldMs=2000;
function stopHold(gesture){
  clearTimeout(gesture.timer);
  $('remove-progress').hidden=true;
}
function finishLook(id){
  const gesture=look.get(id);
  if(!gesture) return null;
  stopHold(gesture);
  look.delete(id);
  return gesture;
}
surface.addEventListener('contextmenu',event=>{if(firstPerson) event.preventDefault();});
surface.addEventListener('pointerdown',event=>{
  if(event.button!==0) return;
  if(firstPerson) {
    if(look.size) return;
    const x=event.clientX,y=event.clientY;
    const part=pick(event)?.part;
    const gesture={x,y,startX:x,startY:y,dragged:false,held:false,part};
    look.set(event.pointerId,gesture);
    surface.setPointerCapture(event.pointerId);
    if(part){
      const rect=surface.getBoundingClientRect(), progress=$('remove-progress');
      progress.style.left=x-rect.left+'px';
      progress.style.top=y-rect.top+'px';
      progress.hidden=false;
      gesture.timer=setTimeout(()=>{
        progress.hidden=true;
        if(!firstPerson||gesture.dragged) return;
        gesture.held=true;
        if(pick({clientX:x,clientY:y})?.part===part) removePart(part);
      },deletionHoldMs);
    }
    return;
  }
  down.set(event.pointerId,[event.clientX,event.clientY,false]);
  if(down.size>1) multitouch=true;
});
surface.addEventListener('pointermove',event=>{
  if(firstPerson){
    const gesture=look.get(event.pointerId);
    if(!gesture||gesture.held) return;
    const x=event.clientX,y=event.clientY;
    if(!gesture.dragged){
      if(Math.hypot(x-gesture.startX,y-gesture.startY)<8) return;
      gesture.dragged=true;
      stopHold(gesture);
    }
    const dx=x-gesture.x,dy=y-gesture.y;
    gesture.x=x; gesture.y=y;
    body.yaw-=dx*.005;
    body.pitch=Math.max(-1.42,Math.min(1.42,body.pitch-dy*.005));
    updateBodyView(); updateAim();
    return;
  }
  const press=down.get(event.pointerId);
  if(press&&Math.hypot(event.clientX-press[0],event.clientY-press[1])>7) press[2]=true;
  if(event.pointerType!=='mouse'||down.size) return;
  const hit=pick(event);
  if(placingBody){pointerCell(hit?.target,!(hit?.foot&&at(world,...hit.foot)));return;}
  if(tool==='inspect'){pointerCell(selected()?visualPosition(selected()):hit?.part?.p);return;}
  if(tool==='erase'){pointerCell(hit?.part?.p,true);return;}
  if(isDevice(hit?.part)){pointerCell(visualPosition(hit.part));return;}
  pointerCell(hit?.target,blocked(hit?.target));
});
surface.addEventListener('pointerleave',()=>{if(!chosen){cursor.visible=false;renderNeeded=true;}});
surface.addEventListener('lostpointercapture',event=>finishLook(event.pointerId));
surface.addEventListener('pointercancel',event=>{
  finishLook(event.pointerId);
  down.delete(event.pointerId);
  if(!down.size) multitouch=false;
});
surface.addEventListener('pointerup',event=>{
  if(firstPerson) {
    const gesture=finishLook(event.pointerId);
    if(gesture&&!gesture.dragged&&!gesture.held&&
      Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)<8){
      interact(pick(event));
    }
    save();
    return;
  }
  const press=down.get(event.pointerId);
  const tap=press&&!multitouch&&!press[2]&&Math.hypot(event.clientX-press[0],event.clientY-press[1])<=7;
  down.delete(event.pointerId);
  if(!down.size) multitouch=false;
  if(!tap||movement) return;
  interact(pick(event));
});
function removePart(part){
  const id=key(part.p);
  if(world.get(id)!==part||movement) return;
  checkpoint();
  if(heldMagnet===part) releaseMagnet();
  if(chosen===id) chosen=null;
  world.delete(id); redraw(); updateUI(); updateAim(); save();
}
function interact(hit) {
  if(movement) return;
  if(placingBody) {
    if(!hit?.foot||!at(world,...hit.foot)){
      $('hint').textContent='Выбери ровную поверхность со свободным местом над ней.';
      return;
    }
    checkpoint();
    [body.x,body.y,body.z]=hit.foot;
    placingBody=false;
    cursor.visible=false;
    updateBodyView(); updateUI(); save();
    return;
  }
  const device=hit?.part;
  const activate=tool==='inspect'||(tool!=='erase'&&isDevice(device));
  if(activate) {
    finishPartEdit();
    if(heldMagnet!==hit?.part) releaseMagnet();
    closedSettings=null;
    chosen=hit?.part?key(hit.part.p):null;
    if(['switch','selector'].includes(device?.type)) switchPart(device);
    if(hit?.part?.type==='button') pressPart(hit.part);

    updateUI();
    if(firstPerson) updateAim();
    else pointerCell(hit?.part&&visualPosition(hit.part));
    return;
  }
  if(tool==='erase'&&hit?.part){
    if(!firstPerson) removePart(hit.part);
    return;
  }
  if(tool!=='erase'&&!blocked(hit?.target)) {
    finishPartEdit();
    releaseMagnet();
    chosen=null;
    checkpoint();
    world.set(key(hit.target),{type:tool,p:hit.target,rot:tool==='wire'?0:rotation});
    redraw(); updateUI(); save();
  } else if(hit&&tool!=='erase') pointerCell(hit.target,true);
}
function updateAim(){
  if(!firstPerson) return;
  const hit=pick();
  if(tool==='inspect'||(tool!=='erase'&&isDevice(hit?.part))){
    cursor.visible=false;
    $('crosshair').classList.toggle('targeted',Boolean(hit?.part));
    return;
  }
  $('crosshair').classList.remove('targeted');
  if(tool==='erase') pointerCell(hit?.part?.p,true);
  else pointerCell(hit?.target,blocked(hit?.target));
}
const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',
  KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
window.addEventListener('keydown',event=>{
  if(event.code==='Escape'&&!$('field-options').hidden){toggleFieldMenu(false);return;}
  const editing=['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName);
  const gripMovement=event.target.closest('#walk-magnet')&&/^Key[WASD]$/.test(event.code);
  if(!firstPerson||$('guide').open||(editing&&!gripMovement)) return;
  const direction=keyMap[event.code];
  if(direction){event.preventDefault();moveKeys.add(direction);}
  if(event.code==='KeyE'&&!event.repeat){interact(pick());updateAim();}
  if(event.code==='Escape') changeView(false);
});
window.addEventListener('keyup',event=>{
  if(moveKeys.delete(keyMap[event.code])) save();
});
const joystick=$('joystick');
let stickPointer=null, stickX=0, stickY=0;
function releaseStick(id){
  if(id!==stickPointer) return;
  stickPointer=null; stickX=stickY=0;
  joystick.firstElementChild.style.transform='';
  save();
}
function resetWalkInput(){
  moveKeys.clear();
  for(const id of look.keys()) finishLook(id);
  if(stickPointer!==null) releaseStick(stickPointer);
}
window.addEventListener('blur',resetWalkInput);
function moveStick(event){
  if(event.pointerId!==stickPointer) return;
  const rect=joystick.getBoundingClientRect(), radius=rect.width*.36;
  const x=(event.clientX-rect.left-rect.width/2)/radius;
  const y=(event.clientY-rect.top-rect.height/2)/radius;
  const length=Math.hypot(x,y);
  const speed=Math.max(0,Math.min(1,(length-.12)/.88));
  stickX=length?x/length*speed:0;
  stickY=length?y/length*speed:0;
  joystick.firstElementChild.style.transform='translate('+stickX*radius+'px,'+stickY*radius+'px)';
}
joystick.addEventListener('pointerdown',event=>{
  if(stickPointer!==null||event.button!==0) return;
  stickPointer=event.pointerId;
  joystick.setPointerCapture(stickPointer);
  moveStick(event);
});
joystick.addEventListener('pointermove',moveStick);
for(const name of ['pointerup','pointercancel','lostpointercapture']){
  joystick.addEventListener(name,event=>releaseStick(event.pointerId));
}
function walking(dt){
  if(!firstPerson||$('guide').open) return;
  const forward=Number(moveKeys.has('forward'))-Number(moveKeys.has('back'))-stickY;
  const right=Number(moveKeys.has('right'))-Number(moveKeys.has('left'))+stickX;
  if(!forward&&!right) return;
  const distance=2.7*dt/Math.max(1,Math.hypot(forward,right));
  const sin=Math.sin(body.yaw),cos=Math.cos(body.yaw);
  const x=body.x,y=body.y,z=body.z;
  moveBody(world,body,(right*cos-forward*sin)*distance,(-right*sin-forward*cos)*distance);
  if(x!==body.x||y!==body.y||z!==body.z){
    if(heldMagnet&&distToMagnet(heldMagnet)>magnetReach) releaseMagnet();
    magnetControls(); updateBodyView();updateAim();
  }
}
const lineStyle={
  wire:new T.LineBasicMaterial({color:0x007e9f}),
  magnet:new T.LineBasicMaterial({color:0x7151a8}),
  coil:new T.LineBasicMaterial({color:0xb35b17})
};
const currentMaterials=new Map();
function lineMaterial(type,opacity){
  if(opacity===1) return lineStyle[type];
  const bucket=Math.round(opacity*32);
  const key=type+'/'+bucket;
  if(!currentMaterials.has(key)){
    currentMaterials.set(key,new T.LineBasicMaterial({
      color:lineStyle[type].color,transparent:true,opacity:bucket/32,depthWrite:false
    }));
  }
  return currentMaterials.get(key);
}
function drawPaths(paths,type,closed,opacity=1) {
  const vertices=[];
  function segment(a,b){vertices.push(...a,...b);}
  for(const path of paths){
    for(let i=1;i<path.length;i++) segment(path[i-1],path[i]);
    if(closed) segment(path.at(-1),path[0]);
    const diameter=new T.Vector3(...path[0]).sub(new T.Vector3(...path[closed?24:path.length-1]));
    const radial=new T.Vector3(...path[closed?12:Math.floor(path.length/2)])
      .sub(new T.Vector3(...path[closed?36:0]));
    const planeNormal=diameter.cross(radial).normalize();
    for(const i of closed?[6,43]:[Math.floor(path.length/2)]){
      const a=new T.Vector3(...path[i-1]), b=new T.Vector3(...path[i]);
      const tangent=b.clone().sub(a).normalize();
      const lateral=new T.Vector3().crossVectors(planeNormal,tangent).normalize().multiplyScalar(.039);
      const base=b.clone().addScaledVector(tangent,-.103);
      segment(base.clone().add(lateral).toArray(),b.toArray());
      segment(base.clone().sub(lateral).toArray(),b.toArray());
    }
  }
  if(!vertices.length) return;
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  const pathsMesh=new T.LineSegments(geometry,lineMaterial(type,opacity));
  pathsMesh.userData.fieldLines=true;
  fieldLayer.add(pathsMesh);
}
const gradientStops=[0x365ccb,0x219ac0,0x15ac83,0xe0a624,0xee633d].map(hex=>new T.Color(hex));
const vectorPalette=Array.from({length:17},(_,i)=>{
  const at=Math.min(3,Math.floor(i/4));
  return new T.LineBasicMaterial({color:gradientStops[at].clone().lerp(gradientStops[at+1],(i-at*4)/4)});
});
function drawVectors(sources){
  const buckets=vectorPalette.map(()=>[]);
  const length=.43;
  for(const point of fieldSamplePoints(density,size)){
    const vector=new T.Vector3(...resultantAt(point,sources));
    const magnitude=vector.length();
    if(magnitude<.003) continue;
    const origin=new T.Vector3(...point);
    const direction=vector.divideScalar(magnitude);
    const tip=origin.clone().addScaledVector(direction,length*.5);
    const base=tip.clone().addScaledVector(direction,-.115);
    const reference=Math.abs(direction.y)>.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
    const width=direction.clone().cross(reference).normalize().multiplyScalar(.053);
    const other=direction.clone().cross(width);
    const tint=Math.min(16,Math.floor(17*Math.log1p(magnitude*1.65)/Math.log(41)));
    const out=buckets[tint];
    out.push(...origin.addScaledVector(direction,-length*.5).toArray(),...tip.toArray());
    for(const side of [width,other]){
      out.push(...base.clone().add(side).toArray(),...tip.toArray(),
        ...base.clone().sub(side).toArray(),...tip.toArray());
    }
  }
  for(const [index,vertices] of buckets.entries()){
    if(!vertices.length) continue;
    const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    const arrows=new T.LineSegments(geometry,vectorPalette[index]);
    arrows.userData.fieldLines=true;
    fieldLayer.add(arrows);
  }
}
function activeWireFlows(){
  const signature=wireNetwork.contacts.map(({part,terminal})=>
    Math.round((part.portCurrents?.[terminal]??part.current??0)*1e5)).join(',');
  if(signature!==flowSignature){
    flowSignature=signature;
    currentFlows=wireFlows(wireNetwork);
  }
  return currentFlows;
}
function animateCharges(dt){
  if(!chargeLayer.visible) return;
  for(const {p,q,flow,dir} of activeWireFlows()){
    const id=key(p)+'/'+key(q);
    let path=chargePaths.get(id);
    if(Math.abs(flow)<.002) continue;
    if(!path){
      const count=Math.round(3*Math.hypot(...q.map((v,i)=>v-p[i])));
      const shape=geometry.electron??=new T.SphereGeometry(.058,8,6);
      const color=materials.electron??=new T.MeshBasicMaterial({color:0x063d64});
      path={phase:.14,dots:Array.from({length:count},()=>mesh(shape,color,chargeLayer,0,0,0))};
      chargePaths.set(id,path);
    }
    path.phase=nextElectronPhase(path.phase,flow,dt);
    for(const [index,dot] of path.dots.entries()){
      const phase=(path.phase+index/path.dots.length)%1;
      const [x,y,z]=p.map((v,i)=>v+(q[i]-v)*phase);
      const vertical=directions[dir][1]!==0;
      dot.position.set(x+(vertical?.085:0),y-(vertical?.28:.16),z);
    }
    renderNeeded=true;
  }
}
function redrawField(magnets){
  fieldLayer.visible=fieldMode==='lines'||fieldMode==='vectors';
  if(!fieldLayer.visible) return;
  const coils=network.branches.map(({part})=>part).filter(part=>isCoil(part)&&Math.abs(part.current)>.002);
  const permanent=magnets.map(({center,axis,strength})=>({center:add(center,[0,-.12,0]),axis,strength}));
  const sliders=network.branches.flatMap(({part})=>part.type==='plunger'?[{
    center:add(part.p,[0,plungerCoilY+Math.round((part.height??plungerRest)*100)/100,0]),
    axis:directions[4],strength:11
  }]:[]);
  const sources=permanent.concat(sliders);
  const currentSignature=wireNetwork.contacts.map(({part,terminal})=>Math.round((part.portCurrents?.[terminal]??part.current??0)*1e5)).join(',');
  if(wireCurrents!==currentSignature){
    wireCurrents=currentSignature; cachedRuns=wireRuns(wireNetwork);
  }
  const runs=cachedRuns;
  const combined=fieldMode==='vectors';
  const signature=JSON.stringify([fieldMode,combined&&density,sources,
    combined?network.branches.map(({part,leg})=>[part.type,part.p,part.rot,part.inductance,Math.round((part.legCurrents?.[leg]??part.current??0)*300)]):
      coils.map(part=>[part.type,part.p,part.rot,coilInductance(part),Math.round(part.current*100)]),
    runs.map(({center,axis,current,start,end})=>combined?[start,end,Math.round(current*300)]:[center,axis,Math.round(current*100)])
  ]);
  if(signature===fieldSignature) return;
  fieldSignature=signature;
  for(const child of fieldLayer.children) child.geometry.dispose();
  fieldLayer.clear();
  if(combined){
    const total=fieldSources(runs,network.branches,sources);
    drawVectors(total);
  } else {
    const wireGroups=new Map();
    for(const run of runs){
      const magnitude=Math.round(run.current*100)/100;
      if(!wireGroups.has(magnitude)) wireGroups.set(magnitude,[]);
      wireGroups.get(magnitude).push(run);
    }
    for(const [magnitude,group] of wireGroups){
      const style=currentLineStyle(magnitude);
      drawPaths(group.flatMap(run=>wireLines(run,style.scale)),'wire',true,style.opacity);
    }
    drawPaths(sources.flatMap(({center,axis})=>dipoleLines(center,axis,false)),'magnet',false);
    for(const part of coils){
      const vertical=part.type==='plunger';
      const axis=directions[vertical?4:part.rot].map(v=>v*Math.sign(part.current));
      const style=currentLineStyle(part.current*windingRatio(part));
      drawPaths(dipoleLines(add(part.p,[0,vertical?plungerCoilY:-.06,0]),axis,true,style.scale),
        'coil',false,style.opacity);
    }
  }
  renderNeeded=true;
}
const format=new Intl.NumberFormat('ru',{minimumFractionDigits:2,maximumFractionDigits:2});
function number(n){return format.format(Math.round((n??0)*100)/100||0);}
function updateInstrumentReadings() {
  const frequencies=new Set(network.branches.flatMap(({part})=>
    part.type==='generator'?[part.frequency??defaultFrequency]:[]));
  const window=frequencies.size===1?Math.round(60/[...frequencies][0]):60;
  for(const {part} of network.branches){
    const display=models.get(key(part.p)).display;
    if(!display) continue;
    const amps=part.type==='ammeter';
    const raw=amps?part.current:part.voltage;
    const samples=part.meterSamples?.slice(-window)??[];
    const value=part.rms?(samples.length>=window?
      Math.sqrt(samples.reduce((sum,v)=>sum+v,0)/samples.length):null):raw;
    const unit=(amps?'A':'V')+(part.rms?' RMS':'');
    const reading=value===null?'…':number(value);
    const text=reading+' '+unit;
    if(display.text===text) continue;
    display.text=text;
    const {canvas,context,texture}=display;
    context.fillStyle='#112b36';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.fillStyle=amps?'#a3f9d8':'#e1d6ff';
    context.textAlign='center';
    context.textBaseline='middle';
    context.font='bold 122px monospace';
    context.fillText(reading,192,93,350);
    context.font='bold 58px monospace';
    context.fillText(unit,192,175);
    texture.needsUpdate=true;
    renderNeeded=true;
  }
  const part=selected(), output=$('detail-value');
  if(!part||!output) return;
  if(part.type==='ammeter'||part.type==='voltmeter'){
    output.textContent=models.get(key(part.p)).display.text;
  } else if(part.type==='switch'||part.type==='button'){
    output.textContent=part.on?'Контакт замкнут':'Контакт разомкнут';
  } else if(part.type==='selector'){
    output.textContent=selectorState(part);
  } else {
    output.textContent='X '+part.p[0]+' · высота '+part.p[1]+' · Z '+part.p[2];
  }
}
const scopeWindow=360;
const scope=$('scope');
const scopeStorageKey='faraday-island-scope-open';
try { scope.open=localStorage.getItem(scopeStorageKey)==='true'; } catch {}
scope.addEventListener('toggle',()=>{
  try { localStorage.setItem(scopeStorageKey,String(scope.open)); } catch {}
  drawScope();
});
const scopePlot=$('scope-plot');
const scopeContext=scopePlot.getContext('2d');
function updateScope(){
  const picked=selected();
  const part=tool==='inspect'&&!placingBody&&electrical.has(picked?.type)?picked:null;
  scope.hidden=!part;
  if(part===scopePart) return;
  scopePart=part;
  scopeSamples.length=0;
  if(!part) return;
  $('scope-title').textContent='График · '+ui[part.type][0];
  $('scope-voltage-label').textContent=part.type==='wire'?'Потенциал узла':
    part.type==='plunger'&&mode==='induction'?'ЭДС индукции':'Напряжение';
  $('scope-current-label').textContent=part.type==='wire'?'Ток участка':'Ток';
  drawScope();
}
function strongestWireCurrent(p){
  let selectedFlow=0;
  for(const {p:start,q:end,dir,flow} of activeWireFlows()){
    if((key(start)===key(p)||key(end)===key(p))&&Math.abs(flow)>Math.abs(selectedFlow)+1e-8){
      selectedFlow=flow*Math.sign(directions[dir].find(Boolean));
    }
  }
  return selectedFlow;
}
function sampleScope(){
  const part=scopePart;
  if(!part) return;
  let voltage=part.voltage??0, current=part.current??0;
  if(part.type==='wire') current=strongestWireCurrent(part.p);
  if(part.type==='plunger'&&mode==='induction') voltage=part.emf??0;
  if(part.type==='selector'){
    const [a,b,common]=terminals(part), active=part.on?a:b;
    voltage=(part.portVoltages?.[common]??0)-(part.portVoltages?.[active]??0);
    current=part.portCurrents?.[common]??0;
  }
  scopeSamples.push([voltage,current]);
  if(scopeSamples.length>scopeWindow) scopeSamples.shift();
}
function drawScope(){
  if(scope.hidden||!scope.open) return;
  const ctx=scopeContext, {width,height}=scopePlot, middle=height/2;
  ctx.fillStyle='#eff6f8';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#a8bfc8';ctx.lineWidth=1;ctx.beginPath();
  for(let i=0;i<=6;i++){const x=i*width/6;ctx.moveTo(x,0);ctx.lineTo(x,height);}
  ctx.moveTo(0,middle);ctx.lineTo(width,middle);ctx.stroke();
  const limits=[1,.2];
  for(const row of scopeSamples) row.forEach((v,i)=>{limits[i]=Math.max(limits[i],Math.abs(v??0));});
  limits.forEach((limit,channel)=>{
    ctx.lineWidth=3;ctx.strokeStyle=['#275cbe','#9d4a17'][channel];
    ctx.setLineDash(channel===1?[8,5]:[]);ctx.beginPath();
    let started=false;
    scopeSamples.forEach((row,i)=>{
      const value=row[channel];
      if(value===null){started=false;return;}
      const x=(width-1)*(scopeWindow-scopeSamples.length+i)/(scopeWindow-1);
      const y=middle-value/limit*(middle-7);
      if(started) ctx.lineTo(x,y);
      else ctx.moveTo(x,y);
      started=true;
    });
    ctx.stroke();
  });
  ctx.setLineDash([]);
  $('scope-scale').textContent='±'+number(limits[0])+' В · ±'+number(limits[1])+' А · 6 с';
}
function resize(){
  const {clientWidth:w,clientHeight:h}=$('view');
  if(!w||!h) return;
  const span=Math.max(13.8,17.1*h/w);
  camera.left=-span*w/h/2; camera.right=-camera.left;
  camera.top=span/2; camera.bottom=-camera.top; camera.updateProjectionMatrix();
  eyes.aspect=w/h; eyes.updateProjectionMatrix();
  renderer.setSize(w,h,false); renderNeeded=true;
}
const initial={mode:'circuit',showField:false,parts:preset('circuit')};
let data=initial;
try {
  const stored=JSON.parse(localStorage.getItem(storageKey));
  if(stored&&Object.hasOwn(experiments,stored.mode)&&Array.isArray(stored.parts)&&
    stored.parts.every(p=>(Object.hasOwn(ui,p.type)||p.type==='potentiometer')&&p.type!=='inspect'&&p.p?.length===3&&
      p.p.every(Number.isInteger)&&inside(p.p)&&[0,1,2,3].includes(p.rot))) {
    data={...stored,parts:stored.parts.map(part=>{
      if(part.type!=='potentiometer') return part;
      const isDemo=stored.mode==='alternating'&&key(part.p)==='3,1,5'&&part.rot===1;
      const value=isDemo?(part.value??12)*(part.wiper??35)/100:part.value??100;
      return {type:'resistor',p:part.p,rot:part.rot,value:Math.max(1,Math.min(100,Math.round(value)))};
    })};
    const byCell=new Map(data.parts.map(p=>[key(p.p),p]));
    const matches=parts=>parts.length===byCell.size&&parts.every(part=>byCell.get(key(part.p))?.type===part.type);
    if(['alternating','oscillation'].includes(stored.mode)&&matches(preset(stored.mode,{raisedMeter:true}))){
      const previousDevices=new Map(data.parts.filter(part=>isDevice(part)).map(part=>[part.type,part]));
      data.parts=preset(stored.mode).map(part=>{
        const old=previousDevices.get(part.type);
        return old?{...old,p:part.p}:part;
      });
    } else if(stored.mode==='induction'&&matches(preset('old-induction'))){
      data={...stored,parts:preset('induction')};
    } else if(['circuit','induction','powered'].includes(stored.mode)&&matches(preset(stored.mode,{meters:false}))){
      data={...stored,parts:preset(stored.mode).map(part=>{
        const previous=byCell.get(key(part.p));
        return previous?.type===part.type?previous:part;
      })};
    }
  }
} catch {}
restore(data);
orientationHint();
resize(); new ResizeObserver(resize).observe($('view'));
$('loading').hidden=true;
let previous=performance.now(), fieldFrame=0;
renderer.setAnimationLoop(now=>{
  accumulator+=Math.min(.1,Math.max(0,(now-previous)/1000)); previous=now;
  while(accumulator>=simulationStep){
    accumulator-=simulationStep;
    walking(simulationStep);
    if(movement){
      const {part,start,target}=movement;
      movement.t+=simulationStep;
      const u=Math.min(1,movement.t/1.12), smooth=u*u*(3-2*u);
      part.shift=start+(target-start)*smooth;
      const model=models.get(key(part.p));
      model.group.position.x=model.hit.position.x=part.p[0]+part.shift;
      if(chosen===key(part.p)&&!firstPerson) pointerCell(visualPosition(part));
      if(u===1){movement=null;updateUI();save();}
    }
    for(const [part,time] of activeButtons){
      if(world.get(key(part.p))!==part||time<=simulationStep){
        part.on=false;activeButtons.delete(part);renderNeeded=true;
      } else activeButtons.set(part,time-simulationStep);
    }
    const magnets=magnetData();
    for(let i=0;i<4;i++) step(network,electricalStep,magnets);
    for(const {part} of network.branches){
      if(isCoil(part)) animateWindingCharges(part,models.get(key(part.p)),simulationStep);
      if(!isMeter(part)) continue;
      const value=(part.type==='ammeter'?part.current:part.voltage)??0;
      const samples=part.meterSamples??=[];
      samples.push(value*value);
      if(samples.length>240) samples.shift();
    }
    sampleScope();
    animateCharges(simulationStep);
  }
  for(const {part} of network.branches) {
    if(part.type==='lamp'){
      const model=models.get(key(part.p));
      const brightness=Math.round(lampBrightness(part.current??0)*100)/100;
      if(model.brightness!==brightness){
        model.brightness=brightness;
        model.glow.color.copy(bulbOff).lerp(bulbOn,brightness);
        model.glow.emissiveIntensity=brightness*1.2;
        model.halo.visible=brightness>.015;
        model.halo.material.opacity=brightness*.83;
        model.halo.scale.setScalar(.62+1.45*brightness);
        renderNeeded=true;
      }
    }
    if(part.type==='plunger'){
      const model=models.get(key(part.p));
      const y=plungerCoilY+plungerRest+Math.round((part.height-plungerRest)*1000)/1000;
      if(model.slider.position.y!==y){
        model.slider.position.y=y;
        model.handleHit.position.y=part.p[1]+y;
        renderNeeded=true;
      }
    }
    if(part.type==='switch') models.get(key(part.p)).lever.rotation.z=part.on?0:.7;
    if(part.type==='selector') models.get(key(part.p)).selectorArm.rotation.y=part.on?-.675:.675;
    if(part.type==='capacitor') updatePlateCharges(part,models.get(key(part.p)));
    if(part.type==='button') models.get(key(part.p)).plunger.position.y=part.on?-.18:-.11;
  }
  if(movement) renderNeeded=true;
  if(fieldDirty||(fieldLayer.visible&&++fieldFrame%(fieldMode==='vectors'?7:4)===0)){
    redrawField(magnetData());fieldDirty=false;
  }
  if(now-lastReadings>65){updateInstrumentReadings(); drawScope(); lastReadings=now;}
  controls.update();
  if(renderNeeded){renderer.render(scene,activeCamera());renderNeeded=false;}
});
