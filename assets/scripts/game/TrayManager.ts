
import {
    _decorator, Button, Component, EventTouch, Node, UITransform,
    Graphics, Sprite, SpriteFrame, Color, Layers,
    Tween, tween, Vec2, Vec3, Label, resources, UIOpacity
} from 'cc';

import type { GemColor } from './GemCell';
import { loadTileSet, trayWellPaths, TileFrames } from './TileSprites';
import { drawBead, illustratedGemRatio } from './GemVisuals';

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
    /** 返回 false 时，绿色按钮不开始假广告。 */
    public canWatchAd: (() => boolean) | null = null;

    private watchingAd = false;

    private slots: Node[] = [];
    private gems: (GemColor | null)[] = [];
    private selectedIndex = -1;
    private liftedSlots: number[] = [];
    private tileFrames: TileFrames = {};
    private wellFrame: SpriteFrame | null = null;
    private faintWellFrame: SpriteFrame | null = null;

    private slotSize = 60;
    private wellSize = 54;
    private gemSize = 44;
    private readonly slotGap = 8;
    private readonly maxTrayWidth = 640;
    /** 十二个槽收在一条浅色胶囊里，两边留出空隙。 */
    private readonly barWidth = 560;
    /** 槽的上下各留一截，单行时底板不会太厚。 */
    private readonly barPadY = 14;
    /** 底边青绿按钮的高度。一半压在托盘上，一半探出去。 */
    private readonly addPillHeight = 46;
    /** 一行 12 个孔，托盘最多六行。 */
    private readonly maxSlots = 72;

