import {
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3
} from 'cc';

import { BoardManager } from './BoardManager';
import { GemCell } from './GemCell';

const WAVE_SPAN = 0.75;
const SUPERB_SPAN = 1.50;

/**
 * 拼图完成后的闪耀。只在棋子上加临时高光，不改棋盘颜色。
 */
export class GemCompletionShine {

    private readonly nodes: Node[] = [];

    /**
     * 播放区域亮闪、波浪扫光、收尾闪亮和 Superb!。
     * @param board 已经完成的棋盘
     * @param canvas 庆祝文字的父节点
     * @param cancelled 关卡被切走时返回 true
     */
    public async play(
        board: BoardManager,
        canvas: Node | null,
        cancelled: () => boolean
    ): Promise<void> {
        const cells = board.getCells().filter(cell => cell.isValid && cell.currentColor !== null);
        try {
            if (cells.length === 0 || cancelled()) return;
            await this.wait(0.16, cancelled);
            if (cancelled()) return;
            await this.playWaveShine(cells, cancelled);
            if (cancelled()) return;
            await this.wait(0.24, cancelled);
            if (cancelled()) return;
            await this.playSuperb(canvas, board, cancelled);
        } finally {
            this.clearNodes();
        }
    }

    /** A connected target-color region shines as soon as its last bead lands. */
    public async playRegion(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        try {
            await Promise.all(cells.map(cell => this.flash(cell, 240, 0.38, cancelled)));
        } finally {
            this.clearNodes();
        }
    }

    private async playWaveShine(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        const orders = cells.map(cell => cell.row * 1.2 + cell.col);
        const min = Math.min(...orders);
        const span = Math.max(0.01, Math.max(...orders) - min);
        const jobs = cells.map((cell, index) => {
            const delay = ((orders[index] - min) / span) * WAVE_SPAN;
            return this.wait(delay, cancelled).then(() => {
                if (cancelled()) return;
                return this.flash(cell, 245, 0.22, cancelled);
            });
        });
        await Promise.all(jobs);
    }

    private async playSuperb(
        canvas: Node | null,
        board: BoardManager,
        cancelled: () => boolean
    ): Promise<void> {
        if (!canvas?.isValid || cancelled()) {
            await this.wait(SUPERB_SPAN, cancelled);
            return;
        }

        const root = new Node('SuperbCelebration');
        root.layer = Layers.Enum.UI_2D;
        root.parent = canvas;
        root.setSiblingIndex(canvas.children.length - 1);
        this.nodes.push(root);

        const boardNode = board.node;
        const boardHeight = boardNode.getComponent(UITransform)?.contentSize.height ?? 480;
        root.setPosition(boardNode.position.x, boardNode.position.y - boardHeight * 0.5 - 56, 0);

        const dim = new Node('Dim');
        dim.layer = Layers.Enum.UI_2D;
        dim.parent = canvas;
        dim.setSiblingIndex(root.getSiblingIndex());
        dim.addComponent(UITransform).setContentSize(900, 1600);
        const dimOpacity = dim.addComponent(UIOpacity);
        dimOpacity.opacity = 0;
        const dimGraphics = dim.addComponent(Graphics);
        dimGraphics.fillColor = new Color(28, 24, 40, 255);
        dimGraphics.rect(-450, -800, 900, 1600);
        dimGraphics.fill();
        this.nodes.push(dim);
        tween(dimOpacity).to(0.2, { opacity: 110 }).start();

        const labelNode = new Node('SuperbLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = root;
        labelNode.addComponent(UITransform).setContentSize(420, 90);
        labelNode.setScale(0.4, 0.4, 1);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = 'Superb!';
        label.fontSize = 64;
        label.lineHeight = 72;
        label.isBold = true;
        label.color = new Color(255, 236, 214, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(214, 106, 28, 255);
        label.outlineWidth = 4;

        tween(labelNode)
            .to(0.22, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'backOut' })
            .to(0.12, { scale: new Vec3(1, 1, 1) })
            .start();

        this.spawnConfetti(canvas);
        await this.wait(SUPERB_SPAN, cancelled);
        Tween.stopAllByTarget(dimOpacity);
        Tween.stopAllByTarget(labelNode);
    }

    private spawnConfetti(canvas: Node) {
        const colors = [
            new Color(255, 214, 64, 255),
            new Color(255, 112, 146, 255),
            new Color(86, 196, 255, 255),
            new Color(112, 220, 120, 255),
            new Color(255, 255, 255, 255)
        ];
        for (let index = 0; index < 60; index++) {
            const piece = new Node('Confetti');
            piece.layer = Layers.Enum.UI_2D;
            piece.parent = canvas;
            piece.setSiblingIndex(canvas.children.length - 1);
            this.nodes.push(piece);
            const size = 8 + Math.random() * 8;
            piece.addComponent(UITransform).setContentSize(size, size * 0.55);
            const graphics = piece.addComponent(Graphics);
            const color = colors[index % colors.length];
            graphics.fillColor = color;
            graphics.roundRect(-size / 2, -size * 0.28, size, size * 0.55, 2);
            graphics.fill();
            const opacity = piece.addComponent(UIOpacity);
            const x = (index % 2 === 0 ? -1 : 1) * (250 + Math.random() * 90);
            const y = -500 + Math.random() * 60;
            piece.setPosition(x, y, 0);
            piece.setRotationFromEuler(0, 0, Math.random() * 180);
            const apex = new Vec3((Math.random() - 0.5) * 560, -40 + Math.random() * 380, 0);
            tween(piece)
                .delay((index % 5) * 0.025)
                .to(0.35, { position: apex }, { easing: 'quadOut' })
                .to(0.95, { position: new Vec3(apex.x + (Math.random() - 0.5) * 100, -620, 0),
                    eulerAngles: new Vec3(0, 0, 270 + Math.random() * 360) }, { easing: 'quadIn' })
                .start();
            tween(opacity).delay(1.1).to(0.3, { opacity: 0 }).start();
        }
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
