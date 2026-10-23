
import {
    _decorator, Component, Node, UITransform,
    Graphics, Sprite, SpriteFrame, Color, Layers
} from 'cc';

import type { GemColor } from './GemCell';
import { loadTileSet, TileFrames } from './TileSprites';

const { ccclass, property } = _decorator;

@ccclass('TrayManager')
export class TrayManager extends Component {

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

    @property
    capacity = 8;

    @property
    previewSamples = false;
    // 获取指定槽位节点，用于飞行动画
public getSlotNode(index: number): Node | null {
    return this.slots[index] ?? null;
}

// 获取可用的空槽位
public getFirstEmptySlot(): number {
    return this.gems.indexOf(null);
}

    public onSlotClicked:
        ((index: number) => void) | null = null;

    private slots: Node[] = [];
    private gems: (GemColor | null)[] = [];
    private selectedIndex = -1;
    private liftedSlots: number[] = [];
    private tileFrames: TileFrames = {};

    private readonly slotSize = 60;
    private readonly gemSize = 44;
    private readonly slotGap = 8;

public resetTray(capacity: number) {
    this.capacity = capacity;
    loadTileSet().then((set) => {
        this.tileFrames = set.tiles;
        this.createSlots();
    });
}

    private createSlots() {
        for (const child of [...this.node.children]) {
            child.destroy();
        }

        this.slots = [];
        this.gems = Array(this.capacity).fill(null);
        this.selectedIndex = -1;
        this.liftedSlots = [];

        const step = this.slotSize + this.slotGap;
        const width = this.capacity * step - this.slotGap;

        for (let i = 0; i < this.capacity; i++) {
            const slot = new Node(`TraySlot_${i}`);
            slot.layer = Layers.Enum.UI_2D;
            slot.parent = this.node;

            slot.addComponent(UITransform)
                .setContentSize(this.slotSize, this.slotSize);

            slot.setPosition(
                i * step - width / 2 + this.slotSize / 2,
                0, 0
            );

            const graphics = slot.addComponent(Graphics);
            this.slots.push(slot);

            slot.on(
                Node.EventType.TOUCH_END,
                () => this.onSlotClicked?.(i),
                this
            );

            this.drawSlot(i);
        }
    }

    private drawSlot(index: number) {
        const graphics =
            this.slots[index].getComponent(Graphics);

        if (!graphics) return;
        graphics.clear();

        const size = this.slotSize;
        const selected = this.liftedSlots.indexOf(index) >= 0;

        graphics.fillColor =
            new Color(245, 249, 255, 245);
        graphics.roundRect(
            -size / 2, -size / 2,
            size, size, 10
        );
        graphics.fill();

        graphics.strokeColor = selected
            ? new Color(255, 170, 25, 255)
            : new Color(175, 195, 225, 255);

        graphics.lineWidth = selected ? 4 : 2;
        graphics.roundRect(
            -size / 2 + 2, -size / 2 + 2,
            size - 4, size - 4, 9
        );
        graphics.stroke();
    }

    public setSelectedIndex(index: number) {
        this.setLiftedSlots(index >= 0 ? [index] : []);
    }

    // 同一色的槽一起描边，并把棋子弹高，表示已拿起、尚未放回拼图。
    public setLiftedSlots(indices: number[]) {
        const previous = this.liftedSlots;
        this.liftedSlots = [...indices];
        this.selectedIndex = indices.length > 0 ? indices[0] : -1;

        const dirty: number[] = [];
        for (const index of previous) {
            if (dirty.indexOf(index) < 0) dirty.push(index);
        }
        for (const index of indices) {
            if (dirty.indexOf(index) < 0) dirty.push(index);
        }
        for (const index of dirty) {
            if (!this.slots[index]) continue;
            this.drawSlot(index);
            this.applyLift(index);
        }
    }

    private applyLift(index: number) {
        const gem = this.slots[index]?.getChildByName('GemImage');
        if (!gem) return;
        const lifted = this.liftedSlots.indexOf(index) >= 0;
        gem.setPosition(0, lifted ? 16 : 0, 0);
        const scale = lifted ? 1.08 : 1;
        gem.setScale(scale, scale, 1);
    }

    public getGemAt(index: number): GemColor | null {
        return this.gems[index] ?? null;
    }

    public isEmptyAt(index: number): boolean {
        return index >= 0 &&
            index < this.capacity &&
            this.gems[index] === null;
    }

    public firstEmptyIndex(): number {
        return this.gems.indexOf(null);
    }

    public getEmptyIndices(): number[] {
        const indices: number[] = [];
        for (let i = 0; i < this.gems.length; i++) {
            if (this.gems[i] === null) indices.push(i);
        }
        return indices;
    }

    private getFrame(color: GemColor): SpriteFrame | null {
        switch (color) {
            case 'yellow': return this.tileFrames.yellow ?? this.yellowGem;
            case 'blue': return this.tileFrames.blue ?? this.blueGem;
            case 'red': return this.redGem;
            case 'black': return this.tileFrames.black ?? this.blackGem;
            case 'white': return this.whiteGem;
            case 'pink': return this.pinkGem;
            case 'green': return this.tileFrames.green ?? null;
            default: {
                const unknown: never = color;
                return unknown;
            }
        }
    }

    public setGemAt(
        index: number,
        color: GemColor | null
    ): boolean {
        if (index < 0 || index >= this.capacity) return false;
        if (color && !this.getFrame(color)) return false;

        const slot = this.slots[index];
        if (!slot) return false;

        const oldGem = slot.getChildByName('GemImage');
        oldGem?.destroy();

        this.gems[index] = color;

        if (color) {
            const gem = new Node('GemImage');
            gem.layer = Layers.Enum.UI_2D;
            gem.parent = slot;

            const ui = gem.addComponent(UITransform);
            const sprite = gem.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = this.getFrame(color);
            sprite.color = Color.WHITE;

            ui.setContentSize(this.gemSize, this.gemSize);
            gem.setPosition(0, 0, 0);
            gem.setScale(1, 1, 1);
        }

        this.drawSlot(index);
        this.applyLift(index);
        return true;
    }

    public addGem(color: GemColor): boolean {
        const index = this.firstEmptyIndex();
        if (index < 0) return false;
        return this.setGemAt(index, color);
    }

    public removeGem(index: number): GemColor | null {
        const color = this.getGemAt(index);
        if (!color) return null;

        this.setGemAt(index, null);
        return color;
    }

    public getGemCount(): number {
        return this.gems.filter(v => v !== null).length;
    }

    public isFull(): boolean {
        return this.firstEmptyIndex() === -1;
    }
}
