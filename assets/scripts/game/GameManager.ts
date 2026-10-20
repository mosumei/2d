
import {
    _decorator, Component, Label, Sprite,
    director
} from 'cc';

import { BoardManager } from './BoardManager';
import { TrayManager } from './TrayManager';
import { GemCell, GemColor } from './GemCell';
import { GemMoveAnimator, GemMove } from './GemMoveAnimator';
import { CompletePanelUI } from '../ui/CompletePanelUI';
import { LevelManager, LevelData } from '../core/LevelManager';
import { AudioManager } from '../core/AudioManager'
import { LevelSession } from '../core/LevelSession';

const { ccclass, property } = _decorator;


type Selection =
    | { type: 'board'; cell: GemCell }
    | { type: 'tray'; index: number }
    | null;


@ccclass('GameManager')
export class GameManager extends Component {

    @property(BoardManager)
    boardManager: BoardManager | null = null;

    @property(TrayManager)
    trayManager: TrayManager | null = null;

    @property(Label)
    levelLabel: Label | null = null;

    // ===== 新增：宝石移动动画组件 =====
    @property(GemMoveAnimator)
    moveAnimator: GemMoveAnimator | null = null;

    // ===== 游戏内部状态 =====
    private selected: Selection = null;

    private finished = false;

    // 新增：动画执行期间禁止点击
    private isAnimating = false;

    private moveCount = 0;

    public getMoveCount(): number {
        return this.moveCount;
    }

    private countMove() {
        this.moveCount++;

        console.log(
            `[GameManager] Moves: ${this.moveCount}`
        );
    }

    private playPlacementSound(
        sourceMatched: boolean,
        targetMatched: boolean
    ) {
        if (sourceMatched || targetMatched) {
            this.audioManager?.playMatch();
        } else {
            this.audioManager?.playMove();
        }
    }
    @property(CompletePanelUI)
    completePanel: CompletePanelUI | null = null;
    @property(LevelManager)
    levelManager: LevelManager | null = null;

    // 0 = 读取存档；大于 0 = 强制从该关开始，且不写入存档
    @property
    debugStartLevel = 0;

    private currentLevelData: LevelData | null = null;
    @property(AudioManager)
audioManager: AudioManager | null = null;


onLoad() {
    if (!this.levelManager) {
        this.levelManager = this.getComponent(LevelManager)
            ?? this.addComponent(LevelManager);
    }

    if (this.boardManager) {
        this.boardManager.onCellClicked =
            cell => this.onBoardClick(cell);
    } else {
        console.error('[GameManager] 请绑定 BoardManager');
    }

    if (this.trayManager) {
        this.trayManager.onSlotClicked =
            index => this.onTrayClick(index);
    } else {
        console.error('[GameManager] 请绑定 TrayManager');
    }

    if (this.completePanel) {
        this.completePanel.hide();

        this.completePanel.onNext = () => {
            this.nextLevel();
        };

        this.completePanel.onRestart = () => {
            this.restartLevel();
        };

        this.completePanel.onHome = () => {
            director.loadScene('MainMenu');
        };
    }
}


    start() {
        const preview = this.node.parent
            ?.getChildByName('TargetPreview');
        if (preview) preview.active = false;

        if (this.boardManager) {
            this.boardManager.node.active = true;
        }
        if (this.trayManager) {
            this.trayManager.node.active = true;
        }
        if (this.levelLabel) {
            this.levelLabel.node.active = true;
        }

        const level = this.debugStartLevel > 0
            ? this.debugStartLevel
            : LevelSession.consumeStartLevel();

        console.log(`[DEBUG] 启动关卡：LEVEL ${level}`);
        this.openLevel(level);
    }

    // ===== 统一处理选中状态 =====

    private clearSelection() {
        if (this.selected?.type === 'board') {
            this.selected.cell.setSelected(false);
        }

        this.trayManager?.setSelectedIndex(-1);
        this.selected = null;
    }

