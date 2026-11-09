import {
    _decorator, Component, Prefab, SpriteFrame,
    instantiate, UITransform, JsonAsset, Graphics, Color, Node, Layers
} from 'cc';

import {
    GemCell,
    GEM_COLOR_LETTERS,
    GemColor,
    GemFrames,
    TargetFrames
} from './GemCell';
import { loadTileSet, TileFrames } from './TileSprites';

const { ccclass, property } = _decorator;

@ccclass('BoardManager')
export class BoardManager extends Component {

    @property(Prefab)
    gemCellPrefab: Prefab | null = null;

    @property(SpriteFrame)
    yellowGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    blueGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    redGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    blackGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    whiteGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    pinkGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    blueTarget: SpriteFrame | null = null;

    @property(SpriteFrame)
    blackTarget: SpriteFrame | null = null;

    @property
    maxBoardWidth = 600;

    @property
    maxBoardHeight = 720;

    @property
    maxCellSize = 60;

    @property
    cellGap = 1;

    public onCellClicked:
        ((cell: GemCell) => void) | null = null;

    private cells: GemCell[] = [];
    private pattern: string[] = [];
    private initialPattern: string[] | null = null;
    private tileFrames: TileFrames = {};
    private targetFrames: TileFrames = {};

    @property(JsonAsset)
    levelData: JsonAsset | null = null;

    private parseColor(char: string): GemColor | null {
        return GEM_COLOR_LETTERS[char] ?? null;
    }

    private getGemFrames(): GemFrames {
        return {
            ...this.tileFrames,
            yellow: this.tileFrames.yellow ?? this.yellowGem ?? undefined,
            blue: this.tileFrames.blue ?? this.blueGem ?? undefined,
            red: this.tileFrames.red ?? this.redGem ?? undefined,
            black: this.tileFrames.black ?? this.blackGem ?? undefined,
            pink: this.tileFrames.pink ?? this.pinkGem ?? undefined,
            white: this.tileFrames.white ?? this.whiteGem ?? undefined
        };
    }

    public loadLevel(
        target: string[],
        initialSwaps: number[][] = [],
        initial?: string[],
        onReady?: () => void
    ) {
        this.pattern = [...target];
        this.initialPattern = initial ? [...initial] : null;
        const swaps = this.initialPattern ? [] : initialSwaps;

        loadTileSet().then((set) => {
            this.tileFrames = set.tiles;
            this.targetFrames = set.targets;
            this.generateBoard(swaps);
            onReady?.();
        });
    }

    public generateBoard(
        initialSwaps: number[][] = []
    ) {
        if (!this.gemCellPrefab) {
            console.error('GemCell Prefab 未绑定');
            return;
        }

        for (const child of [...this.node.children]) {
            child.destroy();
        }

        this.cells = [];

        const rows = this.pattern.length;
        const cols = this.pattern[0].length;
        const gap = this.cellGap;
        const cellSize = Math.min(
            this.maxCellSize,
            (this.maxBoardWidth - (cols - 1) * gap) / cols,
            (this.maxBoardHeight - (rows - 1) * gap) / rows
        );
        const step = cellSize + gap;
        this.node.getComponent(UITransform)?.setContentSize(cols * step - gap, rows * step - gap);
        const frames = this.getGemFrames();
        const targetFrames: TargetFrames = {
            ...this.targetFrames,
            blue: this.targetFrames.blue ?? this.blueTarget ?? undefined,
            black: this.targetFrames.black ?? this.blackTarget ?? undefined
        };

        for (let row = 0; row < rows; row++) {
            const rawLine = this.pattern[row];
            if (typeof rawLine !== 'string') {
                console.error('[Board] 行不是字符串', row, rawLine);
                continue;
            }
            const initialLine = this.initialPattern?.[row];
            for (let col = 0; col < cols; col++) {
                const type = rawLine.charAt(col);
                if (type === '.' || type === '') continue;

                const target = this.parseColor(type);
                if (!target) {
                    console.error('[Board] 未知颜色', type, '行', row, rawLine);
                    continue;
                }
                const initialChar = typeof initialLine === 'string' ? initialLine.charAt(col) : type;
                const initialColor = initialChar === '.' ? null : this.parseColor(initialChar);

                const node = instantiate(this.gemCellPrefab);
                node.name = `Gem_${row}_${col}`;
                node.parent = this.node;
                node.setScale(1, 1, 1);

                const x = (col - (cols - 1) / 2) * step;
                const y = ((rows - 1) / 2 - row) * step;
                node.setPosition(x, y, 0);

                const cell = node.getComponent(GemCell);

                if (!cell) {
                    console.error('GemCell.prefab 缺少 GemCell.ts');
                    node.destroy();
                    continue;
                }

                cell.init(
                    row,
                    col,
                    target,
                    initialColor,
                    frames,
                    targetFrames
                );
                cell.setDisplaySize(cellSize);

                cell.onPressed = clicked => {
                    this.onCellClicked?.(clicked);
                };

                this.cells.push(cell);
            }
        }

        const filled = new Set(this.cells.map(cell => `${cell.row},${cell.col}`));
        for (const cell of this.cells) {
            cell.setGridEdges(
                !filled.has(`${cell.row},${cell.col + 1}`),
                !filled.has(`${cell.row + 1},${cell.col}`)
            );
        }

        for (const swap of initialSwaps) {
            if (swap.length !== 4) {
                console.warn('无效的交换配置:', swap);
                continue;
            }

            this.swapInitial(
                swap[0],
                swap[1],
                swap[2],
                swap[3]
            );
        }

        this.drawOutline(rows, cols, cellSize, step);
        console.log(
            `[BoardManager] 创建 ${this.cells.length} 格，珠子尺寸 ${cellSize.toFixed(1)}`
        );
    }

