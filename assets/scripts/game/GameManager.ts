
import {
    _decorator, Component, Label, Sprite, SpriteFrame,
    director, Node, Layers, Button, UITransform, Vec2,
    Graphics, Color, resources, isValid, UIOpacity, Mask, JsonAsset
} from 'cc';

import { PREVIEW } from 'cc/env';
import { loadTileSet } from './TileSprites';
import { BoardGesture } from './BoardGesture';
import { BoardManager } from './BoardManager';
import { TrayManager } from './TrayManager';
import { GemCell, GemColor } from './GemCell';
import { GemMoveAnimator, GemMove } from './GemMoveAnimator';
import { CompletePanelUI } from '../ui/CompletePanelUI';
import { LevelManager, LevelData } from '../core/LevelManager';
import { AudioManager } from '../core/AudioManager'
import { LevelSession, MAX_LEVEL } from '../core/LevelSession';
import { ArtifactCollectionManager, ARTIFACTS } from '../core/ArtifactCollectionManager';
import { ArtifactCollectionUI } from '../ui/ArtifactCollectionUI';
import { ToolsBarUI } from '../ui/ToolsBarUI';
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
import { configureGemPalette, gemDrawSize } from './GemVisuals';
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
    private settingsPanel: SettingsPanel | null = null;
    private boardGesture: BoardGesture | null = null;
    private toolsNode: Node | null = null;
    /** 托盘最底边（含绿色按钮）离屏幕底边留出的位置。 */
    private readonly trayBottomY = -600;
    private hintEffect: HintEffect | null = null;
    private magnetManager: MagnetManager | null = null;
    private magnetRunning = false;
    private magnetLocked = 0;
    private tutorial: TutorialManager | null = null;
    private tutorialRunning = false;
    private artifactReveal: Node | null = null;
    private finishToken = 0;
    private artifactToken = 0;
    private targetRegions: GemCell[][] = [];
    private flashedRegions = new Set<GemCell[]>();
    private grantedColors = new Set<GemColor>();
    private regionShines: Promise<void>[] = [];

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

    private redirectedHome = false;

    private currentLevelData: LevelData | null = null;
    @property(AudioManager)
audioManager: AudioManager | null = null;


