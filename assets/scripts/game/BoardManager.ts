import {
    _decorator, Component, Prefab, SpriteFrame,
    instantiate, UITransform, JsonAsset
} from 'cc';

import {
    GemCell,
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

    private parseColor(char: string): GemColor {
        if (char === 'Y') return 'yellow';
        if (char === 'B') return 'blue';
        if (char === 'R') return 'red';
        if (char === 'K') return 'black';
        if (char === 'W') return 'white';
        if (char === 'P') return 'pink';
        if (char === 'G') return 'green';
        throw new Error(`未知颜色 ${char}`);
    }

    private getGemFrames(): GemFrames {
        return {
            yellow: this.tileFrames.yellow ?? this.yellowGem ?? undefined,
            green: this.tileFrames.green,
            blue: this.tileFrames.blue ?? this.blueGem ?? undefined,
            red: this.redGem ?? undefined,
            black: this.tileFrames.black ?? this.blackGem ?? undefined,
            white: this.whiteGem ?? undefined,
            pink: this.pinkGem ?? undefined
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
        const frames = this.getGemFrames();
        const targetFrames: TargetFrames = {
            blue: this.blueTarget ?? this.targetFrames.blue,
            black: this.blackTarget ?? this.targetFrames.black,
            yellow: this.targetFrames.yellow,
            green: this.targetFrames.green
        };

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const type = this.pattern[row][col];
                if (type === '.') continue;

                const target = this.parseColor(type);
                const initialChar =
                    this.initialPattern?.[row]?.[col] ?? type;
                const initialColor = this.parseColor(initialChar);

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

        console.log(
            `[BoardManager] 创建 ${this.cells.length} 格，珠子尺寸 ${cellSize.toFixed(1)}`
        );
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

    public isCompleted(): boolean {
        return this.cells.length > 0 &&
            this.cells.every(cell => cell.isCorrect());
    }
}
