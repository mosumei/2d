// Run real JewelEffects with a headless Cocos adapter; visual QA uses Creator preview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
let ts;
try { ts = require('typescript'); } catch {
    ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');
}
class UITransform { setContentSize(width, height) { Object.assign(this, {width, height}); } }
class Sprite {}
Sprite.SizeMode = { CUSTOM: 1 };
class Texture2D {}
class Rect { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
class SpriteFrame { destroy() { this.destroyed = true; } }
class Component {}
class Node {
    constructor(name) { Object.assign(this,{name,isValid:true,activeInHierarchy:true,children:[],components:new Map()}); }
    set parent(parent) { this._parent=parent; if(parent) parent.children.push(this); }
    get parent() { return this._parent; }
    getChildByName(name) { return this.children.find(n=>n.isValid && n.name===name); }
    addComponent(Type) { const c = new Type(); c.node=this; this.components.set(Type,c); return c; }
    getComponent(Type) { return this.components.get(Type) || null; }
    destroy() { this.isValid=false; if(this.parent) this.parent.children=this.parent.children.filter(n=>n!==this); }
}
let loadCallback;
const cc = { _decorator:{ccclass:()=>c=>c,property:()=>()=>{}}, Node,Component,Sprite,SpriteFrame,Texture2D,Rect,UITransform,
    Color:{WHITE:{}}, Layers:{Enum:{UI_2D:1}}, resources:{load(_path,Type,callback){assert.equal(Type,Texture2D);loadCallback=callback;}} };
const originalLoad = Module._load;
Module._load=function(id,parent,main){
    if(id==='cc')return cc;
    if(id==='cc/env')return {PREVIEW:false};
    if(id==='./GemVisuals')return {};
    return originalLoad.call(this,id,parent,main);
};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}
}).outputText,file);
const {JewelEffects}=require(path.resolve(__dirname,'../assets/scripts/game/JewelEffects.ts'));
function effects(){const fx=new JewelEffects();fx.isValid=true;fx.enabledInHierarchy=true;return fx;}
function bead(){const gem=new Node('Cell');const surface=new Node('GemSprite');surface.parent=gem;surface.addComponent(UITransform).width=26;return gem;}
(async()=>{
    const fx=effects();fx.onLoad();loadCallback(null,new Texture2D());
    assert.equal(fx.placementFrames.length,28);
    assert.deepEqual(fx.placementFrames[9].rect,new Rect(32,32,32,32));
    const a=bead(),b=bead();fx.playGemPlaced(a);fx.update(.07);fx.playGemPlaced(b);
    const animations=[...fx.placementSheens.values()];
    assert.equal(animations[0].sprite.spriteFrame,fx.placementFrames[2]);
    assert.equal(animations[1].sprite.spriteFrame,fx.placementFrames[0]);
    assert.equal(fx.placementSheens.size,2,'Later arrivals must not wait out the previous afterglow');
    assert.equal(animations[0].sprite.node.getComponent(UITransform).width,32,'Atlas padding must not shrink the reflection');
    fx.update(.1);fx.playGemPlaced(a);assert.equal(fx.placementSheens.size,2,'Replaying same bead must replace its old reflection');
    b.children[0].children[0].destroy();fx.update(.01);assert.equal(fx.placementSheens.size,1);
    fx.update(1);assert.equal(fx.placementSheens.size,0,'Completed frames must be cleaned up');
    fx.playGemPlaced(a);fx.onDisable();assert.equal(fx.placementSheens.size,0);
    const pending=effects();pending.playGemPlaced(bead());pending.onDisable();loadCallback(null,new Texture2D());
    await Promise.resolve();await Promise.resolve();assert.equal(pending.placementSheens.size,0,'Late loading must not resurrect cleared effects');
    const frames=[...fx.placementFrames];fx.onDestroy();assert.ok(frames.every(f=>f.destroyed));
    console.log('PASS: 28 frames, 30 fps, staggered arrivals with overlapping afterglow, replay replacement, cleanup and async cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
