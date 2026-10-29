"""Import the supplied 52x74 bead chart as exact cells, not OCR text or a resize.
Usage: python tools/import-bead-pattern.py '/path/to/拼豆图纸-52x74.png'
Requires Pillow. The sampled fill colors and counts are checked against the legend.
"""
import argparse
from collections import Counter, deque
import json
from pathlib import Path
import random
import uuid
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
COLS, ROWS = 52, 74
GRID_X, GRID_Y, STEP = 68, 144, 32
# Use existing game identities, with an independent per-level RGB palette.
COLORS = [
    ('H20', 'S', 'gray', (150,160,159), 1674),
    ('H5',  'K', 'black', (70,70,72), 505),
    ('B15', 'G', 'green', (48,83,53), 129),
    ('E23', 'P', 'pink', (147,125,138), 83),
    ('G21', 'R', 'red', (179,133,97), 51),
    ('B32', 'Y', 'yellow', (146,173,96), 37),
    ('B21', 'B', 'blue', (24,97,106), 33),
    ('E7',  'W', 'white', (197,54,116), 33),
]
BACKGROUND = (247,244,239)

def extract(image):
    if image.size != (1764,2720):
        raise ValueError(f'Expected original 1764x2720 chart, got {image.size}; do not use a resized screenshot.')
    lookup = {rgb: symbol for _,symbol,_,rgb,_ in COLORS}
    lookup[BACKGROUND] = '.'
    result=[]
    for r in range(ROWS):
        row=[]
        for c in range(COLS):
            x,y=GRID_X+c*STEP,GRID_Y+r*STEP
            # The solid fill dominates this interior crop. Grid lines and the
            # white bead-code text are deliberately excluded from the borders.
            fill=Counter(image.crop((x+4,y+4,x+28,y+28)).getdata()).most_common(1)[0][0]
            if fill not in lookup: raise ValueError(f'Unknown fill {fill} at row {r+1}, column {c+1}')
            row.append(lookup[fill])
        result.append(''.join(row))
    counts=Counter(''.join(result))
    for code,symbol,_,_,expected in COLORS:
        if counts[symbol]!=expected: raise ValueError(f'{code}: expected {expected}, sampled {counts[symbol]}')
    assert sum(counts[k] for k in counts if k!='.')==2545
    return result

