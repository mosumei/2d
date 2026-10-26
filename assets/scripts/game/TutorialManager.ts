import {
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    UITransform
} from 'cc';

import { localize } from '../core/Locale';
import { BoardManager } from './BoardManager';
import { GemCell } from './GemCell';
import { TrayManager } from './TrayManager';
import { createTutorialHand, TutorialHand } from '../ui/TutorialHand';

export type TutorialAction =
    | 'select'
    | 'place'
    | 'tray'
    | 'lift'
    | 'placeFromTray';

export interface TutorialStep {
    id: string;
    messageZh: string;
    messageEn: string;
    action: TutorialAction;
    cell?: [number, number];
    slot?: number;
    blocking?: boolean;
}

interface TutorialSelection {
    type: 'board' | 'tray';
    row: number;
    col: number;
    slot: number;
}

/**
 * 按步骤显示顶部双语提示和手指。blocking 为 false 时不限制操作。
 */
export class TutorialManager {

    private steps: TutorialStep[] = [];
    private index = 0;
    private banner: Node | null = null;
    private message: Label | null = null;
    private hand: TutorialHand | null = null;
    private root: Node | null = null;

    /**
     * 开始一轮教学。
     * @param steps 关卡里的步骤
     * @param canvas 提示和手指的父节点
     * @param board 棋盘，用来定位手指
     * @param tray 托盘，用来定位手指
     */
    public start(
        steps: TutorialStep[],
        canvas: Node,
        board: BoardManager,
        tray: TrayManager
    ) {
        this.steps = steps;
        this.index = 0;
        this.ensureOverlay(canvas);
        this.refresh(board, tray);
    }

    /**
     * 教学进行中。
     */
    public isRunning(): boolean {
        return this.steps.length > 0 && this.root?.isValid === true;
    }

    /**
     * 步骤已经走完。
     */
    public isComplete(): boolean {
        return this.steps.length > 0 && this.index >= this.steps.length;
    }

    /**
     * 当前步骤会拦住不符合提示的点击。
     */
    public blocksInput(): boolean {
        const step = this.current();
        return !!step && step.blocking !== false;
    }

    /**
     * 当前步是否允许点这格。
     * @param cell 被点的格子
     */
    public allowBoard(cell: GemCell): boolean {
        const step = this.current();
        if (!step || step.blocking === false) return true;
        switch (step.action) {
            case 'select':
            case 'place':
            case 'placeFromTray':
                return this.sameCell(cell, step.cell);
            case 'tray':
            case 'lift':
                return false;
            default: {
                const unknown: never = step.action;
                void unknown;
                return false;
            }
        }
    }

    /**
     * 当前步是否允许点这个托盘槽。
     * @param index 槽编号
     */
    public allowTray(index: number): boolean {
        const step = this.current();
        if (!step || step.blocking === false) return true;
        switch (step.action) {
            case 'tray':
            case 'lift':
                return index === step.slot;
            case 'select':
            case 'place':
            case 'placeFromTray':
                return false;
            default: {
                const unknown: never = step.action;
                void unknown;
                return false;
            }
        }
    }

    /**
     * 这一步已经做成时进入下一步。
     * @param board 棋盘
     * @param tray 托盘
     * @param selected 当前选中
     */
    public advanceIfDone(
        board: BoardManager | null,
        tray: TrayManager | null,
        selected: TutorialSelection | null
    ) {
        const step = this.current();
        if (!step || !this.isSatisfied(step, board, tray, selected)) return;
        this.index += 1;
        this.refresh(board, tray);
    }

    /**
     * 教学结束时的祝贺语。
     */
    public showDone() {
        this.hand?.hide();
        if (this.message) {
            this.message.string = localize('太好了！', 'Nice!');
        }
    }

    /**
     * 关掉提示。
     */
    public stop() {
        this.steps = [];
        this.index = 0;
        const handNode = this.hand?.node;
        this.hand?.hide();
        if (handNode?.isValid) handNode.destroy();
        if (this.root?.isValid) this.root.destroy();
        this.root = null;
        this.banner = null;
        this.message = null;
        this.hand = null;
    }

    private current(): TutorialStep | null {
        return this.steps[this.index] ?? null;
    }

    private isSatisfied(
        step: TutorialStep,
        board: BoardManager | null,
        tray: TrayManager | null,
        selected: TutorialSelection | null
    ): boolean {
        if (step.blocking === false) {
            const cell = this.cellAt(board, step.cell);
            return !!cell && cell.isCorrect();
        }
        switch (step.action) {
            case 'select':
                return !!selected &&
                    selected.type === 'board' &&
                    this.samePoint(selected.row, selected.col, step.cell);
            case 'lift':
                return !!selected &&
                    selected.type === 'tray' &&
                    selected.slot === step.slot;
            case 'tray':
                return step.slot !== undefined &&
                    !!tray &&
                    tray.getGemAt(step.slot) !== null;
            case 'place':
            case 'placeFromTray': {
                const cell = this.cellAt(board, step.cell);
                return !!cell && cell.isCorrect();
            }
            default: {
                const unknown: never = step.action;
                void unknown;
                return false;
            }
        }
    }

