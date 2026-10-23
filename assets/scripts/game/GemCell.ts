import {
    _decorator,
    Component,
    Sprite,
    SpriteFrame,
    Color,
    Node,
    UITransform,
    Graphics,
    Layers
} from 'cc';

const { ccclass, property } = _decorator;

// 保留六种颜色编码，方便兼容旧关卡
export type GemColor =
    | 'yellow'
    | 'blue'
    | 'red'
    | 'black'
    | 'white'
    | 'pink'
    | 'green';

// 玩家可以移动的立体方块
export type GemFrames =
    Partial<Record<GemColor, SpriteFrame>>;

// 固定的目标底色方块
export type TargetFrames =
    Partial<Record<GemColor, SpriteFrame>>;

// 保留颜色常量，兼容可能引用它的旧脚本
export const GEM_COLORS: Record<GemColor, Color> = {
    yellow: new Color(255, 212, 58, 255),
    blue: new Color(0, 85, 255, 255),
    red: new Color(245, 93, 100, 255),
    black: new Color(68, 68, 68, 255),
    white: new Color(255, 255, 255, 255),
    pink: new Color(255, 102, 187, 255),
    green: new Color(46, 190, 72, 255)
};

@ccclass('GemCell')
export class GemCell extends Component {

    @property(Sprite)
    gemSprite: Sprite | null = null;

    @property(Sprite)
    targetMarker: Sprite | null = null;

    public row = 0;
    public col = 0;

    public targetColor: GemColor | null = null;
    public currentColor: GemColor | null = null;

    public onPressed:
        ((cell: GemCell) => void) | null = null;

    private frames: GemFrames = {};
    private targetFrames: TargetFrames = {};

    private displaySize = 60;
    private outline: Graphics | null = null;

    onLoad() {
        this.node.on(
            Node.EventType.TOUCH_END,
            this.handleClick,
            this
        );
    }

    public init(
        row: number,
        col: number,
        target: GemColor,
        current: GemColor | null,
        frames: GemFrames,
        targetFrames: TargetFrames = {}
    ) {
        this.row = row;
        this.col = col;

        this.targetColor = target;
        this.currentColor = current;

        this.frames = frames;
        this.targetFrames = targetFrames;

        this.refreshView();
    }

    // BoardManager 调用，自动适配棋盘格尺寸
    public setDisplaySize(size: number) {
        this.displaySize = Math.max(4, size);

        this.node
            .getComponent(UITransform)
            ?.setContentSize(
                this.displaySize,
                this.displaySize
            );

        this.refreshView();
    }

    public isEmpty(): boolean {
        return this.currentColor === null;
    }

    public isCorrect(): boolean {
        return (
            this.currentColor !== null &&
            this.currentColor === this.targetColor
        );
    }

    public getDisplaySize(): number {
        return this.displaySize;
    }

    public getGemFrame(color: GemColor): SpriteFrame | null {
        return this.frames[color] ?? null;
    }

    public getTargetFrame(): SpriteFrame | null {
        if (!this.targetColor) return null;
        return this.targetFrames[this.targetColor] ?? null;
    }

    // 已正确的方块自动锁定
    public canMove(): boolean {
        return !this.isEmpty() && !this.isCorrect();
    }

    public setCurrentColor(color: GemColor | null) {
        this.currentColor = color;
        this.refreshView();
    }

    public refreshView() {
        const target = this.targetColor;
        if (!target) return;

        const size = this.displaySize;

        // 1. 固定底板：永远使用目标颜色
        const background = this.node
            .getChildByName('CellBackground')
            ?.getComponent(Sprite);

        if (background) {
            const targetFrame =
                this.targetFrames[target];

            background.node.active = true;
            background.sizeMode =
                Sprite.SizeMode.CUSTOM;

            if (targetFrame) {
                background.spriteFrame = targetFrame;
                background.color = Color.WHITE;
            } else {
                background.color = GEM_COLORS[target];
            }

            background
                .getComponent(UITransform)
                ?.setContentSize(size, size);
        }

        // 2. 上层：当前可交换的立体方块
        if (this.gemSprite) {
            const current = this.currentColor;

            this.gemSprite.node.active =
                current !== null;

            if (current !== null) {
                this.gemSprite.sizeMode =
                    Sprite.SizeMode.CUSTOM;

                this.gemSprite.spriteFrame =
                    this.frames[current] ?? null;

                this.gemSprite.color = Color.WHITE;

                const gemSize = size * 0.5;
                this.gemSprite
                    .getComponent(UITransform)
                    ?.setContentSize(gemSize, gemSize);
            }
        }

        // 3. 空位：显示淡化的目标提示
        if (this.targetMarker) {
            const empty = this.isEmpty();

            this.targetMarker.node.active = empty;

            if (empty) {
                this.targetMarker.sizeMode =
                    Sprite.SizeMode.CUSTOM;

                this.targetMarker.spriteFrame =
                    this.targetFrames[target] ??
                    this.frames[target] ??
                    null;

                this.targetMarker.color =
                    new Color(255, 255, 255, 90);

                this.targetMarker
                    .getComponent(UITransform)
                    ?.setContentSize(
                        size * 0.88,
                        size * 0.88
                    );
            }
        }

        // 选择边框尺寸跟随格子尺寸更新
        this.outline?.clear();
    }

    public setSelected(selected: boolean) {
        if (!this.outline) {
            const outlineNode =
                new Node('SelectionOutline');

            outlineNode.layer = Layers.Enum.UI_2D;
            outlineNode.parent = this.node;

            outlineNode
                .addComponent(UITransform)
                .setContentSize(
                    this.displaySize,
                    this.displaySize
                );

            this.outline =
                outlineNode.addComponent(Graphics);
        }

        this.outline.clear();

        if (!selected) return;

        const half = this.displaySize / 2;
        const inset = Math.min(
            2,
            this.displaySize * 0.06
        );

        this.outline.lineWidth = Math.max(
            1.5,
            this.displaySize * 0.06
        );

        this.outline.strokeColor =
            new Color(255, 205, 55, 255);

        this.outline.roundRect(
            -half + inset,
            -half + inset,
            this.displaySize - inset * 2,
            this.displaySize - inset * 2,
            Math.max(2, this.displaySize * 0.1)
        );

        this.outline.stroke();
    }

    private handleClick() {
        this.onPressed?.(this);
    }

    onDestroy() {
        this.node.off(
            Node.EventType.TOUCH_END,
            this.handleClick,
            this
        );
    }
}
