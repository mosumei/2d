"""Deterministic pixel-art levels with color-conserving, solvable scrambles."""
import json, math, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def art(w,h):
    return [['.' for _ in range(w)] for _ in range(h)]
def ellipse(a,cx,cy,rx,ry,color):
    for y,row in enumerate(a):
        for x in range(len(row)):
            if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1: row[x]=color

def poly(a,points,color):
    for y,row in enumerate(a):
        for x in range(len(row)):
            inside=False
            for i,(x1,y1) in enumerate(points):
                x2,y2=points[i-1]
                if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: inside=not inside
            if inside: row[x]=color

def rect(a,x1,y1,x2,y2,color):
    for y in range(y1,y2+1):
        for x in range(x1,x2+1): a[y][x]=color

def elephant():
    a=art(23,25)
    ellipse(a,11,16,8.5,7.5,'K'); ellipse(a,11,16,6.8,6.3,'S'); ellipse(a,11,17,4.8,4.5,'W')
    rect(a,6,20,9,24,'K');rect(a,13,20,16,24,'K')
    ellipse(a,4,6,4.3,6.5,'K');ellipse(a,18,6,4.3,6.5,'K')
    ellipse(a,4,6,3,5,'P');ellipse(a,18,6,3,5,'P')
    ellipse(a,11,8,7,7,'K');ellipse(a,11,8,5.5,5.8,'S')
    rect(a,6,3,16,5,'K');rect(a,8,6,14,6,'Y')
    rect(a,7,8,8,9,'K');rect(a,14,8,15,9,'K')
    a[8][7]=a[8][14]='W'
    rect(a,9,9,12,16,'K');rect(a,10,10,11,15,'W')
    a[11][10]=a[13][10]='P';rect(a,12,15,14,16,'K')
    rect(a,14,12,15,15,'Y');rect(a,5,11,6,13,'Y')
    rect(a,7,23,8,23,'W');rect(a,14,23,15,23,'W')
    return a

def butterfly():
    a=art(27,25)
    for cx in [6,20]:
        ellipse(a,cx,7,6.8,7.5,'K');ellipse(a,cx,7,5.5,6.3,'B')
        ellipse(a,cx,7,3.8,4.7,'P');ellipse(a,cx,7,1.8,2.8,'Y')
        ellipse(a,cx+(-1 if cx<13 else 1),18,5.8,6,'K')
        ellipse(a,cx+(-1 if cx<13 else 1),18,4.4,4.7,'G')
        ellipse(a,cx+(-1 if cx<13 else 1),18,2.5,2.9,'Y')
    rect(a,12,4,14,21,'K');rect(a,13,7,13,18,'W')
    for y in [10,14,18]: a[y][13]='Y'
    for x,y in [(11,1),(10,0),(15,1),(16,0),(12,2),(14,2)]: a[y][x]='K'
    return a

def koi():
    a=art(27,27)
    ellipse(a,13,13,11.8,11.8,'B');ellipse(a,13,13,9.8,9.8,'W')
    poly(a,[(3,14),(0,10),(0,18),(5,17)],'K');poly(a,[(3,14),(1,12),(1,16),(5,16)],'R')
    ellipse(a,12,13,9,5.5,'K');ellipse(a,12,13,7.8,4.2,'W')
    ellipse(a,9,12,3,3,'R');ellipse(a,16,14,3,3.8,'R')
    poly(a,[(8,9),(10,4),(14,8)],'K');poly(a,[(9,9),(10,6),(12,8)],'Y')
    poly(a,[(10,17),(12,22),(16,17)],'Y')
    a[11][18]='K';a[11][19]='W';a[13][21]='K'
    for x,y in [(4,5),(21,4),(23,19),(5,22)]:
        if a[y][x]!='.': a[y][x]='Y'
    return a

def parrot():
    a=art(27,29)
    poly(a,[(12,19),(8,28),(12,26),(15,28),(18,18)],'K')
    poly(a,[(12,18),(10,26),(12,24),(14,26),(16,18)],'B')
    ellipse(a,13,15,7,10,'K');ellipse(a,13,15,5.5,8.7,'R')
    ellipse(a,13,15,4,6.5,'Y');ellipse(a,15,17,3,6,'G')
    ellipse(a,16,16,2.1,4.8,'B')
    ellipse(a,11,6,6.4,6.4,'K');ellipse(a,11,6,5.1,5.1,'R')
    ellipse(a,13,6,3.4,3.8,'W');ellipse(a,14,5,1,1,'K')
    poly(a,[(16,4),(23,6),(22,11),(18,10),(17,8)],'K')
    poly(a,[(17,5),(22,6),(21,8),(18,8)],'Y')
    rect(a,7,24,21,25,'K');rect(a,8,24,20,24,'Y')
    rect(a,11,23,12,24,'W');rect(a,16,23,17,24,'W')
    return a

def scramble(target,seed,ratio):
    rng=random.Random(seed); initial=[list(row) for row in target]
    unused={(r,c) for r,row in enumerate(target) for c,v in enumerate(row) if v!='.'}
    desired=int(len(unused)*ratio); changed=0
    def components():
        remaining=set(unused); groups=[]
        while remaining:
            seed=min(remaining); remaining.remove(seed); group=[seed]
            color=target[seed[0]][seed[1]]
            for r,c in group:
                for pos in [(r-1,c),(r+1,c),(r,c-1),(r,c+1)]:
                    if pos in remaining and target[pos[0]][pos[1]]==color:
                        remaining.remove(pos); group.append(pos)
            groups.append(group)
        return groups
    def patch(group,count):
        remaining=set(group); start=rng.choice(group); result=[start]; remaining.remove(start)
        for r,c in result:
            for pos in [(r-1,c),(r,c+1),(r+1,c),(r,c-1)]:
                if len(result)>=count: return result
                if pos in remaining: remaining.remove(pos);result.append(pos)
        return result
    while changed<desired:
        groups=[g for g in components() if len(g)>=3]
        candidates=[(a,b) for i,a in enumerate(groups) for b in groups[i+1:]
                    if target[a[0][0]][a[0][1]]!=target[b[0][0]][b[0][1]]]
        if not candidates: break
        a,b=rng.choice(candidates)
        n=min(rng.choice([6,9,12,18,24]),len(a),len(b),(desired-changed+1)//2)
        if n<2: break
        aa,bb=patch(a,n),patch(b,n)
        for (r,c),(y,x) in zip(aa,bb):
            initial[r][c],initial[y][x]=initial[y][x],initial[r][c]
            unused.remove((r,c));unused.remove((y,x))
        changed+=n*2
    return [''.join(row) for row in initial]

def main():
    for i,(name,draw,ratio,capacity) in enumerate([
        ('珠光小象',elephant,.70,48),('彩翼蝴蝶',butterfly,.78,48),
        ('锦鲤环游',koi,.83,60),('热带金刚鹦鹉',parrot,.88,60)],2):
        target=[''.join(row) for row in draw()]
        initial=scramble(target,2710+i,ratio)
        data=dict(id=i,name=name,gridType='square',rows=len(target),cols=len(target[0]),trayCapacity=capacity,
                  target=target,initial=initial,initialSwaps=[],starThresholds=dict(five=90+i*10,four=150+i*10))
        (ROOT/f'assets/resources/levels/level_{i:02}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        cells=sum(v!='.' for row in target for v in row)
        wrong=sum(a!=b for x,y in zip(target,initial) for a,b in zip(x,y))
        print(i,name,len(target[0]),len(target),cells,'cells,',wrong,'misplaced')
if __name__=='__main__':main()