    private refresh(board: BoardManager | null, tray: TrayManager | null) {
        const step = this.current();
        if (!step) {
            this.hand?.hide();
            return;
        }
        if (this.message) {
            this.message.string = localize(step.messageZh, step.messageEn);
        }
        this.root?.setSiblingIndex((this.root.parent?.children.length ?? 1) - 1);
        const target = this.pointOf(step, board, tray);
        if (!target || !this.hand) return;
        this.hand.pointAt(target.x, target.y);
    }

    private pointOf(
        step: TutorialStep,
        board: BoardManager | null,
        tray: TrayManager | null
    ): { x: number; y: number } | null {
        switch (step.action) {
            case 'select':
            case 'place':
            case 'placeFromTray': {
                const cell = this.cellAt(board, step.cell);
                if (!cell) return null;
                const position = cell.node.worldPosition;
                return { x: position.x, y: position.y };
            }
            case 'tray':
            case 'lift': {
                if (step.slot === undefined || !tray) return null;
                const slot = tray.getSlotNode(step.slot);
                if (!slot) return null;
                const position = slot.worldPosition;
                return { x: position.x, y: position.y };
            }
            default: {
                const unknown: never = step.action;
                void unknown;
                return null;
            }
        }
    }

    private ensureOverlay(canvas: Node) {
        if (this.root?.isValid) return;
        const root = new Node('TutorialOverlay');
        root.layer = Layers.Enum.UI_2D;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(640, 96);
        root.setPosition(0, 430, 0);

        const banner = new Node('Banner');
        banner.layer = Layers.Enum.UI_2D;
        banner.parent = root;
        banner.addComponent(UITransform).setContentSize(560, 84);
        const graphics = banner.addComponent(Graphics);
        graphics.fillColor = new Color(255, 248, 235, 235);
        graphics.roundRect(-280, -42, 560, 84, 22);
        graphics.fill();
        graphics.strokeColor = new Color(196, 142, 64, 255);
        graphics.lineWidth = 4;
        graphics.roundRect(-280, -42, 560, 84, 22);
        graphics.stroke();

        const labelNode = new Node('Message');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = banner;
        labelNode.addComponent(UITransform).setContentSize(520, 64);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.fontSize = 28;
        label.lineHeight = 34;
        label.isBold = true;
        label.color = new Color(92, 58, 32, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;

        this.root = root;
        this.banner = banner;
        this.message = label;
        this.hand = createTutorialHand(canvas);
    }

    private cellAt(
        board: BoardManager | null,
        cell: [number, number] | undefined
    ): GemCell | null {
        if (!board || !cell) return null;
        return board.getCell(cell[0], cell[1]) ?? null;
    }

    private sameCell(cell: GemCell, point: [number, number] | undefined): boolean {
        return this.samePoint(cell.row, cell.col, point);
    }

    private samePoint(
        row: number,
        col: number,
        point: [number, number] | undefined
    ): boolean {
        return !!point && point[0] === row && point[1] === col;
    }
}

/**
 * 从关卡 JSON 读出教学步骤。格式不对时返回空数组。
 * @param value 原始字段
 */
export function readTutorialSteps(value: unknown): TutorialStep[] {
    if (!Array.isArray(value)) return [];
    const steps: TutorialStep[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const raw = item as Record<string, unknown>;
        const action = raw.action;
        if (
            action !== 'select' &&
            action !== 'place' &&
            action !== 'tray' &&
            action !== 'lift' &&
            action !== 'placeFromTray'
        ) {
            continue;
        }
        if (typeof raw.messageZh !== 'string' || typeof raw.messageEn !== 'string') {
            continue;
        }
        const step: TutorialStep = {
            id: typeof raw.id === 'string' ? raw.id : action,
            messageZh: raw.messageZh,
            messageEn: raw.messageEn,
            action
        };
        if (Array.isArray(raw.cell) && raw.cell.length === 2) {
            const row = raw.cell[0];
            const col = raw.cell[1];
            if (typeof row === 'number' && typeof col === 'number') {
                step.cell = [row, col];
            }
        }
        if (typeof raw.slot === 'number') step.slot = raw.slot;
        if (raw.blocking === false) step.blocking = false;
        steps.push(step);
    }
    return steps;
}