def scramble(target):
    """Swap connected, equal-size patches; preserve silhouette and every color.
    Most of the vase remains recognizable. Colored flowers and leaves are the
    playable regions, rather than forcing thousands of plain-gray bead moves.
    """
    rng=random.Random(20261029)
    current=[list(row) for row in target]
    remaining={(r,c) for r,row in enumerate(target) for c,v in enumerate(row) if v!='.'}
    changed=0
    def groups():
        unused=set(remaining); result=[]
        while unused:
            seed=min(unused);unused.remove(seed); group=[seed]
            for r,c in group:
                for pos in [(r-1,c),(r+1,c),(r,c-1),(r,c+1)]:
                    if pos in unused and target[pos[0]][pos[1]]==target[r][c]:
                        unused.remove(pos);group.append(pos)
            if len(group)>=2: result.append(group)
        return result
    def patch(group,n):
        unused=set(group);start=rng.choice(group);unused.remove(start);out=[start]
        for r,c in out:
            for pos in [(r-1,c),(r,c+1),(r+1,c),(r,c-1)]:
                if len(out)==n:return out
                if pos in unused:unused.remove(pos);out.append(pos)
        return out
    # 260 displaced gems provide a substantial level while keeping the tiny,
    # isolated decorative pixels correctly locked in place.
    while changed<260:
        all_groups=groups()
        candidates=[(a,b) for i,a in enumerate(all_groups) for b in all_groups[i+1:]
            if target[a[0][0]][a[0][1]]!=target[b[0][0]][b[0][1]]]
        if not candidates:break
        a,b=rng.choice(candidates)
        n=min(rng.choice([4,6,9,12]),len(a),len(b),(260-changed)//2)
        if n<2:break
        aa,bb=patch(a,n),patch(b,n)
        for (r,c),(y,x) in zip(aa,bb):
            current[r][c],current[y][x]=current[y][x],current[r][c]
            remaining.remove((r,c));remaining.remove((y,x))
        changed+=n*2
    initial=[''.join(row) for row in current]
    assert Counter(''.join(target))==Counter(''.join(initial))
    assert initial!=target
    return initial

def verify_solution(target,initial,capacity):
    """Solve using only connected wrong-color picks, the shelf, and matching
    empty target regions. No swap power-ups and no changes to correct gems.
    """
    cells={(r,c):v for r,row in enumerate(initial) for c,v in enumerate(row) if v!='.'}
    shelf=[]; moves=0
    def group(seed,predicate):
        seen={seed};out=[seed]
        for r,c in out:
            for p in [(r-1,c),(r+1,c),(r,c-1),(r,c+1)]:
                if p in cells and p not in seen and predicate(p):seen.add(p);out.append(p)
        return out
    while any(v!=target[r][c] for (r,c),v in cells.items()):
        options=[]
        empties=[p for p,v in cells.items() if v is None]
        for dest in empties:
            color=target[dest[0]][dest[1]]
            destinations=group(dest,lambda p:cells[p] is None and target[p[0]][p[1]]==color)
            for source,v in cells.items():
                if v==color and v!=target[source[0]][source[1]]:
                    sources=group(source,lambda p:cells[p]==color and cells[p]!=target[p[0]][p[1]])
                    options.append((min(len(sources),len(destinations)),sources,destinations,color,False))
            if color in shelf:options.append((min(shelf.count(color),len(destinations)),[],destinations,color,True))
        if options:
            n,sources,destinations,color,from_shelf=max(options,key=lambda option:option[0])
            if from_shelf:
                for _ in range(n):shelf.remove(color)
            else:
                for source in sources[:n]:cells[source]=None
            for dest in destinations[:n]:cells[dest]=color
        else:
            source=next(p for p,v in cells.items() if v is not None and v!=target[p[0]][p[1]])
            color=cells[source];sources=group(source,lambda p:cells[p]==color and cells[p]!=target[p[0]][p[1]])
            n=min(len(sources),capacity-len(shelf))
            if n<=0:raise ValueError('Generated level deadlocks with a full shelf')
            for source in sources[:n]:cells[source]=None;shelf.append(color)
        moves+=1
        if moves>3000:raise ValueError('Generated level failed to solve')
    assert not shelf
    return moves

def save_reward(target):
    # Technical rendering of extracted grid data: no text, labels or paper.
    rgb={symbol:color for _,symbol,_,color,_ in COLORS}
    tile=12;image=Image.new('RGBA',(COLS*tile,ROWS*tile))
    draw=ImageDraw.Draw(image)
    for r,row in enumerate(target):
        for c,symbol in enumerate(row):
            if symbol!='.':draw.rectangle((c*tile,r*tile,(c+1)*tile-1,(r+1)*tile-1),fill=(*rgb[symbol],255))
    output=ROOT/'assets/resources/artifacts/level_06_flower_vase.png'
    image.save(output)
    meta=Path(str(output)+'.meta')
    if not meta.exists():
        meta.write_text(json.dumps(dict(ver='1.0.27',importer='image',imported=False,uuid=str(uuid.uuid4()),
            files=[],subMetas={},userData={'type':'sprite-frame','hasAlpha':True}),indent=2)+'\n')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('image',type=Path);args=parser.parse_args()
    target=extract(Image.open(args.image).convert('RGB'));initial=scramble(target)
    moves=verify_solution(target,initial,36)
    palette={name:list(rgb) for _,_,name,rgb,_ in COLORS}
    data=dict(id=6,name='花卉长颈瓶',gridType='square',rows=ROWS,cols=COLS,trayCapacity=36,
        palette=palette,target=target,initial=initial,initialSwaps=[],
        starThresholds={'five':moves+20,'four':moves*2+30},
        source={'name':args.image.name,'beadCount':2545,'colors':[
            dict(code=code,symbol=symbol,color=name,rgb=list(rgb),count=count) for code,symbol,name,rgb,count in COLORS]})
    (ROOT/'assets/resources/levels/level_06.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    save_reward(target)
    print(json.dumps({'grid':[COLS,ROWS],'beads':2545,'colors':8,
        'displaced':sum(a!=b for x,y in zip(target,initial) for a,b in zip(x,y)),
        'legalSolutionMoves':moves},indent=2))
if __name__=='__main__':main()
