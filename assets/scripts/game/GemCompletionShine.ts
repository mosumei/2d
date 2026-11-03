import {
    Color,
    Graphics,
    Layers,
    Node,
    tween,
    Tween,
    UIOpacity,
    UITransform
} from 'cc';

import { BoardManager } from './BoardManager';
import { GemCell } from './GemCell';

const WAVE_SPAN = 0.75;

/**
 * 拼图完成后的闪耀。只在棋子上加临时高光，不改棋盘颜色。
 */
export class GemCompletionShine {

    private readonly nodes: Node[] = [];

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
        try {
            if (cells.length === 0 || cancelled()) return;
            await this.wait(0.16, cancelled);
            if (cancelled()) return;
            await this.playWaveShine(cells, cancelled);
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
