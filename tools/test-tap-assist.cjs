// Exercise the actual resolver with board coordinates, without loading the engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
let ts;
try { ts = require('typescript'); } catch {
    ts = require('/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript');
}
const source = ts.createSourceFile('GameManager.ts', fs.readFileSync('assets/scripts/game/GameManager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const cls = source.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'GameManager');
const methods = ['tryAssistPlacement', 'getConnectedEmptyCells', 'adjacentCells'].map(name => cls.members.find(n => n.name?.getText(source) === name).getText(source)).join('\n');
const js = ts.transpileModule(`class Resolver { ${methods} }`, {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const Resolver = new Function('UITransform', 'Vec3', js + '; return Resolver;')(class {}, class {constructor(x,y,z){Object.assign(this,{x,y,z});}});
const cell = (x,y,targetColor='red',currentColor=null) => ({row:Math.round(y/41),col:Math.round(x/41),node:{position:{x,y}},targetColor,currentColor,getDisplaySize:()=>40});
function setup(cells, scale=1) {
    const g = new Resolver();
    g.isSettingsOpen=()=>false;
    g.selected={type:'board',cell:{currentColor:'red'}};
    g.boardManager={cellGap:1,getCells:()=>cells,getCell:(r,c)=>cells.find(cell=>cell.row===r&&cell.col===c),node:{getComponent:()=>({convertToNodeSpaceAR:p=>({x:p.x/scale,y:p.y/scale})})}};
    g.onBoardClick=c=>g.placed=c;
    return g;
}
const target=cell(0,0);
let g=setup([target]);
assert.equal(g.tryAssistPlacement({x:27,y:0}),true); assert.equal(g.placed,target);
assert.equal(setup([target]).tryAssistPlacement({x:40,y:0}),false,'Distant taps do not place');
assert.equal(setup([target]).tryAssistPlacement({x:0,y:0}),false,'Exact taps retain normal cell input');
assert.equal(setup([target,cell(41,0)]).tryAssistPlacement({x:20.5,y:0}),true,'Adjacent slots in one region are one target');
// Use offset socket positions to exercise two independent regions inside one hit radius.
const left=cell(-25,0), right=cell(25,0);
assert.equal(setup([left,right]).tryAssistPlacement({x:2,y:22}),false,'Separate regions are ambiguous even when one is closer');
const near=cell(41,0);g=setup([target,near]);
assert.equal(g.tryAssistPlacement({x:22,y:22}),true);assert.equal(g.placed,near,'Use nearest slot within the unique region');
assert.equal(setup([target,cell(41,41)]).tryAssistPlacement({x:20.5,y:20.5}),true,'Diagonal connectivity matches placement rules');
assert.equal(setup([left,cell(0,0,'red','red'),right]).tryAssistPlacement({x:0,y:22}),false,'Filled slots do not join empty regions');
assert.equal(setup([target,cell(41,0,'blue','blue')]).tryAssistPlacement({x:27,y:0}),false,'Occupied cell taps retain their intent');
assert.equal(setup([cell(0,0,'blue')]).tryAssistPlacement({x:27,y:0}),false,'Wrong color never places');
g=setup([target],2); assert.equal(g.tryAssistPlacement({x:54,y:0}),true,'Zoom uses board coordinates');
g=setup([target]); g.selected={type:'tray',index:0};g.trayManager={getGemAt:()=> 'red'};assert.equal(g.tryAssistPlacement({x:27,y:0}),true);
for(const flag of ['finished','isAnimating','magnetRunning','wandMode','tutorialRunning']) {
    g=setup([target]);g[flag]=true;assert.equal(g.tryAssistPlacement({x:27,y:0}),false,flag);
}
g=setup([target]);g.selected=null;assert.equal(g.tryAssistPlacement({x:27,y:0}),false);
console.log('PASS: unique nearby region, nearest slot, diagonal connectivity, ambiguity, distance, exact/occupied hits, color, zoom, tray, and input guards');
