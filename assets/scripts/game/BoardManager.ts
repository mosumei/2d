
import {
    _decorator, Component, Prefab, SpriteFrame,
    instantiate, UITransform, JsonAsset
} from 'cc';

import { GemCell, GemColor, GemFrames } from './GemCell';

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

    public onCellClicked:
        ((cell: GemCell) => void) | null = null;

    private readonly cellSize = 60;
    private readonly gap = 3;

    private cells: GemCell[] = [];
    private pattern: string[] = [];

    @property(JsonAsset)
    levelData: JsonAsset | null = null;

    private parseColor(char: string): GemColor {
        if (char === 'Y') return 'yellow';
        if (char === 'B') return 'blue';
        if (char === 'R') return 'red';
        throw new Error(`未知颜色 ${char}`);
    }
    public loadLevel(
    target: string[],
    initialSwaps: number[][]
) {
    this.pattern = [...target];
    this.generateBoard(initialSwaps);
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
        const step = this.cellSize + this.gap;

        const width = cols * step - this.gap;
        const height = rows * step - this.gap;

        const frames: GemFrames = {
            yellow: this.yellowGem ?? undefined,
            blue: this.blueGem ?? undefined,
            red: this.redGem ?? undefined
        };

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const type = this.pattern[row][col];
                if (type === '.') continue;

                const target = this.parseColor(type);

                const node = instantiate(this.gemCellPrefab);
                node.name = `Gem_${row}_${col}`;
                node.parent = this.node;
                node.setScale(1, 1, 1);

                node.getComponent(UITransform)
                    ?.setContentSize(60, 60);

                const x = col * step - width / 2
                    + this.cellSize / 2;
                const y = height / 2 - row * step
                    - this.cellSize / 2;

                node.setPosition(x, y, 0);

                const cell = node.getComponent(GemCell);

                if (!cell) {
                    console.error('GemCell.prefab 缺少 GemCell.ts');
                    node.destroy();
                    continue;
                }

                cell.init(row, col, target, target, frames);

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
            `[BoardManager] 创建 ${this.cells.length} 格`
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
