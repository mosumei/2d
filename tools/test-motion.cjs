// Deterministic timeline test of the real Cocos animator (no wall-clock sleeps).
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
let ts;try{ts=require('typescript')}catch{ts=require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript')}
let clock=0,events=[],counter=0;
function later(at,fn,owner){events.push({at,fn,owner,id:counter++})}
function until(time=Infinity){while(true){events.sort((a,b)=>a.at-b.at||a.id-b.id);if(!events.length||events[0].at>time)break;const event=events.shift();clock=event.at;event.fn()}if(Number.isFinite(time))clock=time}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}clone(){return new Vec3(this.x,this.y,this.z)}static distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)}}
class UITransform{constructor(){this.width=20}setContentSize(w,h){this.width=w;this.height=h}convertToNodeSpaceAR(p){return p.clone()}}
class Sprite{}Sprite.SizeMode={CUSTOM:1};class Graphics{};for(const method of ['moveTo','lineTo','close','fill'])Graphics.prototype[method]=()=>{};
class UIOpacity{constructor(){this.opacity=255}}
class Node{constructor(name=''){this.name=name;this.children=[];this.components=new Map();this.position=new Vec3();this.worldScale=new Vec3(1,1,1);this.isValid=true;this.active=true}
set parent(p){if(this._parent)this._parent.children=this._parent.children.filter(n=>n!==this);this._parent=p;if(p)p.children.push(this)}get parent(){return this._parent}
get worldPosition(){return this.position}getChildByName(name){return this.children.find(n=>n.name===name)}addComponent(T){const c=new T();c.node=this;this.components.set(T,c);return c}getComponent(T){return this.components.get(T)||null}setPosition(x,y,z){this.position=x instanceof Vec3?x.clone():new Vec3(x,y,z)}setScale(){}setSiblingIndex(){}destroy(){this.isValid=false;this.parent=null}}
class Component{scheduleOnce(fn,delay=0){later(clock+delay,fn,fn)}unschedule(fn){events=events.filter(e=>e.owner!==fn)}}
function tween(target){let duration=0;const jobs=[];return {delay(t){duration+=t;return this},call(fn){jobs.push({t:duration,fn});return this},to(t,props,options){const end=duration+t;jobs.push({t:end,fn:()=>{if(!target.isValid&&target instanceof Node)return;options?.onUpdate?.(target,1);Object.assign(target,props)}});duration=end;return this},start(){for(const j of jobs)later(clock+j.t,j.fn,target);return this}}}
const cc={_decorator:{ccclass:()=>x=>x},Component,Node,Sprite,UITransform,Layers:{Enum:{UI_2D:1}},Vec3,tween,Tween:{stopAllByTarget(n){events=events.filter(e=>e.owner!==n)}},Color:class{},Graphics,UIOpacity};cc.Color.WHITE={};
const load=Module._load;Module._load=function(id,p,m){return id==='cc'?cc:load.call(this,id,p,m)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText,f);
const {GemMoveAnimator,GEM_MOTION}=require(path.resolve(__dirname,'../assets/scripts/game/GemMoveAnimator.ts'));
function check(flight){clock=0;events=[];const animator=new GemMoveAnimator();animator.node=new Node('layer');animator.node.addComponent(UITransform);
const departed=[],arrived=[],arrivals=[];let completed=0;
const moves=Array.from({length:8},(_,i)=>{const from=new Node('source');from.addComponent(UITransform).width=17;from.position=new Vec3(i*24,180,0);const to=new Node('destination');to.position=new Vec3(i*40,-250,0);return {frame:{},from,to,flight,endSize:32,onDepart(){departed.push(i)},onArrive(){arrived.push(i);arrivals.push(clock)}}});
animator.play(moves,()=>completed++);
assert.equal(departed.length,0,'Sources disappeared before their departure');assert.equal(animator.node.children.length,8);
assert.ok(animator.node.children.every(n=>n.getComponent(UITransform).width===17),'Small gems became fixed-size flyers');
until(GEM_MOTION.cadence-.001);assert.deepEqual(departed,[0],'A whole batch departed at once');
until(GEM_MOTION.cadence+.001);assert.deepEqual(departed,[0,1]);until();
assert.deepEqual(arrived,[0,1,2,3,4,5,6,7]);assert.equal(completed,1);assert.equal(animator.node.children.length,0,'Temporary effects leaked');
assert.ok(arrivals[7]-arrivals[0]>.44,'Sequential stream collapsed into simultaneous arrivals');
return {flight,departures:departed.length,arrivals:arrived.length,streamSpan:Number((arrivals[7]-arrivals[0]).toFixed(3)),completed};}
console.log(JSON.stringify({passed:true,timelines:[check('stack'),check('arc')]},null,2));