    private selectBoard(cell: GemCell) {
        this.clearSelection();

        if (!cell.canMove()) return;

        this.selected = { type: 'board', cell };
        cell.setSelected(true);
        this.audioManager?.playSelect();
    }

    private selectTray(index: number) {
        this.clearSelection();

        if (!this.trayManager?.getGemAt(index)) return;

        this.selected = { type: 'tray', index };
        this.trayManager.setSelectedIndex(index);
        this.audioManager?.playSelect();
    }

    // ===== 点击棋盘格子 =====

    private onBoardClick(cell: GemCell) {
        if (this.isAnimating) return;
        if (this.finished) return;

        const selection = this.selected;

        // 没有选中任何宝石
        if (!selection) {
            this.selectBoard(cell);
            return;
        }

        // 点击同一格，取消选中
        if (
            selection.type === 'board' &&
            selection.cell === cell
        ) {
            this.clearSelection();
            return;
        }

        // 不能把宝石放到已归位格子上
        if (cell.isCorrect()) {
            console.log('此宝石已经正确归位');
            return;
        }

        // 棋盘宝石 → 棋盘格子
        if (selection.type === 'board') {
            this.moveOnBoard(selection.cell, cell);
        } else {
            // 托盘宝石 → 棋盘格子
            this.moveFromTray(selection.index, cell);
        }
    }

    // 棋盘内部移动或交换

    private moveOnBoard(
        source: GemCell,
        target: GemCell
    ) {
        if (
            !source.canMove() ||
            target.isCorrect() ||
            this.isAnimating
        ) {
            return;
        }

        const colorA = source.currentColor;
        const colorB = target.currentColor;

        if (!colorA) return;

        // 还没配置动画组件时，保留原来的交换功能
        if (!this.moveAnimator) {
            source.setCurrentColor(colorB);
            target.setCurrentColor(colorA);
            this.playPlacementSound(
                source.isCorrect(),
                target.isCorrect()
            );
            this.clearSelection();
            this.countMove();
            this.checkCompleted();
            return;
        }

        const frameA = source.gemSprite?.spriteFrame;
        const frameB = target.gemSprite?.spriteFrame;

        if (!frameA || (colorB && !frameB)) {
            console.error('宝石 SpriteFrame 未正确设置');
            return;
        }

        // 锁定交互
        this.isAnimating = true;
        this.clearSelection();

        const moves: GemMove[] = [
            {
                frame: frameA,
                from: source.node,
                to: target.node
            }
        ];

        if (colorB && frameB) {
            moves.push({
                frame: frameB,
                from: target.node,
                to: source.node
            });
        }

        // 暂时隐藏原来的宝石，避免同时出现两份
        if (source.gemSprite) {
            source.gemSprite.node.active = false;
        }

        if (colorB && target.gemSprite) {
            target.gemSprite.node.active = false;
        }

        this.moveAnimator.play(moves, () => {

            // 动画结束才交换真正的数据
            source.setCurrentColor(colorB);
            target.setCurrentColor(colorA);
            this.playPlacementSound(
                source.isCorrect(),
                target.isCorrect()
            );

            this.isAnimating = false;
            this.countMove();
            this.checkCompleted();

            console.log('宝石移动动画完成');
        });
    }


    // 托盘 → 棋盘，可与错误宝石交换

