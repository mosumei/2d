
import {
    _decorator, Component, Label, Sprite, SpriteFrame,
    director, Node, Layers, Button, UITransform,
    Graphics, Color, resources, isValid, UIOpacity
} from 'cc';

import { BoardManager } from './BoardManager';
import { TrayManager } from './TrayManager';
import { GemCell, GemColor } from './GemCell';
import { GemMoveAnimator, GemMove } from './GemMoveAnimator';
import { CompletePanelUI } from '../ui/CompletePanelUI';
import { LevelManager, LevelData } from '../core/LevelManager';
import { AudioManager } from '../core/AudioManager'
import { LevelSession } from '../core/LevelSession';
import { ArtifactCollectionManager, ARTIFACTS } from '../core/ArtifactCollectionManager';
import { ArtifactCollectionUI } from '../ui/ArtifactCollectionUI';
import { ToolsBarUI } from '../ui/ToolsBarUI';
import { SettingsButton } from '../ui/SettingsButton';
import { SettingsPanel } from '../ui/SettingsPanel';
import { VibrationManager } from '../core/VibrationManager';
import {
    readTutorialSteps,
    TutorialManager
} from './TutorialManager';
import { MagicWandAdGate } from './MagicWandAdGate';
import { HintEffect } from './HintEffect';
import { MagnetManager } from './MagnetManager';
import { TikTokAdsManager } from '../platform/TikTokAdsManager';
import { JewelEffects } from './JewelEffects';
import { GemCompletionShine } from './GemCompletionShine';
import { localize } from '../core/Locale';

const { ccclass, property } = _decorator;


type Selection =
    | { type: 'board'; cell: GemCell }
    | { type: 'tray'; index: number }
    | null;

type WandSource =
    | { kind: 'cell'; cell: GemCell }
    | { kind: 'tray'; index: number };

