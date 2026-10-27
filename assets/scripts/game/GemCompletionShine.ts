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

const REGIONAL_SPAN = 1.05;
const WAVE_SPAN = 0.75;
const FINAL_SPAN = 0.26;
const SUPERB_SPAN = 1.05;

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
            await this.playRegionalSparkles(cells, cancelled);
            if (cancelled()) return;
            await this.playWaveShine(cells, cancelled);
            if (cancelled()) return;
            await this.playFinalFlash(cells, cancelled);
            if (cancelled()) return;
            await this.playSuperb(canvas, board, cancelled);
        } finally {
            this.clearNodes();
        }
    }

    private async playRegionalSparkles(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        const groups = this.groupNeighbors(cells);
        const gap = Math.min(0.16, REGIONAL_SPAN / Math.max(1, groups.length));
        const jobs = groups.map((group, index) =>
            this.wait(index * gap, cancelled).then(() => {
                if (cancelled()) return;
                return Promise.all(group.map(cell => this.flash(cell, 220, 0.22, cancelled)));
            })
        );
        await Promise.all(jobs);
    }

    private async playWaveShine(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        const orders = cells.map(cell => cell.row * 1.2 + cell.col + Math.random() * 0.85);
        const min = Math.min(...orders);
        const span = Math.max(0.01, Math.max(...orders) - min);
        const jobs = cells.map((cell, index) => {
            const delay = ((orders[index] - min) / span) * WAVE_SPAN;
            return this.wait(delay, cancelled).then(() => {
                if (cancelled()) return;
                return this.flash(cell, 200, 0.2, cancelled);
            });
        });
        await Promise.all(jobs);
    }

    private async playFinalFlash(cells: GemCell[], cancelled: () => boolean): Promise<void> {
        if (cancelled()) return;
        await Promise.all(cells.map(cell => this.flash(cell, 255, FINAL_SPAN, cancelled)));
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
        for (let index = 0; index < 28; index++) {
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
            const x = (Math.random() - 0.5) * 520;
            const y = 180 + Math.random() * 280;
            piece.setPosition(x, y, 0);
            piece.setRotationFromEuler(0, 0, Math.random() * 180);
            tween(piece)
                .to(0.9 + Math.random() * 0.35, {
                    position: new Vec3(x + (Math.random() - 0.5) * 80, y - 520 - Math.random() * 160, 0)
                }, { easing: 'sineIn' })
                .start();
            tween(opacity)
                .delay(0.55)
                .to(0.45, { opacity: 0 })
                .start();
        }
    }

    private flash(
        cell: GemCell,
        peak: number,
        duration: number,
        cancelled: () => boolean
    ): Promise<void> {
        if (cancelled() || !cell.isValid) return Promise.resolve();
        const size = Math.max(12, cell.getDisplaySize() * 0.72);
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
        return new Promise((resolve) => {
            tween(opacity)
                .to(duration * 0.38, { opacity: peak }, { easing: 'quadOut' })
                .to(duration * 0.62, { opacity: 0 }, { easing: 'sineIn' })
                .call(() => resolve())
                .start();
        });
    }

    private drawSpark(graphics: Graphics, radius: number) {
        graphics.fillColor = new Color(255, 236, 190, 255);
        graphics.circle(0, 0, radius * 0.62);
        graphics.fill();
        graphics.fillColor = new Color(255, 255, 255, 255);
        graphics.moveTo(0, radius);
        for (let point = 1; point <= 8; point++) {
            const distance = point % 2 === 0 ? radius : radius * 0.34;
            const angle = Math.PI / 2 + point * Math.PI / 4;
            graphics.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
        }
        graphics.close();
        graphics.fill();
    }

    private groupNeighbors(cells: GemCell[]): GemCell[][] {
        const unused = [...cells];
        const groups: GemCell[][] = [];
        while (unused.length > 0) {
            const seedIndex = Math.floor(Math.random() * unused.length);
            const seed = unused.splice(seedIndex, 1)[0];
            if (!seed) break;
            const group = [seed];
            for (let index = unused.length - 1; index >= 0 && group.length < 4; index--) {
                const other = unused[index];
                const distance = Math.abs(other.row - seed.row) + Math.abs(other.col - seed.col);
                if (distance > 2) continue;
                group.push(other);
                unused.splice(index, 1);
            }
            groups.push(group);
        }
        return groups;
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
