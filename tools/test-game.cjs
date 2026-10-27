/* Run with Node. Exercises the real TypeScript click/placement methods with a
 * headless Cocos adapter; it does not replace the browser visual verification. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
let ts;
try { ts = require('typescript'); } catch {
    ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');
}
const storage = new Map();
class V { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})} clone(){return new V(this.x,this.y,this.z)} }
class Base { constructor(){ this.isValid=true; this.node={parent:null}; } scheduleOnce(fn){queueMicrotask(fn)} unschedule(){} }
class Color { constructor(...args){} }
const cc = new Proxy({
    _decorator: { ccclass:()=>c=>c, property:(...args)=> typeof args[1]==='string' ? undefined : ()=>{} },
    Component:Base,Vec3:V,Color,Layers:{Enum:{UI_2D:1}},
    sys:{localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}, isNative:false},
    Label:Object.assign(class {},{HorizontalAlign:{CENTER:1},VerticalAlign:{CENTER:1}}),
    Button:Object.assign(class {},{EventType:{CLICK:'click'}}),
    Node:Object.assign(class {},{EventType:{TOUCH_END:'touch'}}),
    Tween:{stopAllByTarget(){}}, native:{},
}, {get:(obj,key)=>key in obj?obj[key]:class {}});
const oldLoad=Module._load;
Module._load=function(id,parent,main){ if(id==='cc')return cc; if(id==='cc/env')return {PREVIEW:false};return oldLoad.call(this,id,parent,main); };
require.extensions['.ts']=(module,filename)=>{
    const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
    module._compile(output,filename);
};
const root=path.resolve(__dirname,'..');
const {GameManager}=require(path.join(root,'assets/scripts/game/GameManager.ts'));
const {BoardManager}=require(path.join(root,'assets/scripts/game/BoardManager.ts'));
const colors={Y:'yellow',B:'blue',R:'red',K:'black',W:'white',P:'pink',G:'green',S:'gray'};
const quiet=console.log;
console.log=()=>{};
function node(frame={}) { return {isValid:true,active:true,parent:null,children:[],worldPosition:new V(),worldScale:new V(1,1,1),
    getChildByName(){return this.gem??null},getComponent(){return {spriteFrame:frame,width:20,convertToNodeSpaceAR:x=>x}},setSiblingIndex(){}}; }
function cell(row,col,target,current) {
    const gem=node();
    return {row,col,targetColor:colors[target],currentColor:colors[current]??null,isValid:true,node:node(),gemSprite:{node:gem,spriteFrame:{}},
        getDisplaySize:()=>24,canMove(){return this.currentColor!==null&&!this.isCorrect()},isCorrect(){return this.currentColor!==null&&this.currentColor===this.targetColor},
        setCurrentColor(c){this.currentColor=c;gem.active=c!==null},setSelected(v){this.picked=v},releaseOutline(){this.picked=false}};
}
function game(data,animated) {
    const cells=[];data.target.forEach((row,r)=>[...row].forEach((t,c)=>{if(t!=='.')cells.push(cell(r,c,t,data.initial[r][c]))}));
    const board={getCell:(r,c)=>cells.find(x=>x.row===r&&x.col===c),getCells:()=>cells,isCompleted:()=>cells.every(c=>c.isCorrect())};
    board.getTargetRegions=()=>BoardManager.prototype.getTargetRegions.call({cells});
    const gems=Array(data.trayCapacity).fill(null), slots=gems.map(()=>{const n=node();n.gem=node();return n});
    const tray={isValid:true,getSlotNode:i=>slots[i]??null,getGemAt:i=>gems[i]??null,getEmptyIndices:()=>gems.flatMap((c,i)=>c===null?[i]:[]),getFirstEmptySlot:()=>gems.indexOf(null),
        isEmptyAt:i=>gems[i]===null,setGemAt(i,c){gems[i]=c;return true},getGemCount:()=>gems.filter(Boolean).length,getGemSize:()=>34,setSelectedIndex(){},setLiftedSlots(i){this.lifted=[...i]},
        compact(){const remaining=gems.filter(Boolean);gems.fill(null);remaining.forEach((c,i)=>gems[i]=c);return Promise.resolve()}};
    const g=new GameManager();g.boardManager=board;g.trayManager=tray;g.finished=false;g.debugStartLevel=1;
    g.audioManager=new Proxy({}, {get:()=>()=>{}});g.isSettingsOpen=()=>false;g.noteTutorialProgress=()=>{};g.presentLevelComplete=()=>{g.presented=true};g.showFloatingTip=()=>{};
    g.levelManager={getCurrentLevel:()=>data.id,calculateStars:()=>5};
    g.targetRegions=[];
    const stats={batches:0,arrivals:0};
    if(animated)g.moveAnimator={play(moves,done){stats.batches++;for(const move of moves){move.onDepart?.();move.onArrive?.();stats.arrivals++}done()}};
    return {g,cells,tray,gems,board,stats};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve()}
async function solve(data,animated){
    const env=game(data,animated),{g,cells,tray,gems,board,stats}=env;
    let moves=0,maxTray=0,partial=0;
    for(let guard=0;guard<5000&&!g.finished;guard++){
        const empty=cells.filter(c=>c.currentColor===null);
        let action=false;
        for(const dest of empty){
            const source=cells.find(c=>c.canMove()&&c.currentColor===dest.targetColor);
            if(source){
                g.clearSelection();g.onBoardClick(source);
                const before=g.selectedGroup.length;
                g.onBoardClick(dest);await flush();
                if(g.selectedGroup.length>0&&g.selectedGroup.length<before)partial++;
                action=true;break;
            }
            const slot=gems.indexOf(dest.targetColor);
            if(slot>=0){g.clearSelection();g.onTrayClick(slot);g.onBoardClick(dest);await flush();action=true;break;}
        }
        if(!action){
            const source=cells.find(c=>c.canMove());
            assert.ok(source,'No movable source before completion');
            assert.ok(tray.getFirstEmptySlot()>=0,'Deadlock: shelf full with no legal placement');
            g.clearSelection();g.onBoardClick(source);g.onTrayClick(tray.getFirstEmptySlot());await flush();
        }
        moves++;maxTray=Math.max(maxTray,tray.getGemCount());
        assert.ok(!g.isAnimating,'Input lock leaked after movement');
        assert.ok(tray.getGemCount()<=data.trayCapacity);
        // Count every bead after every operation: no loss / duplication.
        const current=[...cells.map(c=>c.currentColor),...gems].filter(Boolean).sort();
        const expected=cells.map(c=>c.targetColor).sort();
        assert.deepEqual(current,expected,'A move lost or duplicated a bead');
    }
    assert.ok(board.isCompleted(),'Puzzle failed to solve');assert.equal(tray.getGemCount(),0);assert.ok(g.finished&&g.presented,'Completion did not fire');
    return {level:data.id,cells:cells.length,moves,maxTray,partial,...stats};
}
(async()=>{
    const results=[];
    for(let level=1;level<=5;level++){
        const data=JSON.parse(fs.readFileSync(path.join(root,`assets/resources/levels/level_0${level}.json`)));
        assert.equal(data.target.length,data.rows);assert.ok(data.target.every(row=>row.length===data.cols));
        assert.equal(data.initial.length,data.rows);assert.ok(data.initial.every(row=>row.length===data.cols));
        assert.deepEqual([...data.target.join('').replace(/\./g,'')].sort(),[...data.initial.join('').replace(/\./g,'')].sort());
        data.target.forEach((row,r)=>[...row].forEach((v,c)=>assert.equal(v==='.',data.initial[r][c]==='.')));
        results.push(await solve(data,true));
        await solve(data,false);
    }
    // Selection must be connected, correct beads locked, and invalid target taps
    // must not exchange two occupied groups or discard the held selection.
    const small={id:2,trayCapacity:2,target:['BBBB','YYYY'],initial:['YYBY','BBYB']};
    const {g,cells}=game(small,true);
    const first=cells[0];g.onBoardClick(first);assert.equal(g.selectedGroup.length,2);
    g.onBoardClick(cells[2]);assert.equal(g.selected.cell,first,'Correct occupied target changed selection');
    g.onBoardClick(first);assert.equal(g.selected,null,'Second tap should deselect');
    g.isAnimating=true;g.onBoardClick(first);assert.equal(g.selected,null,'Tap during flight must be ignored');
    console.log=quiet;
    console.log(JSON.stringify({passed:true,levels:results,checks:['actual click handlers','animated + fallback paths','all colors conserved after every move','all five levels solvable','partial groups remain selected','correct beads locked','flight input lock','completion triggered']},null,2));
})().catch(error=>{console.log=quiet;console.error(error);process.exitCode=1});
