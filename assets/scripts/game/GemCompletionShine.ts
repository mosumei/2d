import {
    Color,
    Graphics,
    Layers,
    Node,
    Rect,
    resources,
    Sprite,
    SpriteFrame,
    Texture2D,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3
} from 'cc';

import { BoardManager } from './BoardManager';
import { GemCell } from './GemCell';

const WAVE_SPAN = 1.8;
const GLINT_FRAMES = 16;
const GLINT_BEAD_SCALE = 1.4;

/**
 * 拼图完成后的闪耀。只在棋子上加临时高光，不改棋盘颜色。
 */
export class GemCompletionShine {

    private readonly nodes: Node[] = [];
    private readonly glintFrames: SpriteFrame[] = [];

    /**
     * 播放波浪扫光。扫完即结束，不再盖遮罩和 Superb!。
     * @param board 已经完成的棋盘
     * @param _canvas 保留给调用方，庆祝层已去掉
     * @param cancelled 关卡被切走时返回 true
     */
    public async play(
        board: BoardManager,
        _canvas: Node | null,
        cancelled: () => boolean
    ): Promise<void> {
        const cells = board.getCells().filter(cell => cell.isValid && cell.currentColor !== null);
        const framesReady = this.loadGlintFrames();
        try {
            if (cells.length === 0 || cancelled()) return;
            await this.wait(0.12, cancelled);
            await framesReady;
            if (cancelled()) return;
            await this.playWaveShine(cells, cancelled);
        } finally {
            this.clearNodes();
            for (const frame of this.glintFrames) frame.destroy();
            this.glintFrames.length = 0;
        }
    }

    /**
     * 通关撒花。彩纸从左右两侧洒到当前成品上，不盖遮罩。
     * @param canvas 游戏画布
     * @param cancelled 关卡被切走时返回 true
     */
    public async playConfetti(canvas: Node | null, cancelled: () => boolean): Promise<void> {
        if (!canvas?.isValid || cancelled()) return;
        const layer = new Node('Confetti');
        layer.layer = Layers.Enum.UI_2D;
        layer.parent = canvas;
        layer.setSiblingIndex(canvas.children.length - 1);
        layer.addComponent(UITransform).setContentSize(720, 1280);
        const layerHit = layer.getComponent(UITransform);
        if (layerHit) layerHit.hitTest = () => false;

        const colors = [
            new Color(255, 126, 176, 255),
            new Color(86, 214, 206, 255),
            new Color(176, 132, 255, 255),
            new Color(126, 214, 146, 255),
            new Color(255, 206, 92, 255),
            new Color(255, 255, 255, 255)
        ];
        for (let index = 0; index < 48; index++) {
            const piece = new Node('Piece');
            piece.layer = Layers.Enum.UI_2D;
            piece.parent = layer;
            const width = 8 + Math.random() * 8;
            const height = 12 + Math.random() * 10;
            piece.addComponent(UITransform).setContentSize(width, height);
            const graphics = piece.addComponent(Graphics);
            graphics.fillColor = colors[index % colors.length];
            graphics.roundRect(-width / 2, -height / 2, width, height, 2);
            graphics.fill();
            const fromLeft = index % 2 === 0;
            const startX = fromLeft ? -460 - Math.random() * 40 : 460 + Math.random() * 40;
            const startY = -120 + Math.random() * 760;
            const endX = (Math.random() - 0.5) * 460;
            const endY = startY - (140 + Math.random() * 260);
            piece.setPosition(startX, startY, 0);
            piece.angle = Math.random() * 360;
            const opacity = piece.addComponent(UIOpacity);
            opacity.opacity = 255;
            const spin = piece.angle + (Math.random() - 0.5) * 540;
            const delay = Math.random() * 0.28;
            tween(piece)
                .delay(delay)
                .to(1.05, {
                    position: new Vec3(endX, endY, 0),
                    angle: spin
                }, { easing: 'sineOut' })
                .start();
            tween(opacity)
                .delay(delay + 0.72)
                .to(0.4, { opacity: 0 })
                .start();
        }

        this.showMagnificent(layer);

        try {
            await this.wait(1.15, cancelled);
        } finally {
            if (cancelled() && layer.isValid) layer.destroy();
        }
    }

