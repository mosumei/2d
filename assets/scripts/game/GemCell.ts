
import {
    _decorator, Component, Sprite, SpriteFrame,
    Color, Node, UITransform, Graphics, Layers
} from 'cc';

const { ccclass, property } = _decorator;

export type GemColor =
    'yellow' | 'blue' | 'red' | 'black' | 'white' | 'pink';

export type GemFrames =
    Partial<Record<GemColor, SpriteFrame>>;

export const GEM_COLORS: Record<GemColor, Color> = {
    yellow: new Color(255, 226, 150, 255),
    blue: new Color(150, 190, 235, 255),
    red: new Color(245, 180, 180, 255),
    black: new Color(170, 176, 186, 255),
    white: new Color(214, 222, 232, 255),
    pink: new Color(245, 196, 214, 255)
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
    private outline: Graphics | null = null;
    private cellSize = 60;

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
        frames: GemFrames
    ) {
        this.row = row;
        this.col = col;
        this.targetColor = target;
        this.currentColor = current;
        this.frames = frames;

        this.refreshView();
    }

    public setDisplaySize(size: number) {
        this.cellSize = size;
        this.node.getComponent(UITransform)
            ?.setContentSize(size, size);

        this.node.getChildByName('CellBackground')
            ?.getComponent(UITransform)
            ?.setContentSize(size, size);

        this.outline?.node.getComponent(UITransform)
            ?.setContentSize(size, size);

        this.refreshView();
    }

    public isEmpty(): boolean {
        return this.currentColor === null;
    }

    public isCorrect(): boolean {
        return this.currentColor !== null &&
            this.currentColor === this.targetColor;
    }

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

        // 底板永远根据目标颜色显示
        const bg = this.node
            .getChildByName('CellBackground')
            ?.getComponent(Sprite);

        if (bg) {
            bg.sizeMode = Sprite.SizeMode.CUSTOM;
            bg.color = GEM_COLORS[target];
        }

        // 当前放置的宝石
        if (this.gemSprite) {
            const color = this.currentColor;
            this.gemSprite.node.active = color !== null;

            if (color) {
                this.gemSprite.sizeMode =
                    Sprite.SizeMode.CUSTOM;

                this.gemSprite.spriteFrame =
                    this.frames[color] ?? null;

                this.gemSprite.color = Color.WHITE;

                const gemSize = this.cellSize * 0.92;
                this.gemSprite
                    .getComponent(UITransform)
                    ?.setContentSize(gemSize, gemSize);
            }
        }

        // 仅在格子为空时显示淡色目标宝石
        if (this.targetMarker) {
            this.targetMarker.node.active =
                this.currentColor === null;

            this.targetMarker.sizeMode =
                Sprite.SizeMode.CUSTOM;

            this.targetMarker.spriteFrame =
                this.frames[target] ?? null;

            this.targetMarker.color =
                new Color(255, 255, 255, 85);

            const markerSize = this.cellSize * 0.72;
            this.targetMarker
                .getComponent(UITransform)
                ?.setContentSize(markerSize, markerSize);
        }
    }

    // 显示或隐藏选中边框
    public setSelected(selected: boolean) {
        if (!this.outline) {
            const outlineNode = new Node('SelectionOutline');
            outlineNode.layer = Layers.Enum.UI_2D;
            outlineNode.parent = this.node;

            outlineNode.addComponent(UITransform)
                .setContentSize(this.cellSize, this.cellSize);

            this.outline = outlineNode.addComponent(Graphics);
        }

        this.outline.clear();

        if (!selected) return;

        const size = this.cellSize;
        const inset = Math.max(1, size * 0.04);

        this.outline.lineWidth = Math.max(1, size * 0.08);
        this.outline.strokeColor =
            new Color(255, 175, 35, 255);

        this.outline.roundRect(
            -size / 2 + inset,
            -size / 2 + inset,
            size - inset * 2,
            size - inset * 2,
            Math.max(2, size * 0.15)
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