    private moveFromTray(
        index: number,
        target: GemCell
    ) {
        const tray = this.trayManager;

        if (
            !tray ||
            this.isAnimating ||
            target.isCorrect()
        ) return;

        const trayColor = tray.getGemAt(index);
        if (!trayColor) return;

        const targetColor = target.currentColor;

        const slotNode = tray.getSlotNode(index);
        const sourceGem =
            slotNode?.getChildByName('GemImage');

        const sourceFrame = sourceGem
            ?.getComponent(Sprite)
            ?.spriteFrame;

        // 如果目标格有错误宝石，还需要反向交换
        const targetFrame =
            target.gemSprite?.spriteFrame;

        // 动画组件不可用时仍可以进行逻辑交换
        if (
            !this.moveAnimator ||
            !slotNode ||
            !sourceFrame ||
            (targetColor !== null && !targetFrame)
        ) {
            if (tray.setGemAt(index, targetColor)) {
                target.setCurrentColor(trayColor);
                this.playPlacementSound(
                    false,
                    target.isCorrect()
                );
                this.clearSelection();
                this.countMove();
                this.checkCompleted();
            }
            return;
        }

        this.isAnimating = true;
        this.clearSelection();

        const moves: GemMove[] = [{
            frame: sourceFrame,
            from: slotNode,
            to: target.node,
            startSize: 44,
            endSize: 46
        }];

        // 目标格有错误宝石时，双向交换
        if (targetColor && targetFrame) {
            moves.push({
                frame: targetFrame,
                from: target.node,
                to: slotNode,
                startSize: 46,
                endSize: 44
            });
        }

        if (sourceGem) {
            sourceGem.active = false;
        }

        if (targetColor && target.gemSprite) {
            target.gemSprite.node.active = false;
        }

        this.moveAnimator.play(moves, () => {
            // 动画完成后才提交状态
            tray.setGemAt(index, targetColor);
            target.setCurrentColor(trayColor);
            this.playPlacementSound(
                false,
                target.isCorrect()
            );

            this.isAnimating = false;
            this.countMove();
            this.checkCompleted();

            console.log('托盘与棋盘交换动画完成');
        });
    }


    // ===== 点击托盘 =====


    private onTrayClick(index: number) {
        if (
            this.finished ||
            this.isAnimating ||
            !this.trayManager
        ) return;

        const tray = this.trayManager;
        const selection = this.selected;

        if (!selection) {
            this.selectTray(index);
            return;
        }

        if (
            selection.type === 'tray' &&
            selection.index === index
        ) {
            this.clearSelection();
            return;
        }

        // 棋盘 → 托盘
        if (selection.type === 'board') {
            if (!tray.isEmptyAt(index)) {
                this.selectTray(index);
                return;
            }

            const cell = selection.cell;
            const color = cell.currentColor;

            if (!cell.canMove() || !color) return;

            const frame = cell.gemSprite?.spriteFrame;
            const slotNode = tray.getSlotNode(index);

            if (!frame || !slotNode) return;

            if (!this.moveAnimator) {
                if (tray.setGemAt(index, color)) {
                    cell.setCurrentColor(null);
                    this.clearSelection();
                    this.audioManager?.playMove();
                    this.countMove();
                }
                return;
            }

            this.isAnimating = true;
            this.clearSelection();

            // 隐藏原宝石，保留底色
            if (cell.gemSprite) {
                cell.gemSprite.node.active = false;
            }

            this.moveAnimator.play(
                [{
                    frame,
                    from: cell.node,
                    to: slotNode,
                    startSize: 46,
                    endSize: 44
                }],
                () => {
                    // 动画完成后更新数据
                    tray.setGemAt(index, color);
                    cell.setCurrentColor(null);

                    this.isAnimating = false;
                    this.audioManager?.playMove();
                    this.countMove();
                    this.checkCompleted();
                }
            );

            return;
        }

        // 托盘 → 另一个空托盘槽位
        if (tray.isEmptyAt(index)) {
            const sourceIndex = selection.index;
            const color = tray.getGemAt(sourceIndex);

            if (!color) return;

            const sourceSlot = tray.getSlotNode(sourceIndex);
            const targetSlot = tray.getSlotNode(index);

            const sourceGem =
                sourceSlot?.getChildByName('GemImage');

            const frame = sourceGem
                ?.getComponent(Sprite)
                ?.spriteFrame;

            if (
                !this.moveAnimator ||
                !sourceSlot ||
                !targetSlot ||
                !frame
            ) {
                if (tray.setGemAt(index, color)) {
                    tray.setGemAt(sourceIndex, null);
                    this.clearSelection();
                    this.audioManager?.playMove();
                    this.countMove();
                }
                return;
            }

            this.isAnimating = true;
            this.clearSelection();

            if (sourceGem) {
                sourceGem.active = false;
            }

            this.moveAnimator.play(
                [{
                    frame,
                    from: sourceSlot,
                    to: targetSlot,
                    startSize: 44,
                    endSize: 44
                }],
                () => {
                    tray.setGemAt(index, color);
                    tray.setGemAt(sourceIndex, null);

                    this.isAnimating = false;
                    this.audioManager?.playMove();
                    this.countMove();
                }
            );
        } else {
            this.selectTray(index);
        }
    }


