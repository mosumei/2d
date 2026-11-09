// Headless checks of the real whole-board reflection timeline.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
let ts;
try { ts = require('typescript'); } catch {
    ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');
}
class UITransform { constructor(){this.width=26;} setContentSize(w,h){this.width=w;this.height=h;} }
class Sprite { constructor(){this.isValid=true;} } Sprite.SizeMode={CUSTOM:1};
class SpriteFrame { destroy(){this.destroyed=true;} }
class Size { constructor(width,height){Object.assign(this,{width,height});} }
class Rect { constructor(x,y,width,height){Object.assign(this,{x,y,width,height});} }
class Node {
    constructor(name){Object.assign(this,{name,isValid:true,children:[],components:new Map(),scale:{x:1,y:1}});}
    set parent(value){this._parent=value;if(value)value.children.push(this);} get parent(){return this._parent;}
    addComponent(Type){const c=new Type();this.components.set(Type,c);return c;}
    getComponent(Type){return this.components.get(Type)||null;}
    setSiblingIndex(){}
    destroy(){this.isValid=false;for(const c of this.components.values())c.isValid=false;}
}
let animation, loadedPath, stopped;
const cc={gfx:{BlendFactor:{SRC_ALPHA:1,ONE:2}},Node,UITransform,Sprite,SpriteFrame,Rect,Size,Texture2D:class{},Color:{WHITE:{}},
    Tween:{stopAllByTarget(target){stopped=target;}},
    tween(target){return {to(duration,props,options){animation={target,duration,props,options};return this;},start(){}};},
    resources:{load(asset,Type,callback){loadedPath=asset;callback(null,{});}}};
const originalLoad=Module._load;
Module._load=function(id,parent,main){return id==='cc'?cc:originalLoad.call(this,id,parent,main);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText,file);
const {GemCompletionShine}=require(path.resolve(__dirname,'../assets/scripts/game/GemCompletionShine.ts'));
function cell(row,col){const node=new Node('Cell'),gem=new Node('GemSprite');gem.parent=node;gem.addComponent(UITransform);return {row,col,node,gemSprite:{node:gem},isValid:true,currentColor:'red',getDisplaySize:()=>26};}
function tick(time){animation.target.time=time;animation.options.onUpdate();}
function glint(c){return c.gemSprite.node.children.find(n=>n.isValid);}
async function check(rows,cols){
    const shine=new GemCompletionShine();await shine.loadGlintFrames();
    assert.equal(loadedPath,'effects/placement-reflection/texture');
    assert.equal(shine.glintFrames.length,28);
    assert.deepEqual(shine.glintFrames[9].originalSize,new Size(32,32),'Each atlas frame must use tile dimensions, not full atlas dimensions');
    assert.deepEqual(shine.glintFrames[9].rect,new Rect(32,32,32,32));
    const cells=Array.from({length:rows*cols},(_,i)=>cell(Math.floor(i/cols),i%cols));
    let finish;shine.wait=()=>new Promise(resolve=>finish=resolve);
    let cancelled=false;const playing=shine.playWaveShine(cells,()=>cancelled);
    assert.ok(glint(cells[0]));assert.equal(glint(cells.at(-1)),undefined);
    assert.equal(glint(cells[0]).getComponent(UITransform).width,32);
    assert.equal(glint(cells[0]).getComponent(Sprite).trim,true,'Atlas subframes must not shrink using full-atlas dimensions');
    const total=animation.duration;
    const step=1.50/(rows+cols-2);tick(step+.00001);
    assert.ok(glint(cells[1]));assert.ok(glint(cells[cols]),'Equal row + col must start together');
    assert.ok(glint(cells[0]),'Earlier afterglow must overlap next diagonal');
    tick(1.50001);assert.ok(glint(cells.at(-1)),'Last diagonal must start at normalized sweep end');
    tick(total);assert.ok(cells.every(c=>!glint(c)),'All reflections must disappear');
    assert.ok(cells.every(c=>c.gemSprite.node.scale.x===1),'Bead scale must remain unchanged');
    finish();await playing;assert.equal(stopped,animation.target);
    // Cancel during a bright frame, without waiting for every per-bead animation.
    const more=cells.map(c=>cell(c.row,c.col));
    const interrupted=shine.playWaveShine(more,()=>cancelled);tick(.1);cancelled=true;tick(.2);
    assert.ok(more.every(c=>!glint(c)));finish();await interrupted;
    return total;
}
(async()=>{
    assert.equal(await check(3,3),await check(25,23),'Board dimensions must not change sweep duration');
    const empty=new GemCompletionShine();await empty.play({getCells:()=>[]},null,()=>false);
    console.log('PASS: correctly sized reference reflection atlas, diagonal order, overlapping afterglow, normalized duration, unchanged bead scale, cancellation and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
