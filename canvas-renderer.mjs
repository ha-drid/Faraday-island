import * as T from 'three';

// Software fallback for devices without a WebGL 2 context.
export class IslandCanvas {
  constructor(canvas) {
    this.domElement=canvas;
    this.ctx=canvas.getContext('2d');
    this.ratio=1;
    this.colorCache=new Map();
    this.direction=new T.Vector3(-.43,.79,.45).normalize();
  }
  setPixelRatio(ratio) { this.ratio=Math.min(1.25,ratio); }
  setSize(width,height) {
    this.domElement.width=width*this.ratio;
    this.domElement.height=height*this.ratio;
  }
  setAnimationLoop(fn) {
    let last=-Infinity;
    const tick=time=>{
      if(time-last>=30){fn(time);last=time;}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  render(scene,camera) {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const {ctx,domElement}=this, width=domElement.width, height=domElement.height;
    ctx.clearRect(0,0,width,height);
    const matrix=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const v=new T.Vector4(), worldNormal=new T.Vector3(), modelView=new T.Matrix4();
    const faces=[], cursors=[];
    function transform(x,y,z,matrix) {
      v.set(x,y,z,1).applyMatrix4(matrix);
      return [v.x,v.y,v.z,v.w];
    }
    function project([x,y,z,w]){
      return [(x/w+1)*width/2,(1-y/w)*height/2,z/w];
    }
    function nearClip(points){
      if(!camera.isPerspectiveCamera) return points;
      const output=[];
      let a=points.at(-1);
      for(const b of points){
        const da=a[2]+a[3], db=b[2]+b[3];
        if((da>=0)!==(db>=0)){
          output.push(a.map((v,i)=>v+(b[i]-v)*da/(da-db)));
        }
        if(db>=0) output.push(b);
        a=b;
      }
      return output;
    }
    if(camera.isOrthographicCamera){
      const [sx,sy]=project(transform(5.7,-1.35,4.8,matrix));
      const shadow=ctx.createRadialGradient(sx,sy,0,sx,sy,width*.41);
      shadow.addColorStop(0,'#234e6577'); shadow.addColorStop(.68,'#31577638');
      shadow.addColorStop(1,'#31577600');
      ctx.save();
      ctx.translate(sx,sy);ctx.scale(1,.49);ctx.translate(-sx,-sy);
      ctx.fillStyle=shadow;ctx.fillRect(sx-width*.42,sy-width*.42,width*.84,width*.84);
      ctx.restore();
    }
    scene.traverseVisible(object=>{
      const {geometry,material}=object;
      if(!geometry||!material?.visible||material.map&&!material.map.image) return;
      if(object.isSprite){
        const origin=object.getWorldPosition(new T.Vector3());
        const at=transform(origin.x,origin.y,origin.z,matrix);
        if(at[2]+at[3]<=0) return;
        const radius=object.scale.x/2;
        const cameraRight=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
        const edge=origin.clone().addScaledVector(cameraRight,radius);
        const point=project(at);
        const pixels=Math.abs(project(transform(edge.x,edge.y,edge.z,matrix))[0]-point[0]);
        faces.push({points:[point],depth:point[2]+.001,halo:material.map.image,pixels,alpha:material.opacity});
        return;
      }
      modelView.multiplyMatrices(matrix,object.matrixWorld);
      const positions=geometry.attributes.position;
      if(!positions) return;
      const positionsInClip=Array.from({length:positions.count},(_,i)=>
        transform(positions.getX(i),positions.getY(i),positions.getZ(i),modelView));
      if(object.isLine||object.isLineSegments) {
        for(let i=1;i<positionsInClip.length;i+=object.isLineSegments?2:1){
          let a=positionsInClip[i-1], b=positionsInClip[i];
          const da=a[2]+a[3], db=b[2]+b[3];
          if(camera.isPerspectiveCamera){
            if(da<0&&db<0) continue;
            if(da<0||db<0){
              const point=a.map((v,i)=>v+(b[i]-v)*da/(da-db));
              if(da<0) a=point;
              else b=point;
            }
          }
          const points=[project(a),project(b)];
          const item={points,depth:(points[0][2]+points[1][2])/2,color:'#'+material.color.getHexString(),line:true,alpha:material.opacity,
            width:object.userData.fieldLines?1.8:1.4};
          (object.renderOrder>0?cursors:faces).push(item);
        }
        return;
      }
      if(material.map) {
        if(geometry.parameters.width>1||positionsInClip.some(p=>p[2]+p[3]<=0)) return;
        const [a,b,c,d]=positionsInClip.map(project);
        if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<=0) return;
        const bias=object.userData.meterScreen?.0008:.002;
        faces.push({points:[a,b,c],depth:(a[2]+b[2]+c[2]+d[2])/4-bias,image:material.map.image});
        return;
      }
      const box=geometry.type==='BoxGeometry', index=geometry.index?.array;
      const indices=index??positions.array;
      for(let j=0;j<indices.length;j+=box?6:3){
        const ia=index?index[j]:j/3, ib=index?index[j+1]:j/3+1, ic=index?index[j+2]:j/3+2;
        const faceIndices=box?[ia,ib,index[j+4],ic]:[ia,ib,ic];
        const points=nearClip(faceIndices.map(i=>positionsInClip[i])).map(project);
        if(points.length<3) continue;
        const [a,b,c]=points;
        if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>=0) continue;
        const n=geometry.attributes.normal;
        if(object.userData.coveredTop&&n.getY(ia)>0) continue;
        worldNormal.set(n.getX(ia),n.getY(ia),n.getZ(ia)).transformDirection(object.matrixWorld);
        const level=Math.round((.69+.30*Math.max(0,worldNormal.dot(this.direction))+.08*Math.max(0,worldNormal.y))*20)/20;
        const glow=material.emissive?.getHex()?Math.round(Math.min(1,material.emissiveIntensity*.7)*16)/16:0;
        const base=material.color.getHex();
        const id=base+'/'+level+'/'+glow;
        let color=this.colorCache.get(id);
        if(!color){
          const shade=new T.Color(base).multiplyScalar(level);
          if(glow&&material.emissive) shade.lerp(new T.Color(0xfff39a),glow);
          color='#'+shade.getHexString();this.colorCache.set(id,color);
        }
        const depth=points.reduce((s,p)=>s+p[2],0)/points.length;
        faces.push({points,depth,color,alpha:material.opacity});
      }
    });
    faces.sort((a,b)=>b.depth-a.depth);
    for(const item of faces.concat(cursors)){
      const {points,color,image,line}=item;
      if(item.halo){
        const [[x,y]]=points, radius=item.pixels;
        ctx.globalAlpha=item.alpha;
        ctx.drawImage(item.halo,x-radius,y-radius,radius*2,radius*2);
        ctx.globalAlpha=1;continue;
      }
      if(image){
        const [a,b,c]=points;
        ctx.setTransform((b[0]-a[0])/image.width,(b[1]-a[1])/image.width,
          (c[0]-a[0])/image.height,(c[1]-a[1])/image.height,a[0],a[1]);
        ctx.drawImage(image,0,0);ctx.resetTransform();continue;
      }
      ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
      for(const p of points.slice(1)) ctx.lineTo(p[0],p[1]);
      ctx.strokeStyle=ctx.fillStyle=color;
      if(line){ctx.globalAlpha=item.alpha;ctx.lineWidth=item.width;ctx.stroke();ctx.globalAlpha=1;continue;}
      ctx.closePath();
      ctx.globalAlpha=item.alpha;
      ctx.fill();
      if(item.alpha===1){ctx.lineWidth=.5;ctx.stroke();}
      ctx.globalAlpha=1;
    }
  }
}