onLoad() {
    if (!LevelSession.takeGameEntry() && this.readPreviewLevel() === 0) {
        this.redirectedHome = true;
        this.hideGameUntilHome();
        director.loadScene('MainMenu');
        return;
    }

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

    /** 刷新直接回首页时，先把游戏画面藏起来，避免弹窗闪一帧。 */
    private hideGameUntilHome() {
        const canvas = this.node.parent;
        if (!canvas) return;
        const opacity = canvas.getComponent(UIOpacity) ?? canvas.addComponent(UIOpacity);
        opacity.opacity = 0;
        for (const child of canvas.children) {
            if (child.getComponent(SettingsPanel) || child.getComponent(CompletePanelUI)) {
                child.active = false;
            }
        }
    }

    /**
     * 绑定局内设置面板。齿轮按钮在底部道具栏里。
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
            this.settingsPanel = settings;
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

    }

    /**
     * 左上角齿轮，打开设置。
     */
    private ensureSettingsButton() {
        const canvas = this.node.parent;
        if (!canvas || canvas.getChildByName('GearButton')) return;
        const node = new Node('GearButton');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.setPosition(-278, 559, 0);
        node.addComponent(UITransform).setContentSize(77, 77);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('ui/game/btn_gea/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !isValid(node)) {
                if (error) console.error('[Game] 加载 ui/game/btn_gea/spriteFrame 失败', error);
                return;
            }
            sprite.spriteFrame = frame;
        });
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, () => {
            const settings = this.settingsPanel;
            if (!settings) return;
            settings.node.setSiblingIndex((settings.node.parent?.children.length ?? 1) - 1);
            settings.openPanel();
        }, this);
    }

    /**
     * 用游戏页背景替换场景里原来的底图。
     */
    private ensureGameBackground() {
        const background = this.node.parent?.getChildByName('Background');
        if (!background) return;
        const sprite = background.getComponent(Sprite) ?? background.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = Color.WHITE;
        background.getComponent(UITransform)?.setContentSize(720, 1280);
        resources.load('ui/game/bg_scene/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !isValid(background)) {
                if (error) console.error('[Game] 加载 ui/game/bg_scene/spriteFrame 失败', error);
                return;
            }
            sprite.spriteFrame = frame;
        });
    }

    /**
     * 测试用。点一下进入下一关，第 6 关之后回到第 1 关。
     */
    private ensureSkipButton() {
        const canvas = this.node.parent;
        if (!canvas || canvas.getChildByName('SkipLevelButton')) return;

        const node = new Node('SkipLevelButton');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.setPosition(250, 470, 0);
        node.addComponent(UITransform).setContentSize(128, 48);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(255, 186, 46, 255);
        graphics.roundRect(-64, -24, 128, 48, 16);
        graphics.fill();

        const labelNode = new Node('Label');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = node;
        labelNode.addComponent(UITransform).setContentSize(112, 36);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = '下一关';
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
            const current = this.levelManager?.getCurrentLevel() ?? 1;
            const next = current >= MAX_LEVEL ? 1 : current + 1;
            this.openLevel(next, true);
        }, this);
    }

    /**
     * 齿轮按钮显示存档里的等级，和主页开始按钮一致。
     */
    private refreshRankLabel() {
        const level = LevelSession.getProgress().lastPlayedLevel;
        this.toolsBar?.setRankLabel(localize(`等级 ${level}`, `Level ${level}`));
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

    /**
     * 托盘底边靠近屏幕底部，留出一条缝。行数变了也只往上长。
     */
    private placeTrayAboveTools() {
        const tray = this.trayManager;
        if (!tray?.isValid) return;
        const shelfBottom = tray.getShelfBottom();
        if (shelfBottom === null) return;
        tray.node.setPosition(0, this.trayBottomY - shelfBottom, 0);
        const canvas = this.node.parent;
        const viewport = canvas?.getChildByName('BoardViewport');
        if (canvas && viewport) this.raiseChromeAboveBoard(canvas, viewport);
    }

    /**
     * 遮罩铺满可见屏幕。锚点留在画布原点，棋盘本地坐标不用改。
     */
    private layoutBoardViewport(viewport: Node) {
        const area = viewport.getComponent(UITransform);
        if (!area) return;
        viewport.setPosition(0, 0, 0);
        area.setContentSize(720, 1280);
        area.setAnchorPoint(0.5, 0.5);
    }

    /**
     * 托盘、道具、顶部按钮和关卡信息盖在棋盘上面。
     */
    private raiseChromeAboveBoard(canvas: Node, viewport: Node) {
        const chrome = [
            this.levelLabel?.node,
            canvas.getChildByName('GearButton'),
            canvas.getChildByName('TrayContainer')
        ];
        let anchor = viewport;
        for (const node of chrome) {
            if (!node?.isValid || node.parent !== canvas) continue;
            const anchorIndex = anchor.getSiblingIndex();
            const nodeIndex = node.getSiblingIndex();
            node.setSiblingIndex(nodeIndex < anchorIndex ? anchorIndex : anchorIndex + 1);
            anchor = node;
        }
    }

    /**
     * 点在托盘、道具或顶部按钮上时，不把它当成棋盘手势。
     */
    private installViewportHitTest(area: UITransform) {
        const original = area.hitTest.bind(area);
        const chrome = ['LevelLabel', 'GearButton', 'TrayContainer'];
        area.hitTest = (screenPoint: Vec2, windowId = 0) => {
            if (!original(screenPoint, windowId)) return false;
            const canvas = area.node.parent;
            if (!canvas) return true;
            for (const name of chrome) {
                const node = canvas.getChildByName(name);
                if (!node?.activeInHierarchy) continue;
                const ui = node.getComponent(UITransform);
                if (ui?.hitTest(screenPoint, windowId)) return false;
            }
            return true;
        };
    }


    /** 预览地址里的 preview-level。没有时是 0。 */
    private readPreviewLevel(): number {
        if (!PREVIEW || typeof location === 'undefined') return 0;
        const requested = Number(new URLSearchParams(location.search).get('preview-level'));
        if (Number.isInteger(requested) && requested >= 1 && requested <= MAX_LEVEL) return requested;
        return 0;
    }

    start() {
        if (this.redirectedHome) return;
        // 地址带 preview-level 时才指定关卡。否则预览和正式包都按存档进入下一关。
        const requested = this.readPreviewLevel();
        if (requested > 0) this.debugStartLevel = requested;

        if (this.boardManager) {
            this.boardManager.node.active = true;
        }
        if (this.trayManager) {
            this.trayManager.node.active = true;
        }
        if (this.levelLabel) {
            this.levelLabel.node.active = false;
        }

        this.ensureGameBackground();
        this.ensureSettingsButton();

        // Leave a clear gap above the multi-row shelf, even for tall pixel art.
        this.boardManager?.node.setPosition(0, 100, 0);
        const boardNode = this.boardManager?.node;
        if (boardNode) {
            const canvas = this.node.parent ?? boardNode.parent!;
            let viewport = canvas.getChildByName('BoardViewport');
            if (!viewport) {
                const index = boardNode.getSiblingIndex();
                viewport = new Node('BoardViewport');
                viewport.layer = boardNode.layer;
                viewport.parent = canvas;
                viewport.setSiblingIndex(index);
                viewport.addComponent(UITransform);
                viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
            }
            const area = viewport.getComponent(UITransform)!;
            this.layoutBoardViewport(viewport);
            this.installViewportHitTest(area);
            this.raiseChromeAboveBoard(canvas, viewport);
            boardNode.parent = viewport;
            this.boardGesture = boardNode.getComponent(BoardGesture) ?? boardNode.addComponent(BoardGesture);
            this.boardGesture.setViewport(viewport);
            this.boardGesture.canInteract = () => !this.isAnimating && !this.finished && !this.isSettingsOpen();
            this.boardGesture.rememberRest();
        }
        if (this.trayManager) {
            this.trayManager.onShelfResized = () => this.placeTrayAboveTools();
            this.trayManager.canWatchAd = () => !this.isAnimating && !this.finished && !this.isSettingsOpen() && !this.magnetRunning;
        }
        const tools = this.node.parent?.getChildByName('ToolsContainer');
        if (tools) {
            this.toolsNode = tools;
            tools.active = false;
        }
        this.ensureHintEffect();
        this.ensureMagnetManager();

        this.ensureEffects();
        this.ensureArtifactReveal();

        const level = this.debugStartLevel > 0
            ? this.debugStartLevel
            : LevelSession.consumeStartLevel();

        console.log(`[DEBUG] 启动关卡：LEVEL ${level}`);
        this.levelManager?.unlockThrough(level);
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

    /**
     * 飞走的棋子退出这一组。还留在棋盘上的继续抬着，方便接着放进下一块同色空位。
     */
    private holdRemainingBoard(moved: GemCell[]): boolean {
        const gone = new Set(moved);
        for (const cell of moved) {
            if (cell?.isValid) cell.releaseOutline();
        }

        const staying = this.selectedGroup.filter(cell =>
            cell?.isValid && !gone.has(cell) && cell.canMove()
        );
        this.selectedGroup = staying;
        const selection = this.selected;
        if (staying.length === 0 || selection?.type !== 'board') {
            this.selected = null;
            if (this.trayManager?.isValid) this.trayManager.setSelectedIndex(-1);
            return false;
        }

        const anchor = selection.cell;
        if (!anchor.isValid || gone.has(anchor) || !anchor.canMove()) {
            this.selected = { type: 'board', cell: staying[0] };
        }
        return true;
    }

    /**
     * 托盘里这一色还没放完时，靠左排好后继续弹起。
     */
    private holdRemainingTray(color: GemColor) {
        const tray = this.trayManager;
        if (!tray?.isValid) {
            this.clearSelection();
            return;
        }

        const indices: number[] = [];
        for (let slot = 0; tray.getSlotNode(slot); slot++) {
            if (tray.getGemAt(slot) === color) indices.push(slot);
        }
        if (indices.length === 0 || this.selected?.type !== 'tray') {
            this.clearSelection();
            return;
        }

        this.selected = { type: 'tray', index: indices[0] };
        tray.setLiftedSlots(indices);
    }

    private selectBoard(cell: GemCell) {
        this.clearSelection();

        if (!cell.canMove() || !cell.currentColor) return;

        this.selected = { type: 'board', cell };
        this.selectedGroup = this.getSameColorMovableCells(cell);

        for (const item of this.selectedGroup) {
            item.setSelected(true);
        }
        // 从上往下画。下面的棋子抬起来会伸进上面那格的底板，底板必须画在棋子前面。
        const stacked = [...this.selectedGroup].sort((a, b) => a.row - b.row || a.col - b.col);
        for (const item of stacked) {
            if (item.node.parent) {
                item.node.setSiblingIndex(item.node.parent.children.length - 1);
            }
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

        // 只能放进同色空位。点到另一组棋子，改成拿起那一组，不能两边对调。
        const heldColor = selection.cell.currentColor;
        if (heldColor && cell.currentColor === null && cell.targetColor === heldColor) {
            this.exchangeWithTargetGroup(cell);
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

        await this.runMoves([{
            frame,
            from: source.gemSprite?.node ?? source.node,
            to: dest.node,
            endSize: gemDrawSize(color, dest.getDisplaySize()),
            onArrive: () => {
                source.setCurrentColor(null);
                dest.setCurrentColor(color);
                this.settleLandedGem(dest);
            }
        }], [source, dest], false, () => this.hideMovedGems([source]));
        return dest.isCorrect() ? 1 : 0;
    }

    private async swapOnePair(source: GemCell, dest: GemCell): Promise<number> {
        const colorA = source.currentColor;
        const colorB = dest.currentColor;
        const frameA = source.gemSprite?.spriteFrame;
        const frameB = dest.gemSprite?.spriteFrame;
        if (!colorA || !colorB || !frameA || !frameB) return 0;
        if (source.targetColor !== colorB || dest.targetColor !== colorA) return 0;

        await this.runMoves([
            {
                frame: frameA,
                from: source.gemSprite?.node ?? source.node,
                to: dest.node,
                endSize: gemDrawSize(colorA, dest.getDisplaySize()),
                onArrive: () => {
                    dest.setCurrentColor(colorA);
                    this.settleLandedGem(dest);
                }
            },
            {
                frame: frameB,
                from: dest.gemSprite?.node ?? dest.node,
                to: source.node,
                endSize: gemDrawSize(colorB, source.getDisplaySize()),
                onArrive: () => {
                    source.setCurrentColor(colorB);
                    this.settleLandedGem(source);
                }
            }
        ], [source, dest], false, () => this.hideMovedGems([source, dest]));
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

        await this.runMoves([{
            frame,
            from: sourceGem,
            to: dest.node,
            endSize: gemDrawSize(color, dest.getDisplaySize()),
            onArrive: () => {
                tray.setGemAt(slot, null);
                dest.setCurrentColor(color);
                this.settleLandedGem(dest);
            }
        }], [dest], false, () => {
            sourceGem.active = false;
        });
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
                startSize: this.wandGemSize(from, color),
                endSize: this.wandGemSize(to, color)
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
            this.flashCompletedRegions();
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

    private wandGemSize(source: WandSource, color: GemColor): number {
        switch (source.kind) {
            case 'cell': return gemDrawSize(color, source.cell.getDisplaySize());
            case 'tray': return this.trayManager?.getGemSize() ?? 44;
            default: {
                const unknown: never = source;
                return unknown;
            }
        }
    }

    // 和点中的那颗八个方向相连、还没归位的同色棋子。斜角也算，能连上就继续找。点中的那颗排在最前。
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
            for (const neighbor of this.adjacentCells(cell)) pending.push(neighbor);
        }

        group.sort((a, b) => {
            if (a === origin) return -1;
            if (b === origin) return 1;
            const da = Math.abs(a.row - origin.row) + Math.abs(a.col - origin.col);
            const db = Math.abs(b.row - origin.row) + Math.abs(b.col - origin.col);
            return da - db || a.row - b.row || a.col - b.col;
        });
        return group;
    }

    // 从点中的空格出发，八个方向连在一起的同色空格都收进来。斜角也算。
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
            for (const neighbor of this.adjacentCells(cell)) pending.push(neighbor);
        }

        group.sort((a, b) => {
            if (a === origin) return -1;
            if (b === origin) return 1;
            const da = Math.abs(a.row - origin.row) + Math.abs(a.col - origin.col);
            const db = Math.abs(b.row - origin.row) + Math.abs(b.col - origin.col);
            return da - db || a.row - b.row || a.col - b.col;
        });
        return group;
    }

    /** 上下左右和四个斜角。没有格子的位置跳过。 */
    private adjacentCells(cell: GemCell): GemCell[] {
        const board = this.boardManager;
        if (!board) return [];
        const found: GemCell[] = [];
        for (const row of [cell.row - 1, cell.row, cell.row + 1]) {
            for (const col of [cell.col - 1, cell.col, cell.col + 1]) {
                if (row === cell.row && col === cell.col) continue;
                const neighbor = board.getCell(row, col);
                if (neighbor) found.push(neighbor);
            }
        }
        return found;
    }

    // 选中的同色棋子落到托盘里同色的后面。空槽不够时，先拿走点中的那颗，其余留在原位。
    private takeSameColorToTray(origin: GemCell): boolean {
        const tray = this.trayManager;
        const color = origin.currentColor;
        if (!tray || !color || !origin.canMove() || this.isAnimating) {
            return false;
        }

        const room = tray.getEmptyIndices().length;
        const cells = this.selectedGroup.length > 0
            ? [...this.selectedGroup]
            : this.getSameColorMovableCells(origin);

        if (room === 0) {
            this.showFloatingTip('HintTip', localize('托盘已满，先把棋子放回同色空位', 'Shelf full — place gems on matching empty tiles'));
            return false;
        }

        const batchCells: GemCell[] = [];
        for (const cell of cells) {
            if (batchCells.length >= room) break;
            if (!cell.currentColor || !cell.gemSprite?.node) continue;
            batchCells.push(cell);
        }
        const reserved = batchCells.length > 0
            ? tray.reserveSameColorSlots(color, batchCells.length)
            : [];
        const batch: { cell: GemCell; color: GemColor; slot: number }[] = [];
        for (let index = 0; index < batchCells.length && index < reserved.length; index++) {
            const slot = reserved[index];
            if (!tray.getSlotNode(slot)) continue;
            batch.push({ cell: batchCells[index], color, slot });
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

        const moves: GemMove[] = [];
        batch.forEach((item) => {
            const slotNode = tray.getSlotNode(item.slot);
            const gemNode = item.cell.gemSprite?.node;
            if (!slotNode || !gemNode) return;
            moves.push({
                frame: item.cell.gemSprite?.spriteFrame ?? null,
                from: gemNode,
                to: slotNode,
                startSize: Math.round(gemDrawSize(item.color, item.cell.getDisplaySize())),
                endSize: tray.getGemSize(),
                delay: moves.length * 0.08,
                sequential: true,
                onDepart: () => {
                    item.cell.releaseOutline();
                    item.cell.setCurrentColor(null);
                },
                onArrive: () => {
                    tray.setGemAt(item.slot, item.color);
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
        const flying = new Set(batch.map(item => item.cell));
        for (const cell of this.selectedGroup) {
            if (cell?.isValid && !flying.has(cell)) cell.setSelected(false);
        }
        this.selectedGroup = [];
        this.selected = null;

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

        this.isAnimating = true;

        const moves: GemMove[] = [
            {
                frame: frameA,
                from: source.gemSprite?.node ?? source.node,
                to: target.node
            }
        ];

        if (colorB && frameB) {
            moves.push({
                frame: frameB,
                from: target.gemSprite?.node ?? target.node,
                to: source.node
            });
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

        if (source.gemSprite) source.gemSprite.node.active = false;
        if (colorB && target.gemSprite) target.gemSprite.node.active = false;
        this.clearSelection();
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
                from: pair.source.gemSprite?.node ?? pair.source.node,
                to: pair.dest.node,
                endSize: gemDrawSize(sourceColor, pair.dest.getDisplaySize()),
                delay: index * 0.07,
                onDepart: () => pair.source.setCurrentColor(null),
                onArrive: () => {
                    pair.dest.setCurrentColor(sourceColor);
                    this.settleLandedGem(pair.dest);
                }
            });
        }

        const keep = this.holdRemainingBoard(pairs.map(pair => pair.source));
        const changed = pairs.reduce<GemCell[]>((all, pair) => all.concat(pair.source, pair.dest), []);
        void this.runMoves(moves, changed, keep);
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
            if (!slotNode || !sourceGem || !sourceFrame) return;
            moves.push({
                frame: sourceFrame,
                from: sourceGem,
                to: pair.dest.node,
                endSize: gemDrawSize(color, pair.dest.getDisplaySize()),
                delay: index * 0.07,
                onDepart: () => tray.setGemAt(pair.slot, null),
                onArrive: () => {
                    pair.dest.setCurrentColor(color);
                    this.settleLandedGem(pair.dest);
                }
            });
        }

        void this.runMoves(moves, pairs.map(pair => pair.dest), true).then(async () => {
            if (!this.isValid || this.finished) return;
            this.isAnimating = true;
            await tray.compact();
            if (!this.isValid) return;
            this.holdRemainingTray(color);
            this.isAnimating = false;
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
        this.flashCompletedRegions();
    }

    private flashCompletedRegions(): void {
        const token = this.finishToken;
        for (const region of this.targetRegions) {
            if (this.flashedRegions.has(region) || !region.every(cell => cell.isValid && cell.isCorrect())) continue;
            this.flashedRegions.add(region);
            const task = new GemCompletionShine().playRegion(region,
                () => !this.isValid || token !== this.finishToken);
            this.regionShines.push(task);
        }
        const finished = this.colorsFullyPlaced();
        let granted = 0;
        for (const color of finished) {
            if (this.grantedColors.has(color)) continue;
            this.grantedColors.add(color);
            granted += 1;
        }
        if (granted > 0) this.trayManager?.grantRows(granted);
    }

    /** 整张图里已经全部归位的目标颜色。 */
    private colorsFullyPlaced(): GemColor[] {
        const board = this.boardManager;
        if (!board) return [];
        const pending = new Set<GemColor>();
        const seen = new Set<GemColor>();
        for (const cell of board.getCells()) {
            const color = cell.targetColor;
            if (!color) continue;
            seen.add(color);
            if (!cell.isValid || !cell.isCorrect()) pending.add(color);
        }
        const finished: GemColor[] = [];
        for (const color of seen) {
            if (!pending.has(color)) finished.push(color);
        }
        return finished;
    }

    private runMoves(
        moves: GemMove[],
        changed: GemCell[],
        keepSelection = false,
        conceal?: () => void
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
            if (!this.moveAnimator || moves.length === 0) {
                if (!keepSelection) this.clearSelection();
                for (const move of moves) { move.onDepart?.(); move.onArrive?.(); }
                finish();
                return;
            }

            this.isAnimating = true;
            this.moveAnimator.play(moves, finish);
            conceal?.();
            if (!keepSelection) this.clearSelection();
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

    private openLevel(level: number, ignoreUnlock = false) {
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
            !ignoreUnlock &&
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
            configureGemPalette(data.palette);

            if (this.debugStartLevel === 0) {
                this.levelManager?.setLastPlayedLevel(data.id);
            }

            this.boardGesture?.resetView();
            const trayReady = this.trayManager!.resetTray(12);
            const steps = readTutorialSteps(data.tutorialSteps);
            this.tutorial?.stop();
            this.tutorial = null;
            this.tutorialRunning = false;
            this.boardManager!.loadLevel(
                data.target,
                data.initialSwaps,
                data.initial,
                () => {
                    if (!this.isValid) return;
                    this.targetRegions = this.boardManager!.getTargetRegions();
                    this.flashedRegions = new Set(this.targetRegions.filter(region => region.every(cell => cell.isCorrect())));
                    this.grantedColors = new Set(this.colorsFullyPlaced());
                    this.regionShines = [];
                    void trayReady.then(() => { if (this.isValid) this.finished = false; });
                    if (steps.length === 0) return;
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
            this.finished = true;
            this.setWandMode(false);
            this.isAnimating = false;
            this.moveCount = 0;
            this.audioManager?.playBGM();

            if (this.levelLabel) {
                this.levelLabel.string = `LEVEL ${data.id}`;
            }
            this.refreshRankLabel();
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
        if (next > MAX_LEVEL) return;
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
        this.boardGesture?.resetView();
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
            if (level < MAX_LEVEL) {
                this.levelManager.setLastPlayedLevel(level + 1);
            }
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
        node.setSiblingIndex((board.parent?.name === 'BoardViewport' ? board.parent.getSiblingIndex() : board.getSiblingIndex()) + 1);
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
        _stars: number,
        level: number,
        _newlyCollected: boolean
    ) {
        const token = ++this.finishToken;
        const board = this.boardManager;
        const cancelled = () => !this.isValid || token !== this.finishToken;
        const ready = this.preloadHome(level);
        void this.playCompletionShine(board, cancelled).then(async () => {
            if (cancelled()) return;
            LevelSession.rememberCompletedLevel(level);
            await ready;
            if (cancelled()) return;
            const canvas = this.node.parent;
            await new GemCompletionShine().playConfetti(canvas, cancelled);
            if (cancelled()) return;
            director.loadScene('MainMenu');
        });
    }

    /** 闪耀期间把主页场景和图片先读进内存，切场景时不再卡顿。 */
    private preloadHome(level: number): Promise<void> {
        const paths = [
            'ui/game/bg_scene/spriteFrame',
            'ui/home/logo_jewel_puzzle/spriteFrame',
            'ui/home/frame_showcase/spriteFrame',
            'ui/home/btn_start/spriteFrame',
            'ui/home/btn_collection/spriteFrame',
            'ui/home/icon_temple/spriteFrame',
            'ui/game/btn_gea/spriteFrame'
        ];
        const artwork = ARTIFACTS[level]?.image;
        const extras: Promise<void>[] = [];
        if (artwork) {
            paths.push(artwork + '/spriteFrame');
        } else {
            const text = level < 10 ? `0${level}` : `${level}`;
            extras.push(this.preloadJson(`levels/level_${text}`));
            extras.push(loadTileSet().then(() => undefined));
        }
        return Promise.all([
            this.preloadScene('MainMenu'),
            ...paths.map(path => this.preloadSprite(path)),
            ...extras
        ]).then(() => undefined);
    }

    private preloadScene(name: string): Promise<void> {
        return new Promise(resolve => director.preloadScene(name, () => resolve()));
    }

    private preloadSprite(path: string): Promise<void> {
        return new Promise(resolve => resources.preload(path, SpriteFrame, () => resolve()));
    }

    private preloadJson(path: string): Promise<void> {
        return new Promise(resolve => resources.preload(path, JsonAsset, () => resolve()));
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
            await Promise.all(this.regionShines);
            if (!cancelled()) await new GemCompletionShine().play(board, this.node.parent, cancelled);
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