    /** 沿拼图阶梯外形描一圈，线在珠子外侧。 */
    private drawOutline(rows: number, cols: number, cellSize: number, step: number) {
        const half = step / 2;
        const width = Math.min(6, Math.max(2, cellSize * 0.16));
        const out = width / 2;
        const occupied = new Set<string>();
        for (let row = 0; row < rows; row++) {
            const line = this.pattern[row] ?? '';
            for (let col = 0; col < cols; col++) {
                if (line[col] !== '.') occupied.add(`${row},${col}`);
            }
        }
        const has = (row: number, col: number) => occupied.has(`${row},${col}`);
        type Point = { x: number; y: number };
        type Edge = { a: Point; b: Point; n: Point };
        const edges: Edge[] = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (!has(row, col)) continue;
                const x = (col - (cols - 1) / 2) * step;
                const y = ((rows - 1) / 2 - row) * step;
                const left = x - half;
                const right = x + half;
                const bottom = y - half;
                const top = y + half;
                if (!has(row - 1, col)) edges.push({ a: { x: left, y: top }, b: { x: right, y: top }, n: { x: 0, y: 1 } });
                if (!has(row, col + 1)) edges.push({ a: { x: right, y: top }, b: { x: right, y: bottom }, n: { x: 1, y: 0 } });
                if (!has(row + 1, col)) edges.push({ a: { x: right, y: bottom }, b: { x: left, y: bottom }, n: { x: 0, y: -1 } });
                if (!has(row, col - 1)) edges.push({ a: { x: left, y: bottom }, b: { x: left, y: top }, n: { x: -1, y: 0 } });
            }
        }
        if (edges.length === 0) return;

        const key = (point: Point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        const from = new Map<string, Edge[]>();
        for (const edge of edges) {
            const list = from.get(key(edge.a)) ?? [];
            list.push(edge);
            from.set(key(edge.a), list);
        }
        const unused = new Set(edges);
        const loops: Edge[][] = [];
        while (unused.size > 0) {
            let edge = unused.values().next().value as Edge;
            const loop: Edge[] = [];
            while (edge && unused.has(edge)) {
                unused.delete(edge);
                loop.push(edge);
                edge = (from.get(key(edge.b)) ?? []).find(item => unused.has(item)) as Edge;
            }
            if (loop.length > 1) loops.push(loop);
        }

        const node = new Node('BoardOutline');
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.node;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(cols * step, rows * step);
        transform.hitTest = () => false;
        const graphics = node.addComponent(Graphics);
        graphics.lineWidth = width;
        graphics.lineJoin = Graphics.LineJoin.ROUND;
        graphics.lineCap = Graphics.LineCap.ROUND;
        graphics.strokeColor = new Color(255, 255, 255, 255);
        for (const loop of loops) {
            const first = this.outlinePoint(loop[loop.length - 1], loop[0], out);
            graphics.moveTo(first.x, first.y);
            for (let index = 0; index < loop.length; index++) {
                const point = this.outlinePoint(loop[index], loop[(index + 1) % loop.length], out);
                graphics.lineTo(point.x, point.y);
            }
            graphics.close();
            graphics.stroke();
        }
    }

    private outlinePoint(
        incoming: { n: { x: number; y: number } },
        outgoing: { a: { x: number; y: number }; n: { x: number; y: number } },
        out: number
    ) {
        const sx = incoming.n.x + outgoing.n.x;
        const sy = incoming.n.y + outgoing.n.y;
        return {
            x: outgoing.a.x + (sx === 0 ? 0 : Math.sign(sx) * out),
            y: outgoing.a.y + (sy === 0 ? 0 : Math.sign(sy) * out)
        };
    }

    private swapInitial(
        r1: number, c1: number,
        r2: number, c2: number
    ) {
        const a = this.getCell(r1, c1);
        const b = this.getCell(r2, c2);

        if (!a || !b) return;

        const temp = a.currentColor;
        a.setCurrentColor(b.currentColor);
        b.setCurrentColor(temp);
    }

    public getMovableCells(): GemCell[] {
        return this.cells.filter(cell => cell.canMove());
    }

    public getCells(): GemCell[] {
        return this.cells;
    }

    public getCell(
        row: number,
        col: number
    ): GemCell | undefined {
        return this.cells.find(
            cell => cell.row === row && cell.col === col
        );
    }

    public getTargetRegions(): GemCell[][] {
        const remaining = new Set(this.cells);
        const regions: GemCell[][] = [];
        const byPosition = new Map(this.cells.map(cell => [`${cell.row}:${cell.col}`, cell]));
        for (const seed of this.cells) {
            if (!remaining.delete(seed)) continue;
            const group = [seed];
            for (let i = 0; i < group.length; i++) {
                const cell = group[i];
                for (const [r, c] of [[cell.row - 1, cell.col], [cell.row + 1, cell.col],
                    [cell.row, cell.col - 1], [cell.row, cell.col + 1]]) {
                    const next = byPosition.get(`${r}:${c}`);
                    if (next && next.targetColor === seed.targetColor && remaining.delete(next)) group.push(next);
                }
            }
            regions.push(group);
        }
        return regions;
    }

    public isCompleted(): boolean {
        return this.cells.length > 0 &&
            this.cells.every(cell => cell.isCorrect());
    }
}