    // ===== 关卡切换 =====

    private openLevel(level: number) {
        if (
            !this.levelManager ||
            !this.boardManager ||
            !this.trayManager ||
            this.isAnimating ||
            this.levelManager.isLoading()
        ) {
            return;
        }

        const debugMode = this.debugStartLevel > 0;

        if (
            !debugMode &&
            level > this.levelManager.getHighestUnlockedLevel()
        ) {
            console.warn(
                `[GameManager] LEVEL ${level} 尚未解锁`
            );
            return;
        }

        const returnToComplete = this.finished;

        this.clearSelection();
        this.finished = true;
        this.completePanel?.hide();

        this.levelManager.loadLevel(level, (data) => {
            if (!this.isValid || !data) {
                if (this.isValid) {
                    this.finished = true;
                    if (returnToComplete) {
                  this.completePanel?.show(3);
                    }
                }
                return;
            }

            this.currentLevelData = data;

            if (this.debugStartLevel === 0) {
                this.levelManager?.setLastPlayedLevel(data.id);
            }

            this.trayManager!.resetTray(data.trayCapacity);
            this.boardManager!.loadLevel(
                data.target,
                data.initialSwaps,
                data.initial
            );

            this.selected = null;
            this.finished = false;
            this.isAnimating = false;
            this.moveCount = 0;
            this.audioManager?.playBGM();

            if (this.levelLabel) {
                this.levelLabel.string = `LEVEL ${data.id}`;
            }

            console.log(
                `[GameManager] LEVEL ${data.id} 开始`
            );
        });
    }

    private nextLevel() {
        if (!this.finished || !this.levelManager) return;

        const next = this.levelManager.getCurrentLevel() + 1;
        this.openLevel(next);
    }

    private restartLevel() {
        if (!this.levelManager) return;

        this.openLevel(this.levelManager.getCurrentLevel());
    }

    public getLevelNumber(): number {
        return this.levelManager?.getCurrentLevel() ?? 1;
    }

    // ===== 过关判断 =====

    private checkCompleted() {
        if (
            !this.boardManager ||
            !this.trayManager ||
            !this.levelManager ||
            this.finished
        ) return;

        const completed =
            this.boardManager.isCompleted() &&
            this.trayManager.getGemCount() === 0;

        if (!completed) return;

        this.finished = true;
        this.audioManager?.stopBGM();
        this.audioManager?.playComplete();

        const level = this.levelManager.getCurrentLevel();
        const stars = this.levelManager.calculateStars(
            this.moveCount,
            this.currentLevelData?.starThresholds
        );

        if (this.debugStartLevel === 0) {
            this.levelManager.recordLevelResult(
                level,
                this.moveCount,
                stars
            );
            this.levelManager.unlockNextLevel();
        }

        console.log(
            `[GameManager] LEVEL ${level} COMPLETE! ` +
            `Moves: ${this.moveCount}, Stars: ${stars}`
        );

        this.completePanel?.show(stars);
    }
    onDestroy() {
        this.clearSelection();

        if (this.boardManager) {
            this.boardManager.onCellClicked = null;
        }

        if (this.trayManager) {
            this.trayManager.onSlotClicked = null;
        }
    }
}