    /** 撒花之后，在拼图正中把 Magnificent 贴纸由小弹大。 */
    private showMagnificent(layer: Node): void {
        const node = new Node('Magnificent');
        node.layer = Layers.Enum.UI_2D;
        node.parent = layer;
        node.setSiblingIndex(layer.children.length - 1);
        node.setPosition(0, 90, 0);
        node.setScale(0.2, 0.2, 1);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(480, 131);
        transform.hitTest = () => false;
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        sprite.color = Color.WHITE;
        resources.load('ui/game/magnificent/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !node.isValid) {
                if (error) console.warn('[GemCompletionShine] Magnificent 贴纸加载失败', error);
                return;
            }
            sprite.spriteFrame = frame;
            const source = frame.originalSize;
            const width = source.width > 0 ? source.width : 1017;
            const height = source.height > 0 ? source.height : 278;
            const scale = Math.min(480 / width, 150 / height);
            transform.setContentSize(width * scale, height * scale);
        });
        tween(node)
            .delay(0.18)
            .to(0.36, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    /** A connected target-color region shines as soon as its last bead lands. */
    public async playRegion(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        try {
            await Promise.all(cells.map(cell => this.flash(cell, 240, 0.8, cancelled)));
        } finally {
            this.clearNodes();
        }
    }

    /** 每颗珠子表面闪一下白星，从左上斜着扫到右下。 */
    private async playWaveShine(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        if (this.glintFrames.length === 0 || cancelled()) return;
        const orders = cells.map(cell => cell.row + cell.col);
        const min = Math.min(...orders);
        const span = Math.max(0.01, Math.max(...orders) - min);
        await Promise.all(cells.map((cell, index) => {
            const delay = ((orders[index] - min) / span) * WAVE_SPAN;
            return this.wait(delay, cancelled).then(() => this.glint(cell, cancelled));
        }));
    }

    private async glint(cell: GemCell, cancelled: () => boolean): Promise<void> {
        const frames = this.glintFrames;
        if (frames.length === 0 || cancelled() || !cell.isValid) return;
        const gemNode = cell.gemSprite?.node;
        const host = gemNode?.isValid ? gemNode : cell.node;
        const gemSize = gemNode?.getComponent(UITransform)?.contentSize.width
            ?? cell.getDisplaySize() * 0.85;
        const node = new Node('WaveGlint');
        node.layer = host.layer;
        node.parent = host;
        node.setSiblingIndex(host.children.length - 1);
        this.nodes.push(node);
        const size = Math.max(8, gemSize * GLINT_BEAD_SCALE);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size, size);
        transform.hitTest = () => false;
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        sprite.color = Color.WHITE;
        sprite.spriteFrame = frames[0];
        const frameTime = 0.9 / frames.length;
        for (const frame of frames) {
            if (cancelled() || !sprite.isValid) return;
            sprite.spriteFrame = frame;
            await this.wait(frameTime, cancelled);
        }
        if (node.isValid) node.destroy();
    }

    private loadGlintFrames(): Promise<void> {
        if (this.glintFrames.length > 0) return Promise.resolve();
        return new Promise(resolve => {
            resources.load('effects/wave-glint/texture', Texture2D, (error, texture) => {
                if (error || !texture) {
                    if (error) console.warn('[GemCompletionShine] 波浪星光素材加载失败', error);
                    resolve();
                    return;
                }
                for (let index = 0; index < GLINT_FRAMES; index++) {
                    const frame = new SpriteFrame();
                    frame.texture = texture;
                    frame.rect = new Rect((index % 8) * 64, Math.floor(index / 8) * 64, 64, 64);
                    this.glintFrames.push(frame);
                }
                resolve();
            });
        });
    }

    private flash(
        cell: GemCell,
        peak: number,
        duration: number,
        cancelled: () => boolean
    ): Promise<void> {
        if (cancelled() || !cell.isValid) return Promise.resolve();
        const size = cell.getDisplaySize() * 0.72;
        const node = new Node('CompletionFlash');
        node.layer = Layers.Enum.UI_2D;
        node.parent = cell.node;
        node.setSiblingIndex(cell.node.children.length - 1);
        this.nodes.push(node);
        node.addComponent(UITransform).setContentSize(size, size);
        const graphics = node.addComponent(Graphics);
        this.drawSpark(graphics, size * 0.46);
        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity)
            .to(duration * 0.30, { opacity: peak }, { easing: 'quadOut' })
            .to(duration * 0.70, { opacity: 0 }, { easing: 'sineIn' })
            .start();
        // Resolve even if a scene change destroys the tween target.
        return this.wait(duration, cancelled);
    }

    private drawSpark(graphics: Graphics, radius: number) {
        graphics.fillColor = new Color(255, 255, 255, 95);
        graphics.circle(0, 0, radius * 0.88); graphics.fill();
        graphics.fillColor = new Color(255, 255, 255, 255);
        graphics.moveTo(-radius * 0.22, radius);
        graphics.lineTo(radius * 0.04, radius * 0.22);
        graphics.lineTo(radius * 0.82, 0);
        graphics.lineTo(radius * 0.04, -radius * 0.18);
        graphics.lineTo(-radius * 0.22, -radius * 0.88);
        graphics.lineTo(-radius * 0.40, -radius * 0.18);
        graphics.lineTo(-radius, 0);
        graphics.lineTo(-radius * 0.40, radius * 0.22);
        graphics.close(); graphics.fill();
    }

    private wait(seconds: number, cancelled: () => boolean): Promise<void> {
        if (seconds <= 0 || cancelled()) return Promise.resolve();
        return new Promise((resolve) => {
            setTimeout(() => resolve(), seconds * 1000);
        });
    }

    private clearNodes() {
        for (const node of this.nodes) {
            if (!node.isValid) continue;
            Tween.stopAllByTarget(node);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
            node.destroy();
        }
        this.nodes.length = 0;
    }
}
