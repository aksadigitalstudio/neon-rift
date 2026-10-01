(()=>{
// All assets are procedural. World coordinates use X/Z for the flight deck.
const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const CYAN = 0x78eaff, RED = 0xff3658, VIOLET = 0xa68aff;
const BOUNDS = { x: 21, z: 17 };
const keys = new Set(), mouse = new THREE.Vector2(0, 0), aim = new THREE.Vector3(0, 1, -10);
let state = 'title', time = 0, gameTime = 0, score = 0, wave = 0, kills = 0;
let best = 0, soundEnabled = true, firing = false, mouseActive = false;
let spawnLeft = 0, spawnTimer = 0, nextWave = 0, announcementUntil = 0, toastUntil = 0;
let shake = 0, flash = 0, hudTimer = 0, frameCount = 0, fpsTime = 0, fps = 60;
let scorePulse = 0;
let hostileShots = 0;
let audioContext, audioMaster;
try { best = Number(localStorage.getItem('neon-rift-best')) || 0; soundEnabled = localStorage.getItem('neon-rift-sound') !== 'off'; } catch {}
$('best').textContent = formatScore(best);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030812);
const camera = new THREE.OrthographicCamera(-35, 35, 25, -25, .1, 500);
const target = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, 43, 31);
camera.position.copy(cameraOffset); camera.lookAt(target);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas: $('viewport'), antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
} catch (error) {
  $('error').classList.remove('hidden');
  $('error').textContent = 'Neon Rift needs WebGL 2. Please open it in a current desktop browser with hardware acceleration enabled.';
  throw error;
}
const raycaster = new THREE.Raycaster(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
const mat = (color, emissive = 0x000000, intensity = 1) => new THREE.MeshStandardMaterial({color, emissive, emissiveIntensity:intensity, metalness:.65, roughness:.43});
const armor = mat(0x222d3b), darkArmor = mat(0x101822), edgeMetal = mat(0x344357);
const cyanMat = new THREE.MeshBasicMaterial({color:CYAN});
const redMat = new THREE.MeshBasicMaterial({color:RED});
const whiteMat = new THREE.MeshBasicMaterial({color:0xecffff});
const violetMat = new THREE.MeshBasicMaterial({color:VIOLET});
const boxGeo = new THREE.BoxGeometry(1,1,1), octGeo = new THREE.OctahedronGeometry(1), sphereGeo = new THREE.SphereGeometry(1,16,10);
const ringGeo = new THREE.RingGeometry(.86,1,48), particleGeo = new THREE.IcosahedronGeometry(1,0);
const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
const glowCtx = glowCanvas.getContext('2d'), grad = glowCtx.createRadialGradient(32,32,0,32,32,32);
grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(.12,'rgba(255,255,255,.8)'); grad.addColorStop(.4,'rgba(255,255,255,.15)');grad.addColorStop(1,'rgba(255,255,255,0)');
glowCtx.fillStyle = grad;glowCtx.fillRect(0,0,64,64);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
const glowMats = new Map();
function glow(color, size, parent, x=0,y=0,z=0){
  if(!glowMats.has(color)) glowMats.set(color,new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  const sprite = new THREE.Sprite(glowMats.get(color));sprite.scale.set(size,size,1);sprite.position.set(x,y,z);parent.add(sprite);return sprite;
}
function box(parent, material, x,y,z,sx,sy,sz){const mesh = new THREE.Mesh(boxGeo,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
function ring(parent, color, radius, x=0,y=.03,z=0,opacity=.6){
  const mesh = new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;mesh.scale.setScalar(radius);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
scene.add(new THREE.HemisphereLight(0xaacaff,0x17233b,2.4));
const keyLight = new THREE.DirectionalLight(0xc3e3ff,2.2);keyLight.position.set(-10,25,15);scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8170ff,1.8);rimLight.position.set(15,8,-22);scene.add(rimLight);
const playerLight = new THREE.PointLight(CYAN,13,11,2);scene.add(playerLight);

// Orbital backdrop: layered planet, star field, debris and long station outriggers.
const planetMat = new THREE.ShaderMaterial({uniforms:{lightDir:{value:new THREE.Vector3(-.5,.8,.6).normalize()}},vertexShader:`varying vec3 n; varying vec3 p; void main(){n=normalize(normalMatrix*normal);p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 n;varying vec3 p;uniform vec3 lightDir;void main(){float l=max(0.,dot(normalize(n),lightDir));float clouds=sin(p.x*.16+sin(p.y*.25)*3.)*sin(p.z*.21+p.y*.09);vec3 c=mix(vec3(.008,.015,.035),vec3(.065,.10,.19),pow(l,1.8));c+=vec3(.025,.019,.07)*clouds*l;float rim=pow(1.-abs(n.z),3.);c+=vec3(.03,.075,.16)*rim;gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
const planet = new THREE.Mesh(new THREE.SphereGeometry(41,64,48),planetMat);planet.position.set(-24,-42,-54);scene.add(planet);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(42.1,48,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 v;void main(){float a=pow(1.-abs(dot(n,v)),4.);gl_FragColor=vec4(.14,.19,.65,a*.45);}`}));atmo.position.copy(planet.position);scene.add(atmo);
const starPositions=[];
for(let i=0;i<750;i++)starPositions.push((Math.random()-.5)*240,(Math.random()-.5)*110-15,-70-Math.random()*80);
const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x9ebae4,size:1.1,transparent:true,opacity:.55,sizeAttenuation:false}));scene.add(stars);
const dustPositions=[];
for(let i=0;i<75;i++)dustPositions.push((Math.random()-.5)*48,2+Math.random()*8,(Math.random()-.5)*42);
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x7bb4d7,size:1.2,transparent:true,opacity:.3,sizeAttenuation:false,depthWrite:false}));scene.add(dust);
const debris=[];
for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(boxGeo,armor);const side=i%2?1:-1;
  mesh.position.set(side*(28+Math.random()*32),-5-Math.random()*15,(Math.random()-.5)*80);
  mesh.scale.set(1+Math.random()*3,.3+Math.random(),.7+Math.random()*3);mesh.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);scene.add(mesh);debris.push(mesh);
}
const arena = new THREE.Group();scene.add(arena);
const floorShape=new THREE.Shape();const corners=[[-19,-18],[19,-18],[22,-15],[22,15],[19,18],[-19,18],[-22,15],[-22,-15]];
corners.forEach(([x,z],i)=>i?floorShape.lineTo(x,z):floorShape.moveTo(x,z));floorShape.closePath();
const platform=new THREE.Mesh(new THREE.ExtrudeGeometry(floorShape,{depth:1,bevelEnabled:true,bevelSize:.22,bevelThickness:.22,bevelSegments:1,steps:1}),mat(0x101a2b));
platform.rotation.x=-Math.PI/2;platform.position.y=-1.35;arena.add(platform);
const floorMat=new THREE.ShaderMaterial({vertexShader:`varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 p;void main(){vec2 q=abs(fract((p+1.5)/3.)-.5);float line=1.-smoothstep(.003,.014,min(q.x,q.y));float panel=step(.03,min(q.x,q.y));float d=length(p);vec3 c=vec3(.028,.047,.076)+line*vec3(.014,.08,.10);c+=panel*vec3(.003,.006,.01);c+=vec3(.005,.02,.024)*max(0.,1.-d/22.);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
const deck=new THREE.Mesh(new THREE.ShapeGeometry(floorShape),floorMat);deck.rotation.x=-Math.PI/2;deck.position.y=.01;arena.add(deck);
// Inset tile seams, perimeter conduits and anchored energy barriers.
for(let z=-15;z<=15;z+=6)for(let x=-18;x<=18;x+=6){
  if(Math.abs(x)<7&&Math.abs(z)<7)continue;
  box(arena,edgeMetal,x,.028,z,4.9,.025,.025);box(arena,edgeMetal,x-2.45,.028,z+.65,.025,.025,1.3);
  box(arena,mat(0x0b1420),x+1.6,.035,z+.8,.65,.025,.35);
}
const centerRing=ring(arena,0x5db8cf,6.2,0,.045,0,.28);ring(arena,0x53748c,5.75,0,.046,0,.18);ring(arena,0x53748c,2.9,0,.045,0,.12);
for(let i=0;i<32;i++){const a=i/32*Math.PI*2;const tick=box(arena,i%4?edgeMetal:cyanMat,Math.sin(a)*6.4,.05,Math.cos(a)*6.4,.045,.03,i%4?.23:.65);tick.rotation.y=a;}
const markCanvas=document.createElement('canvas');markCanvas.width=512;markCanvas.height=256;const mc=markCanvas.getContext('2d');
mc.textAlign='center';mc.fillStyle='#304a61';mc.font='bold 120px Arial';mc.fillText('07',256,144);mc.fillStyle='#42627a';mc.font='16px monospace';mc.fillText('ORBITAL COMBAT STATION',256,190);
const marking=new THREE.Mesh(new THREE.PlaneGeometry(6,3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(markCanvas),transparent:true,depthWrite:false}));marking.rotation.x=-Math.PI/2;marking.position.set(0,.055,0);arena.add(marking);
const barriers=[];
for(let i=0;i<corners.length;i++){
  const [x1,z1]=corners[i],[x2,z2]=corners[(i+1)%8];const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),a=Math.atan2(dx,dz);
  const rail=box(arena,cyanMat,(x1+x2)/2,.16,(z1+z2)/2,.08,.08,len);rail.rotation.y=a;
  const outer=box(arena,edgeMetal,(x1+x2)/2,-.6,(z1+z2)/2,.65,.7,len);outer.rotation.y=a;
  const barrier=new THREE.Mesh(new THREE.PlaneGeometry(len,1.6),new THREE.MeshBasicMaterial({color:0x398eb3,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false}));barrier.position.set((x1+x2)/2,.95,(z1+z2)/2);barrier.rotation.y=Math.atan2(-dz,dx);arena.add(barrier);barriers.push(barrier);
  const intervals=Math.ceil(len/6);
  for(let j=0;j<=intervals;j++){const x=x1+dx*j/intervals,z=z1+dz*j/intervals;box(arena,darkArmor,x,.7,z,.55,1.5,.55);box(arena,cyanMat,x,1.46,z,.3,.06,.3);glow(CYAN,1.6,arena,x,1.48,z);}
}
for(const side of [-1,1]){
  for(let i=0;i<3;i++){
    const x=side*(25+i*2.4);box(scene,armor,x,-1.7,6,1.7,.8,19);box(scene,darkArmor,x,-1.25,6,1.2,.15,17);
    for(let j=-2;j<3;j++)box(scene,edgeMetal,x,-1.1,j*3.8+6,1.2,.2,.12);
  }
  const tower=new THREE.Group();box(tower,armor,0,0,0,2.3,4,2.3);box(tower,edgeMetal,0,2.5,0,.6,2,.6);box(tower,violetMat,0,3.6,0,.2,.18,.2);glow(VIOLET,2,tower,0,3.6,0);tower.position.set(side*26,0,-15);scene.add(tower);
}

// NR-01 interceptor: bevelled delta hull, raised cockpit, twin propulsion cores.
function makePlayer(){
  const group=new THREE.Group();
  const shape=new THREE.Shape();shape.moveTo(0,-1.55);shape.lineTo(1.18,.95);shape.lineTo(.4,.65);shape.lineTo(0,1.05);shape.lineTo(-.4,.65);shape.lineTo(-1.18,.95);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:true,bevelSize:.09,bevelThickness:.09,bevelSegments:1,steps:1});
  const hull=new THREE.Mesh(geometry,armor);hull.rotation.x=Math.PI/2;group.add(hull);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0x6894af,transparent:true,opacity:.7}));edges.rotation.copy(hull.rotation);group.add(edges);
  const cockpit=new THREE.Mesh(new THREE.ConeGeometry(.3,1.1,4),mat(0x143949,CYAN,.4));cockpit.rotation.x=-Math.PI/2;cockpit.rotation.z=Math.PI/4;cockpit.position.set(0,.25,-.25);group.add(cockpit);
  box(group,cyanMat,0,.05,-1.4,.085,.06,.3);
  const engines=[];
  for(const x of [-.6,.6]){
    box(group,darkArmor,x,0,.68,.32,.3,.5);box(group,cyanMat,x,.03,.96,.24,.15,.08);
    const exhaust=new THREE.Mesh(new THREE.ConeGeometry(.14,.8,8),new THREE.MeshBasicMaterial({color:0x49d9ff,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));exhaust.rotation.x=Math.PI/2;exhaust.position.set(x,0,1.36);group.add(exhaust);engines.push(exhaust);glow(CYAN,1.7,group,x,0,1.1);
  }
  const muzzle=glow(0xffffff,1.7,group,0,0,-1.55);muzzle.visible=false;
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.25,24),new THREE.MeshBasicMaterial({color:0x030711,transparent:true,opacity:.5,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const shield=new THREE.Mesh(new THREE.SphereGeometry(1.65,20,14),new THREE.MeshBasicMaterial({color:VIOLET,wireframe:true,transparent:true,opacity:.16,depthWrite:false}));shield.visible=false;group.add(shield);
  group.position.set(0,1.1,5);scene.add(group);return {group,hull,engines,muzzle,shadow,shield,velocity:new THREE.Vector2(),health:100,invulnerable:0,rapid:0,shieldTime:0,cooldown:0,muzzleTime:0,angle:0};
}
const player=makePlayer();
const enemies=[], bullets=[], pickups=[], shockwaves=[];
const hostileGeo=new THREE.OctahedronGeometry(.66,0);
const enemyFinGeo=new THREE.ConeGeometry(.25,.8,3);
const enemyCrownGeo=new THREE.TorusGeometry(.51,.06,4,8);
const projectileGeo=new THREE.BoxGeometry(.11,.11,.85);
const hostileShotGeo=new THREE.SphereGeometry(.18,8,6);
const pickupCoreGeo=new THREE.OctahedronGeometry(.4);
const particleMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
const MAX_PARTICLES=500;
const particleMesh=new THREE.InstancedMesh(particleGeo,particleMaterial,MAX_PARTICLES);particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particleMesh.frustumCulled=false;scene.add(particleMesh);
const particles=Array.from({length:MAX_PARTICLES},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:.1,max:1}));
const dummy=new THREE.Object3D(), colorTemp=new THREE.Color();let particleCursor=0;
for(let i=0;i<MAX_PARTICLES;i++){dummy.scale.setScalar(0);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,colorTemp.set(CYAN));}
function burst(pos,color,count=22,power=5){
  for(let i=0;i<count;i++){
    const index=particleCursor++%MAX_PARTICLES,p=particles[index],a=Math.random()*Math.PI*2,s=power*(.3+Math.random()*.7);
    Object.assign(p,{x:pos.x,y:pos.y,z:pos.z,vx:Math.sin(a)*s,vy:(Math.random()-.25)*s,vz:Math.cos(a)*s,life:.35+Math.random()*.65,size:.035+Math.random()*.12});p.max=p.life;particleMesh.setColorAt(index,colorTemp.set(color));
  }
  particleMesh.instanceColor.needsUpdate=true;
}
function shock(pos,color,size=4){
  const mesh=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(pos);mesh.position.y=.12;scene.add(mesh);shockwaves.push({mesh,life:.55,max:.55,size});
}
function announce(title,sub,duration=2.3){$('announcement-title').textContent=title;$('announcement-small').textContent=sub;$('announcement').classList.add('show');announcementUntil=time+duration;}
function toast(text,color='#78eaff'){ $('toast').textContent=text;$('toast').style.color=color;$('toast').classList.add('show');toastUntil=time+2; }
function formatScore(value){return Math.floor(value).toString().padStart(6,'0');}
function addScore(points){score+=points;scorePulse=.25;}

function initAudio(){
  try {if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();audioMaster=audioContext.createGain();audioMaster.gain.value=soundEnabled?.19:0;audioMaster.connect(audioContext.destination);}if(audioContext.state==='suspended')audioContext.resume();}catch{}
}
function tone(freq,duration,type='sine',volume=.2,endFreq=freq){
  if(!soundEnabled||!audioContext)return;
  const now=audioContext.currentTime,o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),now+duration);g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(audioMaster);o.start(now);o.stop(now+duration);o.onended=()=>{o.disconnect();g.disconnect();};
}
function explosionSound(heavy=false){tone(heavy?90:155,heavy?.5:.22,'sawtooth',heavy?.4:.2,25);}
function updateSound(){ $('sound-waves').style.display=soundEnabled?'':'none';$('sound').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');if(audioMaster)audioMaster.gain.value=soundEnabled?.19:0;try{localStorage.setItem('neon-rift-sound',soundEnabled?'on':'off');}catch{} }
updateSound();

function makeEnemy(type,x,z){
  const group=new THREE.Group();const scale=type==='heavy'?1.5:type==='strafer'?.9:.8;
  const ownMaterial=darkArmor.clone();
  const body=new THREE.Mesh(hostileGeo,ownMaterial);body.scale.set(1.15,.8,1.15);body.rotation.y=Math.PI/4;group.add(body);
  const core=new THREE.Mesh(octGeo,redMat);core.scale.set(.26,.26,.26);core.position.y=.35;group.add(core);glow(RED,1.9,group,0,.35,0);
  const fins=[];
  if(type==='heavy'){
    for(const side of [-1,1]){const wing=box(group,ownMaterial,side*.72,0,0,.45,.48,1.4);wing.rotation.z=side*.2;fins.push(wing);box(group,redMat,side*.74,.28,-.32,.12,.04,.65);}
    const crown=new THREE.Mesh(enemyCrownGeo,edgeMetal);crown.rotation.x=Math.PI/2;crown.position.y=.22;group.add(crown);
  } else if(type==='strafer') {
    for(const side of [-1,1]){const fin=box(group,ownMaterial,side*.72,0,.15,.9,.15,.4);fin.rotation.y=side*.65;fins.push(fin);box(group,redMat,side*.95,.04,.1,.08,.08,.25);}
  } else {
    for(const side of [-1,1]){const fin=new THREE.Mesh(enemyFinGeo,ownMaterial);fin.rotation.x=-Math.PI/2;fin.position.set(side*.55,0,-.25);group.add(fin);fins.push(fin);}
  }
  group.scale.setScalar(scale);group.position.set(x,1.1,z);scene.add(group);
  const hp=(type==='heavy'?6:type==='strafer'?3:2)+Math.floor((wave-1)/5);
  const enemy={group,body,core,material:ownMaterial,type,hp,maxHp:hp,radius:type==='heavy'?1.15:.7,speed:(type==='heavy'?2.1:type==='strafer'?3.3:3.6)*Math.min(1.85,1+wave*.035),fireTimer:1.5+Math.random()*2,flash:0,phase:Math.random()*Math.PI*2,spawnTime:.65};
  enemies.push(enemy);shock(group.position,RED,1.6);return enemy;
}
function spawnEnemy(){
  let x,z;for(let tries=0;tries<25;tries++){
    const side=Math.floor(Math.random()*4);x=side<2?(side===0?-20:20):(Math.random()-.5)*38;z=side>=2?(side===2?-16:16):(Math.random()-.5)*30;
    if(Math.hypot(x-player.group.position.x,z-player.group.position.z)>10)break;
  }
  // The opposite corner is always safely outside the immediate player area.
  if(Math.hypot(x-player.group.position.x,z-player.group.position.z)<=10){x=player.group.position.x>0?-20:20;z=player.group.position.z>0?-16:16;}
  const roll=Math.random();const type=wave>=3&&roll<.22?'heavy':wave>=2&&roll<.52?'strafer':'chaser';
  makeEnemy(type,x,z);
}
function startWave(){wave++;spawnLeft=Math.min(34,4+wave*2);spawnTimer=.5;nextWave=0;announce(`WAVE ${String(wave).padStart(2,'0')}`,wave===1?'HOSTILE SIGNALS DETECTED':'COMBAT SYSTEMS ENGAGED');tone(280,.35,'sine',.3,440);}
function fireShot(hostile=false,enemy=null){
  if(hostile)hostileShots++;
  const source=hostile?enemy.group.position:player.group.position;
  let dx,dz;
  if(hostile){dx=player.group.position.x-source.x;dz=player.group.position.z-source.z;}else{dx=-Math.sin(player.angle);dz=-Math.cos(player.angle);}
  const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
  const mesh=new THREE.Mesh(hostile?hostileShotGeo:projectileGeo,hostile?redMat:whiteMat);
  mesh.position.set(source.x+dx*(hostile?1:1.5),1.12,source.z+dz*(hostile?1:1.5));mesh.rotation.y=Math.atan2(dx,dz);
  glow(hostile?RED:CYAN,hostile?1.1:1.0,mesh);scene.add(mesh);
  bullets.push({mesh,vx:dx*(hostile?9:37),vz:dz*(hostile?9:37),life:hostile?5:1.8,hostile,oldX:mesh.position.x,oldZ:mesh.position.z});
  if(!hostile){player.muzzleTime=.05;player.muzzle.visible=true;player.group.position.y=1.06;tone(920,.07,'triangle',.12,180);}
}
function distanceToSegment(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;const t=l?clamp(((px-ax)*dx+(pz-az)*dz)/l,0,1):0;return Math.hypot(px-(ax+t*dx),pz-(az+t*dz));}
function removeBullet(index){scene.remove(bullets[index].mesh);bullets.splice(index,1);}
function killEnemy(index,drop=true){
  const e=enemies[index];addScore(e.type==='heavy'?300:e.type==='strafer'?150:100);kills++;
  burst(e.group.position,RED,e.type==='heavy'?50:26,e.type==='heavy'?8:5);burst(e.group.position,0xffffff,8,4);shock(e.group.position,RED,e.type==='heavy'?6:3);explosionSound(e.type==='heavy');
  if(e.type==='heavy')shake=Math.max(shake,.12);
  if(drop&&(Math.random()<.24||kills%7===0))spawnPickup(e.group.position.x,e.group.position.z,player.health<55&&Math.random()<.6?'health':['health','rapid','shield'][Math.floor(Math.random()*3)]);
  scene.remove(e.group);e.material.dispose();enemies.splice(index,1);
}
function damagePlayer(amount){
  if(state!=='playing'||player.invulnerable>0)return;
  if(player.shieldTime>0){burst(player.group.position,VIOLET,12,3);tone(420,.1,'sine',.17,700);player.invulnerable=.2;return;}
  player.health=Math.max(0,player.health-amount);player.invulnerable=.75;flash=.8;shake=.18;burst(player.group.position,CYAN,18,4);tone(110,.22,'sawtooth',.22,40);updateHUD();
  if(player.health<=0)gameOver();
}
const pickupColors={health:0x83f3dc,rapid:CYAN,shield:VIOLET};
function spawnPickup(x,z,type){
  const group=new THREE.Group(),color=pickupColors[type];
  const cage=new THREE.Mesh(new THREE.OctahedronGeometry(.65),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.6}));group.add(cage);
  if(type==='health'){box(group,new THREE.MeshBasicMaterial({color}),0,0,0,.18,.65,.18);box(group,new THREE.MeshBasicMaterial({color}),0,0,0,.65,.18,.18);}
  else if(type==='rapid'){const core=new THREE.Mesh(new THREE.ConeGeometry(.24,.68,3),cyanMat);core.rotation.z=-.4;group.add(core);}
  else {const core=new THREE.Mesh(pickupCoreGeo,violetMat);group.add(core);}
  glow(color,2.8,group);group.position.set(clamp(x,-20,20),1.1,clamp(z,-16,16));scene.add(group);
  const base=ring(scene,color,.75,x,.07,z,.6);pickups.push({group,base,type,life:16,phase:Math.random()*6});
}
function collectPickup(index){
  const p=pickups[index];if(p.type==='health'){player.health=Math.min(100,player.health+30);toast('HULL REPAIRED +30','#83f3dc');}
  if(p.type==='rapid'){player.rapid=10;toast('RAPID FIRE ONLINE · 10s');}
  if(p.type==='shield'){player.shieldTime=8;toast('SHIELD ONLINE · 8s','#bca9ff');}
  addScore(50);burst(p.group.position,pickupColors[p.type],26,4);shock(p.group.position,pickupColors[p.type],3);tone(440,.12,'sine',.3,880);tone(880,.3,'sine',.2,1320);removePickup(index);updateHUD();
}
function removePickup(index){const p=pickups[index];scene.remove(p.group,p.base);p.base.material.dispose();p.group.traverse(o=>{if(o.isMesh&&o.material!==cyanMat&&o.material!==violetMat)o.material.dispose();if(o.isMesh&&o.geometry!==boxGeo&&o.geometry!==pickupCoreGeo)o.geometry.dispose();});pickups.splice(index,1);}
function clearBattle(){
  for(const e of enemies){scene.remove(e.group);e.material.dispose();}enemies.length=0;
  for(const b of bullets)scene.remove(b.mesh);bullets.length=0;
  for(let i=pickups.length-1;i>=0;i--)removePickup(i);
  for(const s of shockwaves){scene.remove(s.mesh);s.mesh.material.dispose();}shockwaves.length=0;
  for(const p of particles)p.life=0;
}
function startGame(){
  initAudio();clearBattle();state='playing';time=0;gameTime=0;score=0;wave=0;kills=0;hostileShots=0;scorePulse=0;spawnLeft=0;spawnTimer=0;nextWave=0;shake=0;flash=0;announcementUntil=0;toastUntil=0;
  player.health=100;player.invulnerable=1.5;player.rapid=0;player.shieldTime=0;player.cooldown=0;player.muzzleTime=0;player.angle=0;player.velocity.set(0,0);player.group.position.set(0,1.1,5);player.group.rotation.set(0,0,0);player.group.visible=true;player.shadow.visible=true;target.set(0,0,0);keys.clear();firing=false;mouseActive=false;aim.set(0,1.1,-10);
  $('start-screen').classList.add('hidden');$('over-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('pause').classList.remove('hidden');$('toast').classList.remove('show');$('crosshair').classList.add('hidden');document.body.classList.add('playing');$('station-status').textContent='COMBAT ACTIVE';startWave();updateHUD();$('play').blur();$('restart').blur();
}
function gameOver(){
  state='dying';firing=false;keys.clear();player.group.visible=false;player.shadow.visible=false;burst(player.group.position,CYAN,95,10);burst(player.group.position,0xffffff,35,7);shock(player.group.position,CYAN,10);shake=.27;explosionSound(true);
  const record=score>best;if(record){best=score;try{localStorage.setItem('neon-rift-best',String(best));}catch{}}
  $('best').textContent=formatScore(best);$('final-score').textContent=score.toLocaleString('en-US');$('final-wave').textContent=String(wave).padStart(2,'0');$('over-message').textContent=record?'A new personal best. Your signal lives on.':'The rift claims another. Launch again.';
  $('station-status').textContent='SIGNAL LOST';$('crosshair').classList.add('hidden');$('pause').classList.add('hidden');document.body.classList.remove('playing');announcementUntil=time+.01;nextWave=time+1.2;
}
function togglePause(){
  if(state==='playing'){state='paused';keys.clear();firing=false;$('pause-screen').classList.remove('hidden');$('crosshair').classList.add('hidden');document.body.classList.remove('playing');$('station-status').textContent='FLIGHT PAUSED';}
  else if(state==='paused'){state='playing';$('pause-screen').classList.add('hidden');document.body.classList.add('playing');$('station-status').textContent='COMBAT ACTIVE';$('resume').blur();}
}
function updateHUD(){
  $('score').textContent=formatScore(score);$('health-value').textContent=Math.ceil(player.health);$('health-bar').style.width=player.health+'%';$('health-bar').style.background=player.health<30?'#ff5370':'#78eaff';$('wave').textContent=String(wave).padStart(2,'0');$('hostiles').textContent=enemies.length+spawnLeft;
  $('wave-status').textContent=nextWave?'SECTOR CLEAR':spawnLeft?'INCOMING':'ENGAGED';
  $('weapon-status').textContent=player.rapid>0?'OVERDRIVE':'READY';
  $('effects').innerHTML=(player.rapid>0?`<span class="rapid">RAPID ${Math.ceil(player.rapid)}s</span>`:'')+(player.shieldTime>0?`<span class="shield">SHIELD ${Math.ceil(player.shieldTime)}s</span>`:'');
}
function updatePlayer(dt){
  let dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  let dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  const l=Math.hypot(dx,dz);if(l){dx/=l;dz/=l;}
  const response=1-Math.exp(-11*dt);player.velocity.x+=(dx*10.5-player.velocity.x)*response;player.velocity.y+=(dz*10.5-player.velocity.y)*response;
  const pos=player.group.position;pos.x=clamp(pos.x+player.velocity.x*dt,-BOUNDS.x,BOUNDS.x);pos.z=clamp(pos.z+player.velocity.y*dt,-BOUNDS.z,BOUNDS.z);
  // Clip the deck's beveled corners as well as its straight perimeter.
  if(Math.abs(pos.x)+Math.abs(pos.z)>36){const extra=(Math.abs(pos.x)+Math.abs(pos.z)-36)/2;pos.x-=Math.sign(pos.x)*extra;pos.z-=Math.sign(pos.z)*extra;}
  if(mouseActive){raycaster.setFromCamera(mouse,camera);raycaster.ray.intersectPlane(aimPlane,aim);const ax=aim.x-pos.x,az=aim.z-pos.z;if(Math.hypot(ax,az)>.3)player.angle=Math.atan2(-ax,-az);}
  else if(l){player.angle=Math.atan2(-dx,-dz);}
  let delta=THREE.MathUtils.euclideanModulo(player.angle-player.group.rotation.y+Math.PI,Math.PI*2)-Math.PI;player.group.rotation.y+=delta*(1-Math.exp(-22*dt));
  // Projectiles follow the displayed nose, so aim and muzzle always agree.
  const shotAngle=player.angle;player.angle=player.group.rotation.y;
  player.cooldown=Math.max(0,player.cooldown-dt);if((firing||keys.has('Space'))&&player.cooldown<=0){fireShot();player.cooldown=player.rapid>0?.08:.17;}player.angle=shotAngle;
  player.invulnerable=Math.max(0,player.invulnerable-dt);player.rapid=Math.max(0,player.rapid-dt);player.shieldTime=Math.max(0,player.shieldTime-dt);player.muzzleTime-=dt;player.muzzle.visible=player.muzzleTime>0;
  pos.y=1.1+Math.sin(time*5)*.035;player.group.rotation.z=-player.velocity.x*.012;player.group.rotation.x=player.velocity.y*.008;
  for(const e of player.engines)e.scale.y=.65+player.velocity.length()*.07+Math.sin(time*35)*.09;
  player.shield.visible=player.shieldTime>0;player.shield.rotation.y=time*.8;player.shield.material.opacity=.12+Math.sin(time*5)*.04;
  player.hull.material=player.invulnerable>0&&Math.sin(time*35)>0?edgeMetal:armor;
  player.shadow.position.set(pos.x,.075,pos.z);playerLight.position.set(pos.x,2,pos.z);
  if(l&&Math.random()<dt*35){const p=new THREE.Vector3(pos.x+Math.sin(player.group.rotation.y)*1.2,.8,pos.z+Math.cos(player.group.rotation.y)*1.2);burst(p,CYAN,1,.6);}
}
function updateEnemies(dt){
  const pp=player.group.position;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i],p=e.group.position;e.spawnTime=Math.max(0,e.spawnTime-dt);
    e.group.scale.setScalar((e.type==='heavy'?1.5:e.type==='strafer'?.9:.8)*(1-e.spawnTime/.8));
    const dx=pp.x-p.x,dz=pp.z-p.z,d=Math.hypot(dx,dz)||.01,ux=dx/d,uz=dz/d;
    let vx=ux*e.speed,vz=uz*e.speed;
    if(e.type==='strafer'){const radial=d>10?1:d<7?-1:.12;vx=(ux*radial-uz*.92)*e.speed;vz=(uz*radial+ux*.92)*e.speed;}
    // Light separation prevents stacked drones from hiding silhouettes.
    for(let j=0;j<enemies.length;j++){if(i===j)continue;const q=enemies[j].group.position,sx=p.x-q.x,sz=p.z-q.z,dist2=sx*sx+sz*sz;if(dist2>.001&&dist2<2.5){vx+=sx/dist2*.7;vz+=sz/dist2*.7;}}
    if(e.spawnTime<=0){p.x=clamp(p.x+vx*dt,-20.6,20.6);p.z=clamp(p.z+vz*dt,-16.6,16.6);}
    p.y=1.1+Math.sin(time*3+e.phase)*.12;e.group.rotation.y=Math.atan2(-dx,-dz);e.core.rotation.y+=dt*2;
    e.flash=Math.max(0,e.flash-dt);e.material.emissive.set(e.flash>0?0xff8297:0x000000);e.material.emissiveIntensity=e.flash>0?1.5:0;
    if(e.type!=='chaser'&&e.spawnTime<=0){e.fireTimer-=dt;if(e.fireTimer<=0&&d<24){fireShot(true,e);e.fireTimer=(e.type==='heavy'?2.4:3.0)*Math.max(.55,1-wave*.02);}}
    if(d<e.radius+.72&&e.spawnTime<=0){damagePlayer(e.type==='heavy'?22:13);p.x-=ux*.6;p.z-=uz*.6;if(state!=='playing')break;}
  }
}
function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i],p=b.mesh.position;b.oldX=p.x;b.oldZ=p.z;p.x+=b.vx*dt;p.z+=b.vz*dt;b.life-=dt;let hit=false;
    if(b.hostile){if(distanceToSegment(player.group.position.x,player.group.position.z,b.oldX,b.oldZ,p.x,p.z)<.82){damagePlayer(12);hit=true;}}
    else for(let j=enemies.length-1;j>=0;j--){const e=enemies[j];if(distanceToSegment(e.group.position.x,e.group.position.z,b.oldX,b.oldZ,p.x,p.z)<e.radius+.18){e.hp--;e.flash=.12;burst(p,0xffffff,6,2);tone(210,.035,'triangle',.07,130);if(e.hp<=0)killEnemy(j);hit=true;break;}}
    if(hit||b.life<=0||Math.abs(p.x)>22||Math.abs(p.z)>18)removeBullet(i);
    if(state!=='playing')break;
  }
}
function updatePickups(dt){for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.life-=dt;p.group.rotation.y+=dt*1.6;p.group.position.y=1.05+Math.sin(time*3+p.phase)*.22;p.base.material.opacity=p.life<4?.25+Math.sin(time*12)*.2:.45;if(Math.hypot(p.group.position.x-player.group.position.x,p.group.position.z-player.group.position.z)<1.4)collectPickup(i);else if(p.life<=0)removePickup(i);}}
function updateEffects(dt){
  for(let i=0;i<MAX_PARTICLES;i++){
    const p=particles[i];if(p.life>0){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*2;p.vx*=Math.exp(-dt*2);p.vz*=Math.exp(-dt*2);dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.life*4,p.life*3,0);dummy.scale.setScalar(p.size*Math.max(0,p.life/p.max));}else dummy.scale.setScalar(0);
    dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);
  }particleMesh.instanceMatrix.needsUpdate=true;
  for(let i=shockwaves.length-1;i>=0;i--){const s=shockwaves[i];s.life-=dt;const progress=1-s.life/s.max;s.mesh.scale.setScalar(.25+progress*s.size);s.mesh.material.opacity=Math.max(0,(1-progress)*.6);if(s.life<=0){scene.remove(s.mesh);s.mesh.material.dispose();shockwaves.splice(i,1);}}
  flash=Math.max(0,flash-dt*3);$('damage-flash').style.opacity=flash;
}
function tick(dt){
  if(state==='paused')return;
  time+=dt;
  if(state==='playing'){
    gameTime+=dt;updatePlayer(dt);updateEnemies(dt);
    if(state==='playing'){updateBullets(dt);if(state==='playing')updatePickups(dt);
      if(spawnLeft>0){spawnTimer-=dt;if(spawnTimer<=0&&enemies.length<32){spawnEnemy();spawnLeft--;spawnTimer=Math.max(.36,1.0-wave*.025);}}
      else if(enemies.length===0){if(nextWave===0){addScore(wave*250);nextWave=time+3;announce('SECTOR CLEAR',`WAVE BONUS +${wave*250}`,2);tone(520,.3,'sine',.2,1000);}else if(time>=nextWave)startWave();}
    }
    hudTimer-=dt;if(hudTimer<=0){updateHUD();hudTimer=.08;}
  } else if(state==='dying'&&time>=nextWave){state='over';$('over-screen').classList.remove('hidden');$('restart').focus();}
  else if(state==='title'){player.group.rotation.y=-.5+Math.sin(time*.35)*.15;player.group.position.y=1.1+Math.sin(time*2)*.08;player.shadow.position.set(player.group.position.x,.075,player.group.position.z);playerLight.position.copy(player.group.position);playerLight.position.y=2;for(const e of player.engines)e.scale.y=.7+Math.sin(time*9)*.12;}
  updateEffects(dt);
  scorePulse=Math.max(0,scorePulse-dt);$('score').classList.toggle('scoring',scorePulse>0);dust.position.y=Math.sin(time*.18)*.7;dust.rotation.y=Math.sin(time*.08)*.035;
  if(time>=announcementUntil)$('announcement').classList.remove('show');if(time>=toastUntil)$('toast').classList.remove('show');
  barriers.forEach((b,i)=>b.material.opacity=.065+Math.sin(time*.8+i)*.02);centerRing.material.opacity=.19+Math.sin(time)*.03;
  debris.forEach((d,i)=>{d.rotation.x+=dt*.025;d.rotation.y+=dt*.02*(i%2?1:-1);});stars.rotation.y=Math.sin(time*.015)*.01;
  const follow=state==='title'?new THREE.Vector3(-3,0,0):new THREE.Vector3(player.group.position.x*.11,0,player.group.position.z*.10);
  target.lerp(follow,1-Math.exp(-dt*3));shake=Math.max(0,shake-dt*.8);
  camera.position.copy(target).add(cameraOffset);camera.position.x+=(Math.random()-.5)*shake;camera.position.z+=(Math.random()-.5)*shake;camera.lookAt(target);camera.updateMatrixWorld();
}
function resize(){
  const width=innerWidth,height=innerHeight;renderer.setSize(width,height);const aspect=width/height;
  const halfHeight=Math.max(23,31/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
}
resize();window.addEventListener('resize',resize);
window.addEventListener('keydown',event=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='Escape'||event.code==='KeyP'){togglePause();return;}
  if(event.code==='KeyM'){soundEnabled=!soundEnabled;initAudio();updateSound();return;}
  if(event.code==='KeyF'){toggleFullscreen();return;}
  if(state==='playing')keys.add(event.code);
});window.addEventListener('keyup',event=>keys.delete(event.code));
$('viewport').addEventListener('pointermove',event=>{mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);mouseActive=true;$('crosshair').style.left=event.clientX+'px';$('crosshair').style.top=event.clientY+'px';if(state==='playing')$('crosshair').classList.remove('hidden');});
$('viewport').addEventListener('pointerdown',event=>{if(event.button===0&&state==='playing'){initAudio();firing=true;mouseActive=true;mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);}});
window.addEventListener('pointerup',()=>firing=false);$('viewport').addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('blur',()=>{keys.clear();firing=false;if(state==='playing')togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')togglePause();});
$('play').addEventListener('click',startGame);$('restart').addEventListener('click',startGame);$('pause').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;initAudio();updateSound();});
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('FULLSCREEN UNAVAILABLE IN THIS VIEW');}}
$('fullscreen').addEventListener('click',toggleFullscreen);
$('viewport').addEventListener('webglcontextlost',event=>{event.preventDefault();if(state==='playing')togglePause();$('error').classList.remove('hidden');$('error').textContent='The graphics connection was interrupted. Reload this page to relaunch Neon Rift.';});
let previous=performance.now();
const manualQA = new URLSearchParams(location.search).has('qa') && new URLSearchParams(location.search).has('manual');
function animate(now){const dt=Math.min((now-previous)/1000,.05);previous=now;if(!manualQA)tick(dt);renderer.render(scene,camera);frameCount++;fpsTime+=dt;if(fpsTime>=1){fps=Math.round(frameCount/fpsTime);frameCount=0;fpsTime=0;}requestAnimationFrame(animate);}
requestAnimationFrame(animate);$('play').disabled=false;$('play-label').textContent='PLAY NEON RIFT';

// Opt-in local QA surface, absent from normal play. Exercises the same game systems.
if(new URLSearchParams(location.search).has('qa'))window.__neonQA={
  snapshot:()=>({state,score,wave,spawnLeft,hostileShots,enemies:enemies.map(e=>({type:e.type,hp:e.hp,x:e.group.position.x,z:e.group.position.z})),bullets:bullets.length,pickups:pickups.map(p=>p.type),health:player.health,rapid:player.rapid,shield:player.shieldTime,player:{x:player.group.position.x,z:player.group.position.z,angle:player.group.rotation.y},fps,objects:renderer.info.memory,drawCalls:renderer.info.render.calls}),
  start:startGame,step:seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++)tick(1/60);},
  spawn:(type,x,z)=>makeEnemy(type,x,z),pickup:(type)=>spawnPickup(player.group.position.x,player.group.position.z,type),
  damage:amount=>{player.invulnerable=0;damagePlayer(amount);},clear:()=>{for(let i=enemies.length-1;i>=0;i--)killEnemy(i,false);spawnLeft=0;},
  position:(x,z)=>{player.group.position.x=x;player.group.position.z=z;player.velocity.set(0,0);},
  point:(x,z)=>{const v=new THREE.Vector3(x,1.1,z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};},
  resetTargets:()=>{clearBattle();spawnLeft=0;nextWave=time+999;},
};

})();