type MagnetMove =
    | { kind: 'place'; source: GemCell; dest: GemCell }
    | { kind: 'swap'; source: GemCell; dest: GemCell }
    | { kind: 'tray'; slot: number; dest: GemCell };


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

    @property(JewelEffects)
    effects: JewelEffects | null = null;

    // ===== 游戏内部状态 =====
    private selected: Selection = null;
    private selectedGroup: GemCell[] = [];

    private finished = false;

    // 新增：动画执行期间禁止点击
    private isAnimating = false;

    private moveCount = 0;
    private wandMode = false;
    private toolsBar: ToolsBarUI | null = null;
    private toolsNode: Node | null = null;
    private hintEffect: HintEffect | null = null;
    private magnetManager: MagnetManager | null = null;
    private magnetRunning = false;
    private magnetLocked = 0;
    private tutorial: TutorialManager | null = null;
    private tutorialRunning = false;
    private artifactReveal: Node | null = null;
    private finishToken = 0;
    private artifactToken = 0;

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

    private notifyGemSettled(cells: GemCell[]) {
        if (!this.effects) return;

        for (const cell of cells) {
            if (cell.isCorrect()) {
                this.effects.playGemPlaced(cell.node);
            }
        }
    }
    @property(CompletePanelUI)
    completePanel: CompletePanelUI | null = null;
    @property(ArtifactCollectionUI)
    collectionPanel: ArtifactCollectionUI | null = null;
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

        this.completePanel.onCollection = () => {
            this.completePanel?.hide();
            this.collectionPanel?.show();
        };

        this.completePanel.onHome = () => {
            director.loadScene('MainMenu');
        };
    }

    if (!this.collectionPanel && this.node.parent) {
        const panelNode = new Node('CollectionPanel');
        panelNode.layer = Layers.Enum.UI_2D;
        panelNode.active = false;
        panelNode.parent = this.node.parent;
        this.collectionPanel = panelNode.addComponent(ArtifactCollectionUI);
    }

    this.ensureCollectionEntry();
    this.ensureSettingsEntry();
}

    private ensureCollectionEntry() {
        const canvas = this.node.parent;
        if (!canvas || canvas.getChildByName('CollectionEntry')) return;

        const node = new Node('CollectionEntry');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.setPosition(236, 588, 0);
        node.addComponent(UITransform).setContentSize(176, 52);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(120, 78, 36, 80);
        graphics.roundRect(-86, -30, 176, 52, 18);
        graphics.fill();
        graphics.fillColor = new Color(255, 246, 226, 255);
        graphics.roundRect(-88, -26, 176, 52, 18);
        graphics.fill();
        graphics.strokeColor = new Color(196, 142, 64, 255);
        graphics.lineWidth = 3;
        graphics.roundRect(-88, -26, 176, 52, 18);
        graphics.stroke();
        graphics.fillColor = new Color(92, 64, 42, 255);
        graphics.circle(-58, 0, 12);
        graphics.fill();
        graphics.fillColor = new Color(255, 214, 120, 255);
        graphics.circle(-58, 0, 6);
        graphics.fill();

        const labelNode = new Node('ButtonLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = node;
        labelNode.setPosition(16, 0, 0);
        labelNode.addComponent(UITransform).setContentSize(112, 36);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = localize('我的文物', 'Collection');
        label.overflow = Label.Overflow.SHRINK;
        label.fontSize = 22;
        label.lineHeight = 28;
        label.isBold = true;
        label.color = new Color(92, 58, 32, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, () => {
            this.collectionPanel?.show();
        }, this);

        const complete = canvas.getChildByName('CompletePanel');
        if (complete) {
            node.setSiblingIndex(complete.getSiblingIndex());
        }
    }

    /**
     * 左上角「设置」入口。用代码创建，避免写进场景后被编辑器保存清掉。
     */
    private ensureSettingsEntry() {
        const canvas = this.node.parent;
        if (!canvas) return;

        let panel: SettingsPanel | null = null;
        for (const child of canvas.children) {
            const found = child.getComponent(SettingsPanel);
            if (found) {
                panel = found;
                break;
            }
        }
        if (panel) {
            const settings = panel;
            settings.node.active = false;
            settings.onSave = () => {
                this.levelManager?.flushProgress();
                this.showFloatingTip('HintTip', localize('已保存', 'Saved'));
            };
            settings.onHome = () => {
                settings.closePanel();
                director.loadScene('MainMenu');
            };
            settings.onReplay = () => {
                settings.closePanel();
                this.restartLevel();
            };
        }

        if (canvas.getChildByName('SettingsEntry')) return;

        const node = new Node('SettingsEntry');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.setPosition(-264, 588, 0);
        node.addComponent(UITransform).setContentSize(120, 52);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(120, 78, 36, 80);
        graphics.roundRect(-58, -30, 120, 52, 18);
        graphics.fill();
        graphics.fillColor = new Color(255, 246, 226, 255);
        graphics.roundRect(-60, -26, 120, 52, 18);
        graphics.fill();
        graphics.strokeColor = new Color(196, 142, 64, 255);
        graphics.lineWidth = 3;
        graphics.roundRect(-60, -26, 120, 52, 18);
        graphics.stroke();

        const labelNode = new Node('ButtonLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = node;
        labelNode.addComponent(UITransform).setContentSize(96, 36);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = localize('设置', 'Settings');
        label.overflow = Label.Overflow.SHRINK;
        label.fontSize = 22;
        label.lineHeight = 28;
        label.isBold = true;
        label.color = new Color(92, 58, 32, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const opener = node.addComponent(SettingsButton);
        opener.settingsPanel = panel;

        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, () => {
            panel?.node.setSiblingIndex(canvas.children.length - 1);
            opener.openSettings();
        }, this);

        const complete = canvas.getChildByName('CompletePanel');
        if (complete) {
            node.setSiblingIndex(complete.getSiblingIndex());
        }
    }

    /**
     * 设置面板打开时，棋盘、托盘和道具都不响应。
     */
    private isSettingsOpen(): boolean {
        const canvas = this.node.parent;
        if (!canvas) return false;
        for (const child of canvas.children) {
            const panel = child.getComponent(SettingsPanel);
            if (panel?.node.active) return true;
        }
        return false;
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

        const tools = this.node.parent?.getChildByName('ToolsContainer');
        if (tools) {
            this.toolsNode = tools;
            tools.active = true;
            tools.setPosition(0, -522, 0);
            const bar = tools.getComponent(ToolsBarUI) ?? tools.addComponent(ToolsBarUI);
            bar.build();
            this.toolsBar = bar;
            bar.onWandClick = () => this.toggleWand();
            bar.onHintClick = () => this.useHint();
            bar.onMagnetClick = () => this.useMagnet();
        }
        this.ensureHintEffect();
        this.ensureMagnetManager();

        this.ensureEffects();
        this.ensureArtifactReveal();

        const level = this.debugStartLevel > 0
            ? this.debugStartLevel
            : LevelSession.consumeStartLevel();

        console.log(`[DEBUG] 启动关卡：LEVEL ${level}`);
        this.openLevel(level);
    }

    // ===== 统一处理选中状态 =====

    private clearSelection() {
        const group = Array.isArray(this.selectedGroup) ? this.selectedGroup : [];
        for (const cell of group) {
            if (cell?.isValid) cell.setSelected(false);
        }
        this.selectedGroup = [];

        if (this.trayManager?.isValid) {
            this.trayManager.setSelectedIndex(-1);
        }
        this.selected = null;
    }

    private selectBoard(cell: GemCell) {
        this.clearSelection();

        if (!cell.canMove() || !cell.currentColor) return;

        this.selected = { type: 'board', cell };
        this.selectedGroup = this.getSameColorMovableCells(cell);

        for (const item of this.selectedGroup) {
            item.setSelected(true);
        }
        this.audioManager?.playSelect();
    }

    // 点底部有棋子的槽：只弹起这一色，先不放回拼图。
    private selectTray(index: number) {
        const tray = this.trayManager;
        const color = tray?.getGemAt(index);
        if (!tray || !color) return;

        this.clearSelection();

        const indices: number[] = [];
        for (let slot = 0; tray.getSlotNode(slot); slot++) {
            if (tray.getGemAt(slot) === color) indices.push(slot);
        }
        indices.sort((a, b) => {
            if (a === index) return -1;
            if (b === index) return 1;
            return a - b;
        });

        this.selected = { type: 'tray', index };
        tray.setLiftedSlots(indices);
        this.audioManager?.playSelect();
    }

    // 弹起后点到同色目标格才放回。点到别的可移动棋子，则改拿起那一组。
    private placeLiftedTrayColor(cell: GemCell) {
        const selection = this.selected;
        const tray = this.trayManager;
        if (!selection || selection.type !== 'tray' || !tray) return;

        const color = tray.getGemAt(selection.index);
        if (color && cell.targetColor === color && cell.currentColor === null) {
            this.placeTrayColor(selection.index, cell);
            return;
        }

        if (cell.canMove() && cell.currentColor) {
            this.selectBoard(cell);
        }
    }

    // ===== 点击棋盘格子 =====

    private onBoardClick(cell: GemCell) {
        if (this.isSettingsOpen() || this.isAnimating || this.magnetRunning) return;
        if (this.finished) return;

        if (this.tutorialRunning && !this.tutorial?.allowBoard(cell, this.boardManager)) return;

        if (this.wandMode) {
            this.useWand(cell);
            return;
        }

        const selection = this.selected;

        // 托盘里的棋子已经弹起：只有点到对应目标色，才放回拼图
        if (selection?.type === 'tray') {
            this.placeLiftedTrayColor(cell);
            return;
        }

        // 第一次只拿起和它连在一起的同色，这时还不移动
        if (!selection || selection.type !== 'board') {
            this.selectBoard(cell);
            this.noteTutorialProgress();
            return;
        }

        // 再点这片已选中的格子，取消选中
        if (this.selectedGroup.indexOf(cell) >= 0) {
            this.clearSelection();
            return;
        }

        // 点到空的同色格子，放进去。点到站在自己颜色格上的另一组，就对调。
        const heldColor = selection.cell.currentColor;
        if (heldColor && cell.currentColor === null && cell.targetColor === heldColor) {
            this.exchangeWithTargetGroup(cell);
            return;
        }
        if (
            heldColor &&
            cell.canMove() &&
            cell.currentColor &&
            cell.currentColor !== heldColor &&
            this.exchangeIntoOwnSlots(cell, heldColor)
        ) {
            return;
        }
        if (cell.canMove() && cell.currentColor) {
            this.selectBoard(cell);
            this.noteTutorialProgress();
        }
    }

    private toggleWand() {
        if (this.finished || this.isSettingsOpen() || this.isAnimating || this.magnetRunning || this.tutorial?.blocksInput()) return;
        if (this.wandMode) {
            this.setWandMode(false);
            this.audioManager?.playClick();
            return;
        }

        const level = this.levelManager?.getCurrentLevel() ?? 1;
        if (level > 2) this.isAnimating = true;
        void MagicWandAdGate.requestUse(level, () => {
            this.isAnimating = false;
            if (!this.isValid || this.finished) return;
            this.setWandMode(true);
            this.audioManager?.playClick();
        }).then((result) => {
            if (!this.isValid) return;
            if (result !== 'completed') this.isAnimating = false;
            if (result === 'unavailable') this.showTikTokAdTip();
        });
    }

    private ensureHintEffect() {
        const canvas = this.node.parent;
        if (!canvas) return;
        let node = canvas.getChildByName('HintEffect');
        if (!node) {
            node = new Node('HintEffect');
            node.layer = Layers.Enum.UI_2D;
            node.parent = canvas;
        }
        this.hintEffect = node.getComponent(HintEffect) ?? node.addComponent(HintEffect);
    }

    private ensureMagnetManager() {
        const canvas = this.node.parent;
        if (!canvas) return;
        let node = canvas.getChildByName('MagnetManager');
        if (!node) {
            node = new Node('MagnetManager');
            node.layer = Layers.Enum.UI_2D;
            node.parent = canvas;
        }
        this.magnetManager = node.getComponent(MagnetManager) ?? node.addComponent(MagnetManager);
    }

    /**
     * 先确认有能锁定的宝石，再决定要不要看广告。没有可归位的宝石时不播广告。
     */
    private useMagnet() {
        if (this.finished || this.isSettingsOpen() || this.isAnimating || this.magnetRunning || this.tutorial?.blocksInput()) return;
        if (!this.findMagnetMove(3)) {
            this.showFloatingTip('HintTip', localize('没有可以归位的宝石', 'No gem to place'));
            return;
        }

        const level = this.levelManager?.getCurrentLevel() ?? 1;
        if (level <= 2) {
            void this.runMagnet();
            return;
        }

        this.isAnimating = true;
        void TikTokAdsManager.showRewardedAd().then((result) => {
            if (!this.isValid) return;
            this.isAnimating = false;
            if (result === 'unavailable') this.showTikTokAdTip();
            if (result !== 'completed' || this.finished || this.magnetRunning) return;
            if (!this.findMagnetMove(3)) return;
            void this.runMagnet();
        });
    }

    private async runMagnet() {
        const magnet = this.magnetManager;
        if (!magnet || this.magnetRunning) return;

        this.magnetRunning = true;
        this.magnetLocked = 0;
        this.toolsBar?.playMagnetShake();
        try {
            await magnet.activate(
                () => this.findMagnetMove(3 - this.magnetLocked),
                async (move) => {
                    const count = await this.executeMagnetMove(move);
                    if (count <= 0) return false;
                    this.magnetLocked += count;
                    return true;
                }
            );
        } finally {
            this.magnetRunning = false;
            this.magnetLocked = 0;
            this.toolsBar?.stopMagnetShake();
        }
    }

    /**
     * 找一颗能立刻锁定的宝石。交换会锁定两颗，剩余名额不足两颗时不交换。
     * @param remaining 这次磁铁还能锁定的颗数
     */
    private findMagnetMove(remaining: number): MagnetMove | null {
        if (remaining <= 0 || this.finished) return null;
        const board = this.boardManager;
        if (!board || board.isCompleted()) return null;

        const cells = board.getCells();
        const empties = cells.filter(cell =>
            cell.currentColor === null && cell.targetColor !== null
        );

        for (const source of cells) {
            if (!source.canMove() || !source.currentColor) continue;
            const dest = empties.find(cell => cell.targetColor === source.currentColor);
            if (!dest) continue;
            return { kind: 'place', source, dest };
        }

        if (remaining >= 2) {
            for (const source of cells) {
                if (!source.canMove() || !source.currentColor || !source.targetColor) continue;
                const dest = cells.find(cell =>
                    cell !== source &&
                    cell.canMove() &&
                    cell.currentColor === source.targetColor &&
                    cell.targetColor === source.currentColor
                );
                if (!dest) continue;
                return { kind: 'swap', source, dest };
            }
        }

        const tray = this.trayManager;
        if (!tray) return null;
        for (let slot = 0; ; slot++) {
            const slotNode = tray.getSlotNode(slot);
            if (!slotNode) break;
            const color = tray.getGemAt(slot);
            if (!color) continue;
            const dest = empties.find(cell => cell.targetColor === color);
            if (!dest) continue;
            return { kind: 'tray', slot, dest };
        }
    }

    private async executeMagnetMove(move: MagnetMove): Promise<number> {
        switch (move.kind) {
            case 'place':
                return this.placeOneGem(move.source, move.dest);
            case 'swap':
                return this.swapOnePair(move.source, move.dest);
            case 'tray':
                return this.placeOneFromTray(move.slot, move.dest);
            default: {
                const unknown: never = move;
                void unknown;
                return 0;
            }
        }
    }

    private async placeOneGem(source: GemCell, dest: GemCell): Promise<number> {
        const color = source.currentColor;
        const frame = source.gemSprite?.spriteFrame;
        if (!color || !frame || dest.currentColor !== null || dest.targetColor !== color) return 0;

        this.hideMovedGems([source]);
        await this.runMoves([{
            frame,
            from: source.node,
            to: dest.node,
            startSize: 46,
            endSize: 46,
            onArrive: () => {
                source.setCurrentColor(null);
                dest.setCurrentColor(color);
                this.settleLandedGem(dest);
            }
        }], [source, dest]);
        return dest.isCorrect() ? 1 : 0;
    }

    private async swapOnePair(source: GemCell, dest: GemCell): Promise<number> {
        const colorA = source.currentColor;
        const colorB = dest.currentColor;
        const frameA = source.gemSprite?.spriteFrame;
        const frameB = dest.gemSprite?.spriteFrame;
        if (!colorA || !colorB || !frameA || !frameB) return 0;
        if (source.targetColor !== colorB || dest.targetColor !== colorA) return 0;

        this.hideMovedGems([source, dest]);
        await this.runMoves([
            {
                frame: frameA,
                from: source.node,
                to: dest.node,
                startSize: 46,
                endSize: 46,
                onArrive: () => {
                    dest.setCurrentColor(colorA);
                    this.settleLandedGem(dest);
                }
            },
            {
                frame: frameB,
                from: dest.node,
                to: source.node,
                startSize: 46,
                endSize: 46,
                onArrive: () => {
                    source.setCurrentColor(colorB);
                    this.settleLandedGem(source);
                }
            }
        ], [source, dest]);
        return (source.isCorrect() ? 1 : 0) + (dest.isCorrect() ? 1 : 0);
    }

    private async placeOneFromTray(slot: number, dest: GemCell): Promise<number> {
        const tray = this.trayManager;
        const color = tray?.getGemAt(slot);
        const slotNode = tray?.getSlotNode(slot);
        const sourceGem = slotNode?.getChildByName('GemImage');
        const frame = sourceGem?.getComponent(Sprite)?.spriteFrame;
        if (!tray || !color || !slotNode || !sourceGem || !frame) return 0;
        if (dest.currentColor !== null || dest.targetColor !== color) return 0;

        sourceGem.active = false;
        await this.runMoves([{
            frame,
            from: slotNode,
            to: dest.node,
            startSize: 44,
            endSize: 46,
            onArrive: () => {
                tray.setGemAt(slot, null);
                dest.setCurrentColor(color);
                this.settleLandedGem(dest);
            }
        }], [dest]);
        tray.compact();
        return dest.isCorrect() ? 1 : 0;
    }

    /**
     * 先确认有合法提示，再决定要不要看广告。没有提示时不播广告。
     */
    private useHint() {
        if (this.finished || this.isSettingsOpen() || this.isAnimating || this.magnetRunning || this.tutorial?.blocksInput()) return;
        if (!this.findBestHint()) {
            this.showNoHintTip();
            return;
        }

        const level = this.levelManager?.getCurrentLevel() ?? 1;
        if (level <= 2) {
            this.presentHint();
            return;
        }

        this.isAnimating = true;
        void TikTokAdsManager.showRewardedAd().then((result) => {
            if (!this.isValid) return;
            this.isAnimating = false;
            if (result === 'unavailable') this.showTikTokAdTip();
            if (result !== 'completed' || this.finished) return;
            this.presentHint();
        });
    }

    private presentHint() {
        const hint = this.findBestHint();
        if (!hint) return;
        this.hintEffect?.showHint(hint.source, hint.target);
        this.audioManager?.playClick();
    }

    /**
     * 优先提示能立刻归位的一步：先放进同色空位，再对调占错的两组，最后才用托盘。
     */
    private findBestHint(): { source: Node; target: Node } | null {
        const board = this.boardManager;
        if (!board) return null;

        const cells = board.getCells();
        const empties = cells.filter(cell =>
            cell.currentColor === null && cell.targetColor !== null
        );

        for (const source of cells) {
            if (!source.canMove() || !source.currentColor) continue;
            const target = empties.find(cell => cell.targetColor === source.currentColor);
            if (!target) continue;
            return { source: source.node, target: target.node };
        }

        for (const source of cells) {
            if (!source.canMove() || !source.currentColor || !source.targetColor) continue;
            const dest = cells.find(cell =>
                cell !== source &&
                cell.canMove() &&
                cell.currentColor === source.targetColor &&
                cell.targetColor === source.currentColor
            );
            if (!dest) continue;
            return { source: source.node, target: dest.node };
        }

        const tray = this.trayManager;
        if (!tray) return null;

        for (let slot = 0; ; slot++) {
            const slotNode = tray.getSlotNode(slot);
            if (!slotNode) break;
            const color = tray.getGemAt(slot);
            if (!color) continue;
            const target = empties.find(cell => cell.targetColor === color);
            if (!target) continue;
            return { source: slotNode, target: target.node };
        }

        const emptySlot = tray.getFirstEmptySlot();
        const slotNode = emptySlot >= 0 ? tray.getSlotNode(emptySlot) : null;
        const source = cells.find(cell => cell.canMove());
        if (source && slotNode) {
            return { source: source.node, target: slotNode };
        }

        return null;
    }

    private showNoHintTip() {
        this.showFloatingTip('HintTip', localize('没有可以提示的步骤', 'No move to hint'));
    }

    private setWandMode(armed: boolean) {
        this.wandMode = armed;
        if (armed) this.clearSelection();
        this.toolsBar?.setWandArmed(armed);
    }

    /**
     * 编辑器里没有 TikTok 广告接口时，说明要去 ttmg 里看。
     */
    private showTikTokAdTip() {
        this.showFloatingTip(
            'TikTokAdTip',
            localize(
                '广告只有在 ttmg 开发者工具里才能看到\n目前只接了 TikTok',
                'Ads only show in the ttmg developer tool\nOnly TikTok is connected for now'
            )
        );
    }

    private showFloatingTip(name: string, text: string) {
        const canvas = this.node.parent;
        if (!canvas) return;
        let tip = canvas.getChildByName(name);
        if (!tip) {
            tip = new Node(name);
            tip.layer = Layers.Enum.UI_2D;
            tip.parent = canvas;
            tip.setPosition(0, 360, 0);
            const transform = tip.addComponent(UITransform);
            transform.setContentSize(640, 96);
            Object.assign(transform, { hitTest: () => false });
            const graphics = tip.addComponent(Graphics);
            graphics.fillColor = new Color(255, 248, 235, 245);
            graphics.roundRect(-300, -44, 600, 88, 18);
            graphics.fill();
            graphics.strokeColor = new Color(196, 142, 64, 255);
            graphics.lineWidth = 3;
            graphics.roundRect(-300, -44, 600, 88, 18);
            graphics.stroke();
            const labelNode = new Node('TipLabel');
            labelNode.layer = Layers.Enum.UI_2D;
            labelNode.parent = tip;
            labelNode.addComponent(UITransform).setContentSize(560, 72);
            const label = labelNode.addComponent(Label);
            label.useSystemFont = true;
            label.fontFamily = 'PingFang SC';
            label.fontSize = 24;
            label.lineHeight = 32;
            label.isBold = true;
            label.color = new Color(92, 58, 32, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.overflow = Label.Overflow.SHRINK;
        }
        const label = tip.getChildByName('TipLabel')?.getComponent(Label);
        if (label) label.string = text;
        tip.active = true;
        tip.setSiblingIndex(canvas.children.length - 1);
        this.unschedule(this.hideTikTokAdTip);
        this.scheduleOnce(this.hideTikTokAdTip, 2.8);
    }

    private hideTikTokAdTip() {
        for (const name of ['TikTokAdTip', 'HintTip']) {
            const tip = this.node.parent?.getChildByName(name);
            if (tip) tip.active = false;
        }
    }

    private useWand(cell: GemCell) {
        const board = this.boardManager;
        if (!board || !cell.targetColor) return;

        const region = this.collectWandRegion(cell);
        if (region.length === 0) return;

        this.hintEffect?.clearHint();
        this.setWandMode(false);
        this.clearSelection();
        this.effects?.showWandRegion(
            board.node,
            region.map(item => ({
                x: item.node.position.x,
                y: item.node.position.y,
                size: item.getDisplaySize(),
                socket: item.getTargetFrame(),
                gem: item.targetColor
                    ? item.getGemFrame(item.targetColor)
                    : null
            })),
            this.toolsBar?.getWandFrame() ?? null
        );

        const restore = this.planWandRestore(region);
        const token = this.finishToken;
        this.isAnimating = true;
        this.scheduleOnce(() => {
            if (!this.isValid || token !== this.finishToken) {
                this.effects?.hideWandRegion();
                this.isAnimating = false;
                return;
            }
            this.playWandRestore(restore);
        }, 0.45);
    }

    // 以点中的格子为中心，取 3×3 里真正有插槽的格子。
    private collectWandRegion(origin: GemCell): GemCell[] {
        const board = this.boardManager;
        if (!board) return [];

        const region: GemCell[] = [];
        for (let row = origin.row - 1; row <= origin.row + 1; row++) {
            for (let col = origin.col - 1; col <= origin.col + 1; col++) {
                const item = board.getCell(row, col);
                if (item?.targetColor) region.push(item);
            }
        }
        return region;
    }

    private planWandRestore(region: GemCell[]): {
        moves: GemMove[];
        apply: () => void;
        changed: GemCell[];
    } {
        const empty = {
            moves: [] as GemMove[],
            apply: () => undefined,
            changed: [] as GemCell[]
        };
        const board = this.boardManager;
        const tray = this.trayManager;
        if (!board) return empty;

        const regionIds = new Set(region.map(cell => this.cellKey(cell)));
        const needs = region.filter(cell => cell.targetColor && !cell.isCorrect());
        const claimed = new Set<string>();
        const claims: { dest: GemCell; source: WandSource }[] = [];

        for (const dest of needs) {
            const color = dest.targetColor;
            if (!color) continue;
            const source = this.findWandSource(color, dest, regionIds, claimed);
            if (!source) continue;
            claimed.add(this.wandKey(source));
            claims.push({ dest, source });
        }

        if (claims.length === 0) return empty;

        const sourceKeys = new Set(claims.map(claim => this.wandKey(claim.source)));
        const destKeys = new Set(claims.map(claim => this.cellKey(claim.dest)));
        const original = new Map<string, GemColor | null>();
        for (const claim of claims) {
            original.set(this.wandKey(claim.source), this.readWandColor(claim.source));
            original.set(this.cellKey(claim.dest), claim.dest.currentColor);
        }

        const holes: WandSource[] = [];
        const displaced: GemCell[] = [];
        for (const claim of claims) {
            if (!this.isWandDest(claim.source, destKeys)) holes.push(claim.source);
            if (!sourceKeys.has(this.cellKey(claim.dest))) displaced.push(claim.dest);
        }

        const nextCell = new Map<GemCell, GemColor | null>();
        const nextTray = new Map<number, GemColor | null>();
        for (const claim of claims) {
            nextCell.set(claim.dest, original.get(this.wandKey(claim.source)) ?? null);
        }
        for (let index = 0; index < holes.length; index++) {
            const hole = holes[index];
            const color = displaced[index]
                ? original.get(this.cellKey(displaced[index])) ?? null
                : null;
            if (hole.kind === 'cell') nextCell.set(hole.cell, color);
            else nextTray.set(hole.index, color);
        }

        const moves: GemMove[] = [];
        const pushMove = (color: GemColor | null, from: WandSource, to: WandSource) => {
            if (!color) return;
            const fromNode = this.wandNode(from);
            const toNode = this.wandNode(to);
            const frame = this.wandFrame(from, color);
            if (!fromNode || !toNode || !frame) return;
            moves.push({
                frame,
                from: fromNode,
                to: toNode,
                startSize: this.wandGemSize(from),
                endSize: this.wandGemSize(to)
            });
        };

        for (const claim of claims) {
            pushMove(
                original.get(this.wandKey(claim.source)) ?? null,
                claim.source,
                { kind: 'cell', cell: claim.dest }
            );
        }
        for (let index = 0; index < holes.length; index++) {
            const fromCell = displaced[index];
            if (!fromCell) continue;
            pushMove(
                original.get(this.cellKey(fromCell)) ?? null,
                { kind: 'cell', cell: fromCell },
                holes[index]
            );
        }

        const changed = [...nextCell.keys()];
        return {
            moves,
            changed,
            apply: () => {
                for (const [cell, color] of nextCell) {
                    cell.setCurrentColor(color);
                }
                if (!tray) return;
                for (const [index, color] of nextTray) {
                    tray.setGemAt(index, color);
                }
                tray.compact();
            }
        };
    }

    private playWandRestore(restore: {
        moves: GemMove[];
        apply: () => void;
        changed: GemCell[];
    }) {
        let settled = false;
        const finish = () => {
            if (settled || !this.isValid) return;
            settled = true;
            this.unschedule(finish);
            try {
                restore.apply();
                this.effects?.hideWandRegion();
            } finally {
                this.isAnimating = false;
            }
            this.notifyGemSettled(restore.changed);
            const matched = restore.changed.some(cell => cell.isCorrect());
            this.playPlacementSound(matched, false);
            if (restore.changed.length > 0) {
                this.countMove();
                this.noteTutorialProgress();
                this.vibrateAfterMove(matched, true);
            }
        };

        if (!this.moveAnimator || restore.moves.length === 0) {
            finish();
            return;
        }

        this.hideMovedGems(restore.changed);
        for (const move of restore.moves) {
            const gem = move.from.getChildByName('GemImage');
            if (gem) gem.active = false;
        }
        this.scheduleOnce(finish, 0.7);
        this.moveAnimator.play(restore.moves, finish);
    }

    private findWandSource(
        color: GemColor,
        dest: GemCell,
        regionIds: Set<string>,
        claimed: Set<string>
    ): WandSource | null {
        const cells = this.boardManager?.getCells() ?? [];
        const inside = cells.find(cell =>
            regionIds.has(this.cellKey(cell)) &&
            cell !== dest &&
            !cell.isCorrect() &&
            cell.currentColor === color &&
            !claimed.has(this.cellKey(cell))
        );
        if (inside) return { kind: 'cell', cell: inside };

        const tray = this.trayManager;
        if (tray) {
            for (let index = 0; tray.getSlotNode(index); index++) {
                const key = `t${index}`;
                if (tray.getGemAt(index) === color && !claimed.has(key)) {
                    return { kind: 'tray', index };
                }
            }
        }

        const outside = cells.find(cell =>
            !regionIds.has(this.cellKey(cell)) &&
            !cell.isCorrect() &&
            cell.currentColor === color &&
            !claimed.has(this.cellKey(cell))
        );
        if (outside) return { kind: 'cell', cell: outside };
        return null;
    }

    private cellKey(cell: GemCell): string {
        return `c${cell.row}_${cell.col}`;
    }

    private wandKey(source: WandSource): string {
        switch (source.kind) {
            case 'cell': return this.cellKey(source.cell);
            case 'tray': return `t${source.index}`;
            default: {
                const unknown: never = source;
                return unknown;
            }
        }
    }

    private isWandDest(source: WandSource, destKeys: Set<string>): boolean {
        return source.kind === 'cell' && destKeys.has(this.cellKey(source.cell));
    }

    private readWandColor(source: WandSource): GemColor | null {
        switch (source.kind) {
            case 'cell': return source.cell.currentColor;
            case 'tray': return this.trayManager?.getGemAt(source.index) ?? null;
            default: {
                const unknown: never = source;
                return unknown;
            }
        }
    }

    private wandNode(source: WandSource): Node | null {
        switch (source.kind) {
            case 'cell': return source.cell.node;
            case 'tray': return this.trayManager?.getSlotNode(source.index) ?? null;
            default: {
                const unknown: never = source;
                return unknown;
            }
        }
    }

    private wandFrame(source: WandSource, color: GemColor): SpriteFrame | null {
        switch (source.kind) {
            case 'cell':
                return source.cell.gemSprite?.spriteFrame
                    ?? source.cell.getGemFrame(color);
            case 'tray': {
                const slot = this.trayManager?.getSlotNode(source.index);
                return slot?.getChildByName('GemImage')?.getComponent(Sprite)?.spriteFrame
                    ?? null;
            }
            default: {
                const unknown: never = source;
                return unknown;
            }
        }
    }

    private wandGemSize(source: WandSource): number {
        switch (source.kind) {
            case 'cell': return Math.round(source.cell.getDisplaySize() * 0.72);
            case 'tray': return 44;
            default: {
                const unknown: never = source;
                return unknown;
            }
        }
    }

    // 和点中的那颗上下左右相连、还没归位的同色棋子。点中的那颗排在最前。
    private getSameColorMovableCells(origin: GemCell): GemCell[] {
        const color = origin.currentColor;
        const board = this.boardManager;
        if (!color || !board || !origin.canMove()) return [];

        const group: GemCell[] = [];
        const seen = new Set<GemCell>();
        const pending: GemCell[] = [origin];

        while (pending.length > 0) {
            const cell = pending.pop();
            if (!cell || seen.has(cell)) continue;
            seen.add(cell);
            if (!cell.canMove() || cell.currentColor !== color) continue;

            group.push(cell);
            const neighbors = [
                board.getCell(cell.row - 1, cell.col),
                board.getCell(cell.row + 1, cell.col),
                board.getCell(cell.row, cell.col - 1),
                board.getCell(cell.row, cell.col + 1)
            ];
            for (const neighbor of neighbors) {
                if (neighbor) pending.push(neighbor);
            }
        }

        group.sort((a, b) => {
            if (a === origin) return -1;
            if (b === origin) return 1;
            return a.row - b.row || a.col - b.col;
        });
        return group;
    }

    // 从点中的空格出发，只取连在一起的同色空格。
    private getConnectedEmptyCells(origin: GemCell): GemCell[] {
        const board = this.boardManager;
        const color = origin.targetColor;
        if (!board || !color || origin.currentColor !== null) return [];

        const group: GemCell[] = [];
        const seen = new Set<GemCell>();
        const pending: GemCell[] = [origin];

        while (pending.length > 0) {
            const cell = pending.pop();
            if (!cell || seen.has(cell)) continue;
            seen.add(cell);
            if (cell.currentColor !== null || cell.targetColor !== color) continue;

            group.push(cell);
            const neighbors = [
                board.getCell(cell.row - 1, cell.col),
                board.getCell(cell.row + 1, cell.col),
                board.getCell(cell.row, cell.col - 1),
                board.getCell(cell.row, cell.col + 1)
            ];
            for (const neighbor of neighbors) {
                if (neighbor) pending.push(neighbor);
            }
        }

        group.sort((a, b) => {
            if (a === origin) return -1;
            if (b === origin) return 1;
            return a.row - b.row || a.col - b.col;
        });
        return group;
    }

    // 选中的同色棋子放进空槽。空槽不够时，先拿走点中的那颗，其余留在原位。
    private takeSameColorToTray(origin: GemCell): boolean {
        const tray = this.trayManager;
        const color = origin.currentColor;
        if (!tray || !color || !origin.canMove() || this.isAnimating) {
            return false;
        }

        const slots = tray.getEmptyIndices();
        const cells = this.selectedGroup.length > 0
            ? [...this.selectedGroup]
            : this.getSameColorMovableCells(origin);

        const batch: { cell: GemCell; color: GemColor; slot: number }[] = [];
        for (let i = 0; i < cells.length && batch.length < slots.length; i++) {
            const cell = cells[i];
            const gemColor = cell.currentColor;
            const frame = cell.gemSprite?.spriteFrame;
            const slot = slots[batch.length];
            if (!gemColor || !frame || !tray.getSlotNode(slot)) continue;
            batch.push({ cell, color: gemColor, slot });
        }

        if (batch.length === 0) return false;

        this.hintEffect?.clearHint();

        if (!this.moveAnimator) {
            this.audioManager?.playTray();
            for (const item of batch) {
                if (tray.setGemAt(item.slot, item.color)) {
                    item.cell.setCurrentColor(null);
                }
            }
            this.clearSelection();
            this.countMove();
            this.noteTutorialProgress();
            this.checkCompleted();
            return true;
        }

        this.isAnimating = true;
        this.clearSelection();

        const moves: GemMove[] = [];
        batch.forEach((item, index) => {
            const slotNode = tray.getSlotNode(item.slot);
            const frame = item.cell.gemSprite?.spriteFrame;
            if (!slotNode || !frame) return;
            if (item.cell.gemSprite) {
                item.cell.gemSprite.node.active = false;
            }
            moves.push({
                frame,
                from: item.cell.node,
                to: slotNode,
                startSize: Math.round(item.cell.getDisplaySize() * 0.72),
                endSize: 44,
                delay: index * 0.05,
                onArrive: () => {
                    tray.setGemAt(item.slot, item.color);
                    item.cell.setCurrentColor(null);
                    this.audioManager?.playTray();
                }
            });
        });

        this.moveAnimator.play(moves, () => {
            this.isAnimating = false;
            this.countMove();
            this.noteTutorialProgress();
            this.checkCompleted();
        });

        return true;
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
            this.notifyGemSettled([source, target]);
            this.clearSelection();
            this.countMove();
            this.noteTutorialProgress();
            this.vibrateAfterMove(source.isCorrect() || target.isCorrect());
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
            this.notifyGemSettled([source, target]);

            this.isAnimating = false;
            this.countMove();
            this.noteTutorialProgress();
            this.vibrateAfterMove(source.isCorrect() || target.isCorrect());

            console.log('宝石移动动画完成');
        });
    }


    // 把拿起的同色棋子放进点中这片连在一起的空格。
    private exchangeWithTargetGroup(clicked: GemCell) {
        const selection = this.selected;
        const gemColor = selection?.type === 'board'
            ? selection.cell.currentColor
            : null;
        const board = this.boardManager;
        if (!gemColor || !board || clicked.currentColor !== null) return;

        const sources = this.selectedGroup.filter(cell =>
            cell.canMove() &&
            cell.currentColor === gemColor &&
            cell.targetColor !== gemColor
        );
        const origin = selection?.type === 'board' ? selection.cell : null;
        if (origin) {
            const originIndex = sources.indexOf(origin);
            if (originIndex > 0) {
                sources.splice(originIndex, 1);
                sources.unshift(origin);
            }
        }

        const destinations = this.getConnectedEmptyCells(clicked);

        const count = Math.min(sources.length, destinations.length);
        if (count === 0) return;

        const pairs = sources.slice(0, count).map((source, index) => ({
            source,
            dest: destinations[index]
        }));
        const moves: GemMove[] = [];
        for (let index = 0; index < pairs.length; index++) {
            const pair = pairs[index];
            const frameA = pair.source.gemSprite?.spriteFrame;
            const sourceColor = pair.source.currentColor;
            if (!frameA || !sourceColor) return;
            moves.push({
                frame: frameA,
                from: pair.source.node,
                to: pair.dest.node,
                startSize: 46,
                endSize: 46,
                delay: index * 0.05,
                onArrive: () => {
                    pair.source.setCurrentColor(null);
                    pair.dest.setCurrentColor(sourceColor);
                    this.settleLandedGem(pair.dest);
                }
            });
        }

        this.hideMovedGems(pairs.map(pair => pair.source));
        const changed = pairs.flatMap(pair => [pair.source, pair.dest]);
        this.runMoves(moves, changed);
    }

    // 两组棋子正好占着对方的颜色格时，对调到各自的格子。
    private exchangeIntoOwnSlots(clicked: GemCell, heldColor: GemColor): boolean {
        const otherColor = clicked.currentColor;
        if (!otherColor || clicked.targetColor !== heldColor) return false;

        const sources = this.selectedGroup.filter(cell =>
            cell.canMove() &&
            cell.currentColor === heldColor &&
            cell.targetColor === otherColor
        );
        const destinations = this.getSameColorMovableCells(clicked).filter(cell =>
            cell.currentColor === otherColor &&
            cell.targetColor === heldColor
        );
        const count = Math.min(sources.length, destinations.length);
        if (count === 0) return false;

        const pairs = sources.slice(0, count).map((source, index) => ({
            source,
            dest: destinations[index]
        }));
        const moves: GemMove[] = [];
        for (let index = 0; index < pairs.length; index++) {
            const pair = pairs[index];
            const frameA = pair.source.gemSprite?.spriteFrame;
            const frameB = pair.dest.gemSprite?.spriteFrame;
            const sourceColor = pair.source.currentColor;
            const destColor = pair.dest.currentColor;
            if (!frameA || !frameB || !sourceColor || !destColor) return false;
            moves.push({
                frame: frameA,
                from: pair.source.node,
                to: pair.dest.node,
                startSize: 46,
                endSize: 46,
                delay: index * 0.05,
                onArrive: () => {
                    pair.dest.setCurrentColor(sourceColor);
                    this.settleLandedGem(pair.dest);
                }
            });
            moves.push({
                frame: frameB,
                from: pair.dest.node,
                to: pair.source.node,
                startSize: 46,
                endSize: 46,
                delay: index * 0.05,
                onArrive: () => {
                    pair.source.setCurrentColor(destColor);
                    this.settleLandedGem(pair.source);
                }
            });
        }

        this.hideMovedGems(pairs.map(pair => pair.source));
        this.hideMovedGems(pairs.map(pair => pair.dest));
        const changed = pairs.flatMap(pair => [pair.source, pair.dest]);
        this.runMoves(moves, changed);
        return true;
    }

    // 托盘里已弹起的颜色，放进点中这片连在一起的空格。
    private placeTrayColor(index: number, clicked: GemCell) {
        const tray = this.trayManager;
        const board = this.boardManager;
        if (!tray || !board) return;

        const color = tray.getGemAt(index);
        if (!color) return;

        const slotIndices: number[] = [];
        for (let slot = 0; tray.getSlotNode(slot); slot++) {
            if (tray.getGemAt(slot) === color) slotIndices.push(slot);
        }
        slotIndices.sort((a, b) => {
            if (a === index) return -1;
            if (b === index) return 1;
            return a - b;
        });

        const destinations = this.getConnectedEmptyCells(clicked);

        const count = Math.min(slotIndices.length, destinations.length);
        if (count === 0) return;

        const pairs = slotIndices.slice(0, count).map((slot, slotIndex) => ({
            slot,
            dest: destinations[slotIndex]
        }));
        const moves: GemMove[] = [];
        for (let index = 0; index < pairs.length; index++) {
            const pair = pairs[index];
            const slotNode = tray.getSlotNode(pair.slot);
            const sourceGem = slotNode?.getChildByName('GemImage');
            const sourceFrame = sourceGem?.getComponent(Sprite)?.spriteFrame;
            if (!slotNode || !sourceFrame) return;
            moves.push({
                frame: sourceFrame,
                from: slotNode,
                to: pair.dest.node,
                startSize: 44,
                endSize: 46,
                delay: index * 0.05,
                onArrive: () => {
                    tray.setGemAt(pair.slot, null);
                    pair.dest.setCurrentColor(color);
                    this.settleLandedGem(pair.dest);
                }
            });
        }

        if (this.moveAnimator) {
            for (const pair of pairs) {
                const sourceGem = tray.getSlotNode(pair.slot)?.getChildByName('GemImage');
                if (sourceGem) sourceGem.active = false;
            }
        }
        this.runMoves(moves, pairs.map(pair => pair.dest)).then(() => {
            if (!this.isValid) return;
            tray.compact();
        });
    }

    private hideMovedGems(cells: GemCell[]) {
        if (!this.moveAnimator) return;
        for (const cell of cells) {
            if (cell.currentColor && cell.gemSprite) {
                cell.gemSprite.node.active = false;
            }
        }
    }

    /**
     * 一颗棋子落稳后的闪光和音效。振动仍按整次操作只响一次。
     */
    private settleLandedGem(cell: GemCell) {
        this.notifyGemSettled([cell]);
        this.playPlacementSound(cell.isCorrect(), false);
    }

    private runMoves(
        moves: GemMove[],
        changed: GemCell[]
    ): Promise<void> {
        return new Promise((resolve) => {
            const finish = () => {
                this.isAnimating = false;
                const matched = changed.some(cell => cell.isCorrect());
                this.countMove();
                this.noteTutorialProgress();
                this.vibrateAfterMove(matched);
                resolve();
            };

            this.hintEffect?.clearHint();
            this.clearSelection();
            if (!this.moveAnimator || moves.length === 0) {
                for (const move of moves) move.onArrive?.();
                finish();
                return;
            }

            this.isAnimating = true;
            this.moveAnimator.play(moves, finish);
        });
    }

    // ===== 点击托盘 =====


    private onTrayClick(index: number) {
        if (
            this.finished ||
            this.isSettingsOpen() ||
            this.isAnimating ||
            this.magnetRunning ||
            !this.trayManager
        ) return;

        if (this.tutorialRunning && !this.tutorial?.allowTray(index, this.trayManager)) return;

        if (this.wandMode) {
            this.setWandMode(false);
            return;
        }

        const tray = this.trayManager;
        if (tray.isEmptyAt(index)) {
            if (this.selected?.type === 'board') {
                this.takeSameColorToTray(this.selected.cell);
            }
            return;
        }

        const color = tray.getGemAt(index);
        if (
            this.selected?.type === 'tray' &&
            color !== null &&
            tray.getGemAt(this.selected.index) === color
        ) {
            this.clearSelection();
            return;
        }

        this.selectTray(index);
        this.noteTutorialProgress();
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

        this.finishToken++;
        this.ensureEffects();
        this.resetLevelVisuals();

        const returnToComplete = this.finished;

        this.clearSelection();
        this.hintEffect?.clearHint();
        this.finished = true;
        this.completePanel?.hide();
        this.collectionPanel?.hide();

        this.levelManager.loadLevel(level, (data) => {
            if (!this.isValid || !data) {
                if (this.isValid) {
                    this.finished = true;
                    if (returnToComplete) {
                  this.completePanel?.show(3, this.levelManager?.getCurrentLevel() ?? 1);
                    }
                }
                return;
            }

            this.currentLevelData = data;

            if (this.debugStartLevel === 0) {
                this.levelManager?.setLastPlayedLevel(data.id);
            }

            this.trayManager!.resetTray(data.trayCapacity);
            const steps = readTutorialSteps(data.tutorialSteps);
            if (this.toolsNode) this.toolsNode.active = true;
            this.tutorial?.stop();
            this.tutorial = null;
            this.tutorialRunning = false;
            this.boardManager!.loadLevel(
                data.target,
                data.initialSwaps,
                data.initial,
                () => {
                    if (!this.isValid || steps.length === 0) return;
                    const canvas = this.node.parent;
                    if (!canvas || !this.boardManager || !this.trayManager) return;
                    this.tutorial = new TutorialManager();
                    this.tutorialRunning = true;
                    this.tutorial.start(
                        steps,
                        canvas,
                        this.boardManager,
                        this.trayManager
                    );
                }
            );
            this.refreshArtifactReveal(data.id);

            this.selected = null;
            this.finished = false;
            this.setWandMode(false);
            this.isAnimating = false;
            this.moveCount = 0;
            this.audioManager?.playBGM();

            if (this.levelLabel) {
                this.levelLabel.string = `LEVEL ${data.id}`;
            }
            this.toolsBar?.setWatchAdBadge(data.id > 2);

            console.log(
                `[GameManager] LEVEL ${data.id} 开始`
            );
        });
    }

    /**
     * 引导步骤走完后收起提示，棋盘继续按普通关卡结算。
     */
    private endTutorialGuide() {
        this.tutorialRunning = false;
        this.tutorial?.stop();
        this.tutorial = null;
        if (this.toolsNode) this.toolsNode.active = true;
    }

    /**
     * 当前教学步骤已经完成时，切到下一步。
     */
    private noteTutorialProgress() {
        if (!this.tutorialRunning || !this.tutorial || !this.boardManager || !this.trayManager) {
            return;
        }
        const selected = this.selected?.type === 'board'
            ? {
                type: 'board' as const,
                row: this.selected.cell.row,
                col: this.selected.cell.col,
                slot: -1
            }
            : this.selected?.type === 'tray'
                ? {
                    type: 'tray' as const,
                    row: -1,
                    col: -1,
                    slot: this.selected.index
                }
                : null;
        this.tutorial.advanceIfDone(this.boardManager, this.trayManager, selected);
        if (this.tutorial.isComplete()) {
            this.endTutorialGuide();
        }
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
        VibrationManager.levelCompleted();

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

        // 调试模式也允许本机测试收藏，正式发布前请将 debugStartLevel 设为 0。
        const newlyCollected = ArtifactCollectionManager.collect(level);
        this.presentLevelComplete(stars, level, newlyCollected);
    }

    /**
     * 一次操作结束后振动。刚通关时只保留通关振动。
     * @param matched 是否有宝石正确归位
     * @param wand 这次操作是否来自魔法棒
     */
    private vibrateAfterMove(matched: boolean, wand = false) {
        const wasFinished = this.finished;
        this.checkCompleted();
        if (wasFinished || this.finished) {
            return;
        }
        if (wand) {
            VibrationManager.magicUsed();
            return;
        }
        if (matched) {
            VibrationManager.gemMatched();
        }
    }

    private ensureEffects() {
        if (this.effects?.isValid) return;

        const canvas = this.node.parent;
        if (!canvas) return;

        let node = canvas.getChildByName('EffectsManager');
        if (!node) {
            node = new Node('EffectsManager');
            node.layer = Layers.Enum.UI_2D;
            node.parent = canvas;
            node.addComponent(UITransform);
        }

        this.effects = node.getComponent(JewelEffects)
            ?? node.addComponent(JewelEffects);
    }

    private ensureArtifactReveal() {
        const canvas = this.node.parent;
        const board = this.boardManager?.node;
        if (!canvas || !board) return;

        let node = canvas.getChildByName('ArtifactReveal');
        if (!node) {
            node = new Node('ArtifactReveal');
            node.layer = Layers.Enum.UI_2D;
            node.parent = canvas;
            node.addComponent(UITransform);
            const opacity = node.addComponent(UIOpacity);
            opacity.opacity = 0;
            node.active = false;
        }

        let imageNode = node.getChildByName('ArtifactImage');
        if (!imageNode) {
            imageNode = new Node('ArtifactImage');
            imageNode.layer = Layers.Enum.UI_2D;
            imageNode.parent = node;
            imageNode.addComponent(UITransform);
            const sprite = imageNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = Color.WHITE;
        }

        if (!node.getComponent(UIOpacity)) {
            const opacity = node.addComponent(UIOpacity);
            opacity.opacity = 0;
        }

        const boardTransform = board.getComponent(UITransform);
        const width = boardTransform?.contentSize.width ?? 500;
        const height = boardTransform?.contentSize.height ?? 550;
        node.getComponent(UITransform)?.setContentSize(width, height);
        node.setPosition(board.position);
        node.setSiblingIndex(board.getSiblingIndex() + 1);
        this.artifactReveal = node;
    }

    private resetLevelVisuals() {
        this.ensureArtifactReveal();
        const board = this.boardManager?.node;
        if (!board) return;
        this.effects?.resetBoardVisual(board, this.artifactReveal);
    }

    private refreshArtifactReveal(level: number) {
        this.resetLevelVisuals();
        const node = this.artifactReveal;
        const board = this.boardManager?.node;
        if (!node || !board) return;

        const sprite = node.getChildByName('ArtifactImage')?.getComponent(Sprite);
        const info = ARTIFACTS[level];
        const token = ++this.artifactToken;
        if (!sprite || !info) {
            if (sprite) sprite.spriteFrame = null;
            return;
        }

        const boardTransform = board.getComponent(UITransform);
        const width = boardTransform?.contentSize.width ?? 500;
        const height = boardTransform?.contentSize.height ?? 550;
        resources.load(info.image + '/spriteFrame', SpriteFrame, (err, frame) => {
            if (err || !frame || token !== this.artifactToken || !isValid(node)) {
                if (err) {
                    console.warn('[GameManager] 文物图片加载失败', info.image, err);
                }
                return;
            }

            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            sprite.color = Color.WHITE;
            const source = frame.originalSize;
            const sourceWidth = source.width > 0 ? source.width : width;
            const sourceHeight = source.height > 0 ? source.height : height;
            const scale = Math.min(width / sourceWidth, height / sourceHeight);
            sprite.getComponent(UITransform)?.setContentSize(
                sourceWidth * scale,
                sourceHeight * scale
            );
        });
    }

    private presentLevelComplete(
        stars: number,
        level: number,
        newlyCollected: boolean
    ) {
        const token = ++this.finishToken;
        const showPanel = () => {
            if (!this.isValid || token !== this.finishToken) return;
            this.completePanel?.show(stars, level, newlyCollected);
            if (this.completePanel?.node) {
                this.effects?.playVictory(this.completePanel.node);
            }
        };

        const board = this.boardManager;
        const boardNode = board?.node ?? null;
        const artifact = this.artifactReveal;
        const cancelled = () => !this.isValid || token !== this.finishToken;
        void this.playCompletionShine(board, cancelled).then(() => {
            if (cancelled()) return;
            if (!this.effects || !boardNode || !artifact) {
                showPanel();
                return;
            }
            this.effects.playRestoration(boardNode, artifact, showPanel);
        });
    }

    /**
     * 完成闪耀期间锁住操作。关卡被切走时中途停下。
     * @param board 当前棋盘
     * @param cancelled 是否应该停止演出
     */
    private async playCompletionShine(
        board: BoardManager | null,
        cancelled: () => boolean
    ): Promise<void> {
        if (!board) return;
        this.isAnimating = true;
        try {
            await new GemCompletionShine().play(board, this.node.parent, cancelled);
        } finally {
            if (this.isValid) this.isAnimating = false;
        }
    }

    onDestroy() {
        if (this.boardManager?.isValid) {
            this.boardManager.onCellClicked = null;
        }

        if (this.trayManager?.isValid) {
            this.trayManager.onSlotClicked = null;
        }
    }
}