public resetTray(capacity: number): Promise<void> {
    this.capacity = capacity;
    return Promise.all([loadTileSet(), this.loadWell()]).then(([set]) => {
        this.tileFrames = set.tiles;
        this.createSlots();
    });
}

    private loadWell(): Promise<void> {
        const wells = trayWellPaths();
        return Promise.all([
            this.loadWellFrame(wells.well, frame => { this.wellFrame = frame; }),
            this.loadWellFrame(wells.faint, frame => { this.faintWellFrame = frame; })
        ]).then(() => undefined);
    }

    private loadWellFrame(path: string, assign: (frame: SpriteFrame) => void): Promise<void> {
        return new Promise(resolve => {
            resources.load(path, SpriteFrame, (error, frame) => {
                if (error || !frame) {
                    if (error) console.error(`[Tray] 加载 ${path} 失败`, error);
                    resolve();
                    return;
                }
                assign(frame);
                resolve();
            });
        });
    }

    /**
     * 在已有棋子后面补空位。排满 12 个才新开一行，已有棋子留在原槽。
     * @param count 这次要加的空位数
     * @returns 新开行的高度。没有新开行时是 0，调用方不必上移托盘。
     */
    public addSlots(count: number): number {
        const room = this.maxSlots - this.slots.length;
        const adding = Math.min(count, room);
        if (!this.isValid || this.slots.length === 0 || adding <= 0) return 0;

        const columns = 12;
        const step = this.slotSize;
        let bottom = this.slots[0].position.y;
        for (const slot of this.slots) {
            if (slot.isValid && slot.position.y < bottom) bottom = slot.position.y;
        }

        let opened = 0;
        for (let n = 0; n < adding; n++) {
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
            this.drawSlot(index);
        }

        this.resizeShelf();
        return opened * step;
    }

    /**
     * 在已有槽位后面追加空孔，并逐个弹出。
     * @param count 要加的空孔数
     */
    public grantSlots(count: number) {
        if (!this.isValid || count <= 0 || this.slots.length === 0) return;
        const start = this.slots.length;
        this.addSlots(count);
        const fresh = this.slots.slice(start);
        fresh.forEach((slot, index) => {
            if (!slot?.isValid) return;
            slot.setScale(0.2, 0.2, 1);
            const opacity = slot.getComponent(UIOpacity) ?? slot.addComponent(UIOpacity);
            opacity.opacity = 0;
            const delay = index * 0.06;
            tween(slot)
                .delay(delay)
                .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
            tween(opacity)
                .delay(delay)
                .to(0.34, { opacity: 255 })
                .start();
        });
        this.flashShelf();
    }

    /** 托盘底板闪白，表示刚加了一排孔。 */
    private flashShelf() {
        const shelf = this.node.getChildByName('Shelf');
        const shelfUi = shelf?.getComponent(UITransform);
        if (!shelf?.isValid || !shelfUi) return;
        const previous = shelf.getChildByName('ShelfFlash');
        if (previous?.isValid) previous.destroy();

        const flash = new Node('ShelfFlash');
        flash.layer = Layers.Enum.UI_2D;
        flash.parent = shelf;
        flash.setSiblingIndex(0);
        const width = shelfUi.contentSize.width;
        const height = shelfUi.contentSize.height;
        flash.addComponent(UITransform).setContentSize(width, height);
        const graphics = flash.addComponent(Graphics);
        const radius = Math.min(36, height * 0.42);
        graphics.fillColor = new Color(255, 255, 255, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.fill();
        const opacity = flash.addComponent(UIOpacity);
        opacity.opacity = 0;
        const transform = flash.getComponent(UITransform);
        if (transform) transform.hitTest = () => false;
        tween(opacity)
            .to(0.16, { opacity: 170 })
            .to(0.56, { opacity: 0 })
            .call(() => {
                if (flash.isValid) flash.destroy();
            })
            .start();
    }

    /**
     * 按当前槽位画托盘底板。圆角奶油色，外圈用软阴影托起，底边挂着青绿按钮。
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
        if (this.slots.length % 12 === 0 && this.slots.length < this.maxSlots) minY -= this.slotSize;

        const height = maxY - minY + this.slotSize + this.barPadY * 2;
        let backing = this.node.getChildByName('Shelf');
        if (!backing?.isValid) {
            backing = new Node('Shelf');
            backing.layer = Layers.Enum.UI_2D;
            backing.parent = this.node;
            backing.addComponent(UITransform);
            backing.addComponent(Graphics);
        }
        const centerY = (minY + maxY) / 2;
        backing.setPosition(0, centerY, 0);
        backing.getComponent(UITransform)?.setContentSize(this.barWidth, height);
        const radius = Math.min(36, height * 0.42);
        const graphics = backing.getComponent(Graphics);
        if (graphics) {
            graphics.clear();
            graphics.fillColor = new Color(255, 248, 236, 255);
            graphics.roundRect(-this.barWidth / 2, -height / 2, this.barWidth, height, radius);
            graphics.fill();
        }
        this.paintShelfShadow(this.barWidth, height, radius, centerY);
        backing.setSiblingIndex(1);
        this.ensureAddPill(backing, height);
        this.ensureSlotDash();
        this.node.getComponent(UITransform)?.setContentSize(this.barWidth, height + this.addPillHeight);
        this.bindTrayTouch();
        this.onShelfResized?.();
    }

    /**
     * 底板外面的一圈软阴影。叠在底板后面，不接收点击。
     */
    private paintShelfShadow(width: number, height: number, radius: number, centerY: number): void {
        let shadow = this.node.getChildByName('ShelfShadow');
        if (!shadow?.isValid) {
            shadow = new Node('ShelfShadow');
            shadow.layer = Layers.Enum.UI_2D;
            shadow.parent = this.node;
            shadow.addComponent(Graphics);
            const transform = shadow.addComponent(UITransform);
            transform.hitTest = () => false;
        }
        shadow.setPosition(0, centerY, 0);
        shadow.setSiblingIndex(0);
        shadow.getComponent(UITransform)?.setContentSize(width + 12, height + 12);
        const graphics = shadow.getComponent(Graphics);
        if (!graphics) return;
        graphics.clear();
        const layers = 5;
        for (let index = layers; index >= 1; index--) {
            const spread = 0.4 + index * 0.5;
            const drop = 0.5 + index * 0.15;
            const alpha = Math.round(3 + 7 * (1 - index / layers));
            graphics.fillColor = new Color(196, 176, 148, alpha);
            graphics.roundRect(
                -width / 2 - spread + 0.4,
                -height / 2 - spread - drop,
                width + spread * 2,
                height + spread * 2,
                radius + spread * 0.4
            );
            graphics.fill();
        }
    }

    /**
     * 整条托盘都能点。点在底板或孔之间时，选中最近的那一颗。
     */
    private bindTrayTouch() {
        const ui = this.node.getComponent(UITransform);
        if (ui) ui.hitTest = (screenPoint: Vec2, windowId = 0) => this.hitsTray(screenPoint, windowId);
        this.node.off(Node.EventType.TOUCH_END, this.onTrayTouch, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTrayTouch, this);
    }

    /** 只有看得见的托盘和绿色按钮接收点击，避免挡住上面的拼图。 */
    private hitsTray(screenPoint: Vec2, windowId = 0): boolean {
        const shelf = this.node.getChildByName('Shelf');
        const shelfUi = shelf?.getComponent(UITransform);
        if (shelfUi?.hitTest(screenPoint, windowId)) return true;
        const pillNode = shelf?.getChildByName('AddPill');
        if (!pillNode?.active) return false;
        return pillNode.getComponent(UITransform)?.hitTest(screenPoint, windowId) ?? false;
    }

    private onTrayTouch(event: EventTouch) {
        const shelf = this.node.getChildByName('Shelf');
        const shelfUi = shelf?.getComponent(UITransform);
        const trayUi = this.node.getComponent(UITransform);
        if (!shelf?.isValid || !shelfUi || !trayUi) return;

        const point = event.getUILocation();
        const local = trayUi.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        const barWidth = shelfUi.contentSize.width;
        const barHeight = shelfUi.contentSize.height;
        const onSlot = this.slotAt(local.x, local.y);
        if (onSlot >= 0) {
            this.onSlotClicked?.(onSlot);
            return;
        }
        const insideShelf = local.x >= shelf.position.x - barWidth / 2
            && local.x <= shelf.position.x + barWidth / 2
            && local.y >= shelf.position.y - barHeight / 2
            && local.y <= shelf.position.y + barHeight / 2;
        if (!insideShelf || this.hitsAddPill(shelf, local.x, local.y)) return;

        const index = this.nearestSlot(local.x, local.y);
        if (index >= 0) this.onSlotClicked?.(index);
    }

    /** 点落在某个圆孔方框里时，返回那个槽。圆孔优先于绿色按钮。 */
    private slotAt(x: number, y: number): number {
        const half = this.slotSize / 2;
        let nearest = -1;
        let nearestDistance = Infinity;
        for (let index = 0; index < this.slots.length; index++) {
            const slot = this.slots[index];
            if (!slot?.isValid) continue;
            const dx = slot.position.x - x;
            const dy = slot.position.y - y;
            if (Math.abs(dx) > half || Math.abs(dy) > half) continue;
            const distance = dx * dx + dy * dy;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = index;
            }
        }
        return nearest;
    }

    private hitsAddPill(shelf: Node, x: number, y: number): boolean {
        const pill = shelf.getChildByName('AddPill');
        const pillUi = pill?.getComponent(UITransform);
        if (!pill?.isValid || !pill.active || !pillUi) return false;
        const centerX = shelf.position.x + pill.position.x;
        const centerY = shelf.position.y + pill.position.y;
        const halfWidth = pillUi.contentSize.width / 2;
        const halfHeight = pillUi.contentSize.height / 2;
        return x >= centerX - halfWidth && x <= centerX + halfWidth
            && y >= centerY - halfHeight && y <= centerY + halfHeight;
    }

    private nearestSlot(x: number, y: number): number {
        let nearest = -1;
        let nearestDistance = Infinity;
        for (let index = 0; index < this.slots.length; index++) {
            const slot = this.slots[index];
            if (!slot?.isValid) continue;
            const dx = slot.position.x - x;
            const dy = slot.position.y - y;
            const distance = dx * dx + dy * dy;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = index;
            }
        }
        return nearest;
    }

    /** 底边中间的青绿按钮。点下去先假看一段广告，再加三个空孔。 */
    private ensureAddPill(shelf: Node, barHeight: number) {
        let pill = shelf.getChildByName('AddPill');
        if (!pill?.isValid) {
            pill = new Node('AddPill');
            pill.layer = Layers.Enum.UI_2D;
            pill.parent = shelf;
            const transform = pill.addComponent(UITransform);
            transform.setContentSize(180, this.addPillHeight);
            pill.addComponent(Graphics);
            this.paintAddPill(pill);
            const button = pill.addComponent(Button);
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 1.05;
            pill.on(Button.EventType.CLICK, this.onAddPillClick, this);
        }
        pill.getChildByName('FaintWell')?.setPosition(-56, 0, 0);
        pill.getChildByName('FaintWell')?.getComponent(UITransform)?.setContentSize(22, 22);
        pill.getChildByName('PlusLabel')?.setPosition(-16, 0, 0);
        pill.getChildByName('Divider')?.setPosition(16, 0, 0);
        const icon = pill.getChildByName('FilmIcon');
        if (icon) {
            icon.setPosition(50, 0, 0);
            icon.getComponent(UITransform)?.setContentSize(42, 34);
        }
        pill.setPosition(0, -barHeight / 2 - this.addPillHeight / 2 + 12, 0);
        pill.active = this.slots.length < this.maxSlots;
    }

    private onAddPillClick() {
        if (this.slots.length >= this.maxSlots) return;
        if (this.watchingAd || (this.canWatchAd && !this.canWatchAd())) return;
        this.watchingAd = true;
        this.showWatchedTip();
        this.scheduleOnce(() => {
            if (!this.isValid) return;
            if (this.slots.length < this.maxSlots) this.grantSlots(3);
            this.watchingAd = false;
        }, 0.6);
    }

    /** 先弹出「已查看广告」，稍后再加孔。挂在画布上，样式与「已保存」一致。 */
    private showWatchedTip() {
        const canvas = this.node.parent;
        if (!canvas?.isValid) return;
        const previous = canvas.getChildByName('WatchedAdTip');
        if (previous?.isValid) previous.destroy();
        const tip = new Node('WatchedAdTip');
        tip.layer = Layers.Enum.UI_2D;
        tip.parent = canvas;
        tip.setPosition(0, 360, 0);
        tip.setSiblingIndex(canvas.children.length - 1);
        const transform = tip.addComponent(UITransform);
        transform.setContentSize(640, 96);
        transform.hitTest = () => false;
        const graphics = tip.addComponent(Graphics);
        graphics.fillColor = new Color(255, 248, 235, 245);
        graphics.roundRect(-300, -44, 600, 88, 18);
        graphics.fill();
        graphics.strokeColor = new Color(196, 142, 64, 255);
        graphics.lineWidth = 3;
        graphics.roundRect(-300, -44, 600, 88, 18);
        graphics.stroke();
        const labelNode = new Node('Label');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = tip;
        labelNode.addComponent(UITransform).setContentSize(560, 72);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = '已查看广告';
        label.fontSize = 24;
        label.lineHeight = 32;
        label.isBold = true;
        label.color = new Color(92, 58, 32, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        this.scheduleOnce(() => {
            if (tip.isValid) tip.destroy();
        }, 1.6);
    }

    /** 虚线框紧跟在最后一个插槽后面，排满就换到下一行最左边。 */
    private ensureSlotDash() {
        let dash = this.node.getChildByName('SlotDash');
        if (!dash?.isValid) {
            dash = new Node('SlotDash');
            dash.layer = Layers.Enum.UI_2D;
            dash.parent = this.node;
            dash.addComponent(UITransform);
            dash.addComponent(Graphics);
        }
        const columns = 12;
        const step = this.slotSize;
        const count = this.slots.length;
        if (count === 0 || step <= 0 || count >= this.maxSlots) {
            dash.active = false;
            return;
        }
        dash.active = true;
        let lowest = this.slots[0].position.y;
        for (const slot of this.slots) {
            if (slot.isValid && slot.position.y < lowest) lowest = slot.position.y;
        }
        const column = count % columns;
        const span = Math.min(3, columns - column);
        const y = column === 0 ? lowest - step : lowest;
        const columnX = (col: number) => (col - (columns - 1) / 2) * step;
        const centerX = (columnX(column) + columnX(column + span - 1)) / 2;
        const width = (span - 1) * step + step * 0.92;
        const height = step * 0.92;
        const transform = dash.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(width, height);
            transform.hitTest = () => false;
        }
        dash.setPosition(centerX, y, 0);
        dash.setSiblingIndex(this.node.children.length - 1);
        const graphics = dash.getComponent(Graphics);
        if (graphics) this.paintDashedRoundRect(graphics, width, height, Math.min(14, height / 2));
        this.paintGhostWells(dash, span, column, columnX, centerX);
    }

    /** 虚线框里放即将解锁的浅色插槽，用单独的浅图，并且点不中。 */
    private paintGhostWells(
        dash: Node,
        span: number,
        column: number,
        columnX: (col: number) => number,
        centerX: number
    ) {
        const size = this.wellSize > 0 ? this.wellSize : Math.round(this.slotSize * 0.9);
        for (let index = 0; index < 3; index++) {
            const name = `GhostWell_${index}`;
            let well = dash.getChildByName(name);
            if (index >= span) {
                if (well) well.active = false;
                continue;
            }
            if (!well) {
                well = new Node(name);
                well.layer = Layers.Enum.UI_2D;
                well.parent = dash;
                const transform = well.addComponent(UITransform);
                transform.hitTest = () => false;
                const sprite = well.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.color = Color.WHITE;
            }
            well.active = true;
            well.getComponent(UITransform)?.setContentSize(size, size);
            const sprite = well.getComponent(Sprite);
            if (sprite && this.faintWellFrame) sprite.spriteFrame = this.faintWellFrame;
            well.setPosition(columnX(column + index) - centerX, 0, 0);
        }
    }

    private paintDashedRoundRect(graphics: Graphics, width: number, height: number, radius: number) {
        graphics.clear();
        graphics.lineWidth = 2.5;
        graphics.strokeColor = new Color(196, 132, 78, 230);
        const points = this.roundedRectLoop(width, height, radius);
        const dash = 7;
        const gap = 5;
        let drawing = true;
        let remain = dash;
        for (let index = 0; index < points.length; index++) {
            const from = points[index];
            const to = points[(index + 1) % points.length];
            const length = Math.hypot(to.x - from.x, to.y - from.y);
            if (length < 0.01) continue;
            let traveled = 0;
            let x = from.x;
            let y = from.y;
            while (traveled < length - 0.01) {
                const step = Math.min(remain, length - traveled);
                const nextX = x + ((to.x - from.x) / length) * step;
                const nextY = y + ((to.y - from.y) / length) * step;
                if (drawing) {
                    graphics.moveTo(x, y);
                    graphics.lineTo(nextX, nextY);
                    graphics.stroke();
                }
                x = nextX;
                y = nextY;
                traveled += step;
                remain -= step;
                if (remain <= 0.01) {
                    drawing = !drawing;
                    remain = drawing ? dash : gap;
                }
            }
        }
    }

    private roundedRectLoop(width: number, height: number, radius: number): { x: number; y: number }[] {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const curve = Math.min(radius, halfWidth, halfHeight);
        const points: { x: number; y: number }[] = [];
        const arc = (centerX: number, centerY: number, start: number, end: number) => {
            const steps = 4;
            for (let step = 0; step <= steps; step++) {
                const angle = start + (end - start) * (step / steps);
                points.push({
                    x: centerX + Math.cos(angle) * curve,
                    y: centerY + Math.sin(angle) * curve
                });
            }
        };
        arc(halfWidth - curve, halfHeight - curve, Math.PI / 2, 0);
        arc(halfWidth - curve, -halfHeight + curve, 0, -Math.PI / 2);
        arc(-halfWidth + curve, -halfHeight + curve, -Math.PI / 2, -Math.PI);
        arc(-halfWidth + curve, halfHeight - curve, Math.PI, Math.PI / 2);
        return points;
    }

    private paintAddPill(pill: Node) {
        const width = 180;
        const height = this.addPillHeight;
        const graphics = pill.getComponent(Graphics);
        if (!graphics) return;
        const radius = height / 2;
        const line = 3;
        graphics.clear();
        graphics.fillColor = new Color(118, 176, 160, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.fill();
        graphics.lineWidth = line;
        graphics.strokeColor = new Color(206, 168, 96, 255);
        graphics.roundRect(
            -width / 2 + line / 2,
            -height / 2 + line / 2,
            width - line,
            height - line,
            radius - line / 2
        );
        graphics.stroke();

        const well = new Node('FaintWell');
        well.layer = Layers.Enum.UI_2D;
        well.parent = pill;
        well.setPosition(-56, 0, 0);
        well.addComponent(UITransform).setContentSize(22, 22);
        const wellSprite = well.addComponent(Sprite);
        wellSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        wellSprite.color = Color.WHITE;
        if (this.faintWellFrame) wellSprite.spriteFrame = this.faintWellFrame;

        const labelNode = new Node('PlusLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = pill;
        labelNode.setPosition(-16, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(52, 32);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = '+3';
        label.fontSize = 22;
        label.lineHeight = 26;
        label.isBold = true;
        label.color = new Color(255, 252, 245, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const divider = new Node('Divider');
        divider.layer = Layers.Enum.UI_2D;
        divider.parent = pill;
        divider.setPosition(16, 0, 0);
        divider.addComponent(UITransform).setContentSize(2, 18);
        const dividerGraphics = divider.addComponent(Graphics);
        dividerGraphics.fillColor = new Color(255, 252, 245, 180);
        dividerGraphics.roundRect(-1, -9, 2, 18, 1);
        dividerGraphics.fill();

        const icon = new Node('FilmIcon');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = pill;
        icon.setPosition(50, 0, 0);
        icon.addComponent(UITransform).setContentSize(42, 34);
        const sprite = icon.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('ui/game/icon_film/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !icon.isValid) {
                if (error) console.error('[Tray] 加载 ui/game/icon_film/spriteFrame 失败', error);
                return;
            }
            sprite.spriteFrame = frame;
        });
        for (const child of pill.children) {
            const transform = child.getComponent(UITransform);
            if (transform) transform.hitTest = () => false;
        }
    }

    /**
     * 底板在托盘节点里的底边。还没铺开时返回 null。
     */
    public getShelfBottom(): number | null {
        const shelf = this.node.getChildByName('Shelf');
        const height = shelf?.getComponent(UITransform)?.contentSize.height ?? 0;
        if (!shelf?.isValid || height <= 0) return null;
        const pill = shelf.getChildByName('AddPill');
        const hang = pill?.active ? this.addPillHeight - 12 : 0;
        return shelf.position.y - height / 2 - hang;
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
            if (child.name === 'Shelf' || child.name === 'ShelfShadow' || child.name === 'SlotDash') continue;
            child.destroy();
        }

        this.slots = [];
        this.gems = Array(this.capacity).fill(null);
        this.selectedIndex = -1;
        this.liftedSlots = [];

        const count = Math.max(1, this.capacity);
        const columns = Math.min(12, count);
        const rows = Math.ceil(count / columns);
        this.slotSize = Math.min(46, Math.floor((this.barWidth - 40) / columns));
        this.wellSize = Math.round(this.slotSize * 0.9);
        this.gemSize = Math.round(this.wellSize * illustratedGemRatio());
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

            this.slots.push(slot);
            this.drawSlot(i);
        }
        this.resizeShelf();
    }

    private drawSlot(index: number) {
        const slot = this.slots[index];
        if (!slot?.isValid) return;
        let well = slot.getChildByName('Well');
        if (!well) {
            well = new Node('Well');
            well.layer = Layers.Enum.UI_2D;
            well.parent = slot;
            well.addComponent(UITransform);
            const sprite = well.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = Color.WHITE;
            const transform = well.getComponent(UITransform);
            if (transform) transform.hitTest = () => false;
        }
        well.setSiblingIndex(0);
        well.getComponent(UITransform)?.setContentSize(this.wellSize, this.wellSize);
        const sprite = well.getComponent(Sprite);
        if (sprite && this.wellFrame) sprite.spriteFrame = this.wellFrame;
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
        const loaded = this.tileFrames[color];
        if (loaded) return loaded;
        switch (color) {
            case 'yellow': return this.yellowGem;
            case 'blue': return this.blueGem;
            case 'red': return this.redGem ?? null;
            case 'black': return this.blackGem;
            case 'white': return this.whiteGem;
            case 'pink': return this.pinkGem ?? null;
            case 'green':
            case 'darkRed':
            case 'orange':
            case 'brown':
            case 'olive':
            case 'teal':
            case 'navy':
            case 'purple':
            case 'gray':
                return null;
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
