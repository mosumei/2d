
import {
    _decorator, Component, Node, UITransform,
    Graphics, Sprite, SpriteFrame, Color, Layers,
    Tween, tween, Vec3
} from 'cc';

import type { GemColor } from './GemCell';
import { loadTileSet, TileFrames } from './TileSprites';
import { drawBead, drawShelfSocket } from './GemVisuals';

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

    /** 底板尺寸变化后通知外面重新留出和道具行的空隙。 */
    public onShelfResized: (() => void) | null = null;

    private slots: Node[] = [];
    private gems: (GemColor | null)[] = [];
    private selectedIndex = -1;
    private liftedSlots: number[] = [];
    private tileFrames: TileFrames = {};

    private slotSize = 60;
    private gemSize = 44;
    private readonly slotGap = 8;
    private readonly maxTrayWidth = 640;
    /** 十二个槽收在一条浅色胶囊里，两边留出空隙。 */
    private readonly barWidth = 560;
    /** 槽的上下各留一截，单行时底板不会太厚。 */
    private readonly barPadY = 22;

public resetTray(capacity: number): Promise<void> {
    this.capacity = capacity;
    return loadTileSet().then((set) => {
        this.tileFrames = set.tiles;
        this.createSlots();
    });
}

    /**
     * 在已有棋子后面补空位。排满 12 个才新开一行，已有棋子留在原槽。
     * @param count 这次要加的空位数
     * @returns 新开行的高度。没有新开行时是 0，调用方不必上移托盘。
     */
    public addSlots(count: number): number {
        if (!this.isValid || this.slots.length === 0 || count <= 0) return 0;

        const columns = 12;
        const step = this.slotSize;
        let bottom = this.slots[0].position.y;
        for (const slot of this.slots) {
            if (slot.isValid && slot.position.y < bottom) bottom = slot.position.y;
        }

        let opened = 0;
        for (let n = 0; n < count; n++) {
            const index = this.capacity;
            const column = index % columns;
            let y = bottom;
            if (column === 0) {
                y = bottom - step;
                bottom = y;
                opened += 1;
            }
            const slot = new Node(`TraySlot_${index}`);
            slot.layer = Layers.Enum.UI_2D;
            slot.parent = this.node;
            slot.addComponent(UITransform).setContentSize(this.slotSize, this.slotSize);
            slot.setPosition((column - (columns - 1) / 2) * step, y, 0);
            slot.addComponent(Graphics);
            this.slots.push(slot);
            this.gems.push(null);
            this.capacity += 1;
            slot.on(Node.EventType.TOUCH_END, () => this.onSlotClicked?.(index), this);
            this.drawSlot(index);
        }

        this.resizeShelf();
        return opened * step;
    }

    /**
     * 按当前槽位画托盘底板。不描边。
     */
    private resizeShelf(): void {
        if (this.slots.length === 0) return;

        let minY = this.slots[0].position.y;
        let maxY = minY;
        for (const slot of this.slots) {
            if (!slot.isValid) continue;
            minY = Math.min(minY, slot.position.y);
            maxY = Math.max(maxY, slot.position.y);
        }

        const height = maxY - minY + this.slotSize + this.barPadY * 2;
        let backing = this.node.getChildByName('Shelf');
        if (!backing?.isValid) {
            backing = new Node('Shelf');
            backing.layer = Layers.Enum.UI_2D;
            backing.parent = this.node;
            backing.addComponent(UITransform);
            backing.addComponent(Graphics);
        }
        backing.setSiblingIndex(0);
        backing.setPosition(0, (minY + maxY) / 2, 0);
        backing.getComponent(UITransform)?.setContentSize(this.barWidth, height);
        const graphics = backing.getComponent(Graphics);
        if (graphics) {
            const radius = Math.min(28, height / 2);
            graphics.clear();
            graphics.fillColor = new Color(255, 236, 214, 255);
            graphics.roundRect(-this.barWidth / 2, -height / 2, this.barWidth, height, radius);
            graphics.fill();
        }
        this.node.getComponent(UITransform)?.setContentSize(this.barWidth, height);
        this.onShelfResized?.();
    }

    /**
     * 底板在托盘节点里的底边。还没铺开时返回 null。
     */
    public getShelfBottom(): number | null {
        const shelf = this.node.getChildByName('Shelf');
        const height = shelf?.getComponent(UITransform)?.contentSize.height ?? 0;
        if (!shelf?.isValid || height <= 0) return null;
        return shelf.position.y - height / 2;
    }

    /**
     * 底板在托盘节点里的顶边。还没铺开时返回 null。
     */
    public getShelfTop(): number | null {
        const shelf = this.node.getChildByName('Shelf');
        const height = shelf?.getComponent(UITransform)?.contentSize.height ?? 0;
        if (!shelf?.isValid || height <= 0) return null;
        return shelf.position.y + height / 2;
    }

    private createSlots() {
        for (const child of [...this.node.children]) {
            if (child.name === 'Shelf') continue;
            child.destroy();
        }

        this.slots = [];
        this.gems = Array(this.capacity).fill(null);
        this.selectedIndex = -1;
        this.liftedSlots = [];

        const count = Math.max(1, this.capacity);
        const columns = Math.min(12, count);
        const rows = Math.ceil(count / columns);
        this.slotSize = Math.min(46, Math.floor((this.barWidth - 80) / columns));
        this.gemSize = Math.round(this.slotSize * 48 / 60);
        const step = this.slotSize;

        for (let i = 0; i < this.capacity; i++) {
            const slot = new Node(`TraySlot_${i}`);
            slot.layer = Layers.Enum.UI_2D;
            slot.parent = this.node;

            slot.addComponent(UITransform)
                .setContentSize(this.slotSize, this.slotSize);

            slot.setPosition(
                (i % columns - (columns - 1) / 2) * step,
                ((rows - 1) / 2 - Math.floor(i / columns)) * step, 0
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
        this.resizeShelf();
    }

    private drawSlot(index: number) {
        const graphics =
            this.slots[index].getComponent(Graphics);

        if (!graphics) return;
        graphics.clear();

        drawShelfSocket(graphics, this.slotSize);
    }

    public getGemSize(): number { return this.gemSize; }

    public setSelectedIndex(index: number) {
        this.setLiftedSlots(index >= 0 ? [index] : []);
    }

    // 同一色的槽一起描边，并把棋子弹高，表示已拿起、尚未放回拼图。
    public setLiftedSlots(indices: number[]) {
        if (!this.isValid) return;

        const previous = Array.isArray(this.liftedSlots) ? this.liftedSlots : [];
        const next = Array.isArray(indices) ? indices : [];
        this.liftedSlots = [...next];
        this.selectedIndex = next.length > 0 ? next[0] : -1;
        if (!Array.isArray(this.slots)) return;

        const dirty: number[] = [];
        for (const index of previous) {
            if (dirty.indexOf(index) < 0) dirty.push(index);
        }
        for (const index of next) {
            if (dirty.indexOf(index) < 0) dirty.push(index);
        }
        for (const index of dirty) {
            if (!this.slots[index]?.isValid) continue;
            this.drawSlot(index);
            this.applyLift(index);
        }
    }

    private applyLift(index: number) {
        const gem = this.slots[index]?.getChildByName('GemImage');
        if (!gem?.isValid) return;
        const lifted = this.liftedSlots.indexOf(index) >= 0;
        const y = lifted ? this.slotSize * 0.28 : 0;
        const scale = lifted ? 1.08 : 1;
        if (Math.abs(gem.position.y - y) < 0.5 && Math.abs(gem.scale.x - scale) < 0.02) {
            return;
        }
        Tween.stopAllByTarget(gem);
        tween(gem)
            .to(0.14, {
                position: new Vec3(0, y, 0),
                scale: new Vec3(scale, scale, 1)
            }, { easing: 'quadOut' })
            .start();
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

    /**
     * 把托盘里同一颜色收成一段，并在这段后面留出空位。
     * 其他颜色保持原来的先后，只向右让开。
     * @param color 这次放进来的颜色
     * @param count 要留出的空位数
     * @returns 新棋子应落入的槽编号。空位不够时原样不动并返回空数组。
     */
    public reserveSameColorSlots(color: GemColor, count: number): number[] {
        if (count <= 0) return [];

        const packed: { color: GemColor; gem: Node; world: Vec3 }[] = [];
        for (let index = 0; index < this.gems.length; index++) {
            const gemColor = this.gems[index];
            const gem = this.slots[index]?.getChildByName('GemImage');
            if (!gemColor || !gem?.isValid) continue;
            packed.push({ color: gemColor, gem, world: gem.worldPosition.clone() });
        }
        if (packed.length + count > this.slots.length) return [];

        const first = packed.findIndex(item => item.color === color);
        const before: typeof packed = [];
        const same: typeof packed = [];
        const after: typeof packed = [];
        for (let index = 0; index < packed.length; index++) {
            const item = packed[index];
            if (item.color === color) {
                same.push(item);
            } else if (first < 0 || index < first) {
                before.push(item);
            } else {
                after.push(item);
            }
        }

        const incomingStart = before.length + same.length;
        const placements = [
            ...before.map((item, index) => ({ ...item, index })),
            ...same.map((item, index) => ({ ...item, index: before.length + index })),
            ...after.map((item, index) => ({ ...item, index: incomingStart + count + index }))
        ];

        this.setLiftedSlots([]);
        this.gems.fill(null);
        for (const item of placements) item.gem.removeFromParent();
        for (const item of placements) {
            this.gems[item.index] = item.color;
            const slot = this.slots[item.index];
            item.gem.parent = slot;
            const local = slot.getComponent(UITransform)!.convertToNodeSpaceAR(item.world);
            item.gem.setPosition(local);
            Tween.stopAllByTarget(item.gem);
            tween(item.gem)
                .to(0.16, { position: new Vec3(), scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
                .start();
        }

        const reserved: number[] = [];
        for (let index = 0; index < count; index++) reserved.push(incomingStart + index);
        return reserved;
    }

    private getFrame(color: GemColor): SpriteFrame | null {
        switch (color) {
            case 'yellow': return this.tileFrames.yellow ?? this.yellowGem;
            case 'blue': return this.tileFrames.blue ?? this.blueGem;
            case 'red': return this.tileFrames.red ?? this.redGem ?? null;
            case 'black': return this.tileFrames.black ?? this.blackGem;
            case 'white': return this.whiteGem ?? this.tileFrames.black ?? null;
            case 'pink': return this.tileFrames.pink ?? this.pinkGem ?? null;
            case 'gray': return this.tileFrames.black ?? this.blackGem ?? null;
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
        if (oldGem?.isValid) {
            Tween.stopAllByTarget(oldGem);
            oldGem.removeFromParent();
            oldGem.destroy();
        }

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
            drawBead(gem, this.gemSize, color);
        }

        this.drawSlot(index);
        this.applyLift(index);
        return true;
    }

    /**
     * 把还在托盘里的棋子按原来的顺序排到最左边，空槽留在右边。
     */
    public compact(): Promise<void> {
        const occupied: { color: GemColor; gem: Node; world: Vec3 }[] = [];
        this.gems.forEach((color, index) => {
            const gem = this.slots[index]?.getChildByName('GemImage');
            if (color && gem) occupied.push({ color, gem, world: gem.worldPosition.clone() });
        });
        this.liftedSlots = [];
        this.selectedIndex = -1;
        this.gems.fill(null);
        // Detach first so a moving bead cannot be mistaken for another slot's bead.
        for (const item of occupied) item.gem.removeFromParent();
        for (let index = 0; index < occupied.length; index++) {
            const { color, gem, world } = occupied[index];
            this.gems[index] = color;
            const slot = this.slots[index];
            gem.parent = slot;
            gem.setPosition(slot.getComponent(UITransform)!.convertToNodeSpaceAR(world));
            Tween.stopAllByTarget(gem);
            tween(gem).to(0.16, { position: new Vec3(), scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
        }
        return new Promise(resolve => this.scheduleOnce(resolve, 0.17));
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
