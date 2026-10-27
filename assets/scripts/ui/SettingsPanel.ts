
import {
    _decorator,
    Component,
    Node,
    Label,
    Button,
    UITransform,
    Graphics,
    Color,
    Layers,
    BlockInputEvents
} from 'cc';

import { GameSettings } from '../core/GameSettings';
import { AudioManager } from '../core/AudioManager';
import { localize } from '../core/Locale';

const { ccclass, property } = _decorator;

@ccclass('SettingsPanel')
export class SettingsPanel extends Component {

    @property(AudioManager)
    audioManager: AudioManager | null = null;

    // 音效开关
    @property(Node)
    soundToggle: Node | null = null;

    // 音乐开关
    @property(Node)
    musicToggle: Node | null = null;

    // 振动开关
    @property(Node)
    vibrationToggle: Node | null = null;

    // 状态文字
    @property(Label)
    soundLabel: Label | null = null;

    @property(Label)
    musicLabel: Label | null = null;

    @property(Label)
    vibrationLabel: Label | null = null;

    public onHome: (() => void) | null = null;
    public onReplay: (() => void) | null = null;
    public onSave: (() => void) | null = null;

    private actionsBuilt = false;

    onLoad() {
        this.ensureActions();
    }

    onEnable() {
        this.refreshUI();
    }

    /**
     * 打开设置面板
     */
    public openPanel() {
        this.ensureActions();
        this.node.active = true;
        this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1);
        this.refreshUI();
    }

    /**
     * 关闭设置面板
     */
    public closePanel() {
        this.audioManager?.playClick();
        this.node.active = false;
    }

    /**
     * 切换音效
     */
    public toggleSound() {
        const enabled = !GameSettings.isSoundEnabled();

        if (this.audioManager) {
            this.audioManager.setSoundEnabled(enabled);
        } else {
            GameSettings.setSoundEnabled(enabled);
        }

        this.refreshUI();
        this.audioManager?.playClick();
    }

    /**
     * 切换背景音乐
     */
    public toggleMusic() {
        const enabled = !GameSettings.isMusicEnabled();

        if (this.audioManager) {
            this.audioManager.setMusicEnabled(enabled);
        } else {
            GameSettings.setMusicEnabled(enabled);
        }

        this.refreshUI();
        this.audioManager?.playClick();
    }

    /**
     * 切换振动设置
     */
    public toggleVibration() {
        const enabled = !GameSettings.isVibrationEnabled();

        GameSettings.setVibrationEnabled(enabled);

        this.refreshUI();
        this.audioManager?.playClick();
    }

    /**
     * 根据保存的设置刷新开/关
     */
    public refreshUI() {
        const settings = GameSettings.load();

        const on = localize('开', 'On');
        const off = localize('关', 'Off');

        if (this.soundLabel) {
            this.soundLabel.string = settings.soundEnabled ? on : off;
        }

        if (this.musicLabel) {
            this.musicLabel.string = settings.musicEnabled ? on : off;
        }

        if (this.vibrationLabel) {
            this.vibrationLabel.string = settings.vibrationEnabled ? on : off;
        }

        this.setRowTitle(this.soundToggle, localize('音效', 'Sound'));
        this.setRowTitle(this.vibrationToggle, localize('振动', 'Vibration'));
        this.setRowTitle(this.musicToggle, localize('音乐', 'Music'));

        const title = this.node.getChildByName('PopupCard')
            ?.getChildByName('Header')
            ?.getChildByName('Title')
            ?.getComponent(Label);
        if (title) title.string = localize('暂停', 'Pause');
    }

    /**
     * 把开关所在那一行的名称改成当前语言。
     * @param toggle 这一行的开关节点
     * @param text 行名称
     */
    private setRowTitle(toggle: Node | null, text: string): void {
        const row = toggle?.parent;
        if (!row) return;
        for (const child of row.children) {
            if (child === toggle) continue;
            const label = child.getComponent(Label) ?? child.getComponentInChildren(Label);
            if (!label) continue;
            label.string = text;
            return;
        }
    }

    /**
     * 保存进度、主页、重玩。用文字按钮，避免改预制体后被编辑器清掉。
     */
    private ensureActions() {
        if (this.actionsBuilt || this.node.getChildByName('SettingsActions')) {
            this.actionsBuilt = true;
            return;
        }
        this.actionsBuilt = true;

        const dim = this.node.getChildByName('DimBackground');
        if (dim && !dim.getComponent(BlockInputEvents)) {
            dim.addComponent(BlockInputEvents);
        }

        const root = new Node('SettingsActions');
        root.layer = Layers.Enum.UI_2D;
        root.parent = this.node.getChildByName('PopupCard') ?? this.node;
        root.setPosition(0, -218, 0);

        this.makeTextButton(root, localize('保存进度', 'Save'), 0, 0, 360, 52, new Color(108, 72, 196, 255), () => {
            this.onSave?.();
            this.audioManager?.playClick();
        });
        this.makeTextButton(root, localize('主页', 'Home'), -100, -62, 168, 52, new Color(196, 72, 84, 255), () => {
            this.onHome?.();
        });
        this.makeTextButton(root, localize('重玩', 'Replay'), 100, -62, 168, 52, new Color(72, 168, 96, 255), () => {
            this.onReplay?.();
        });
    }

    private makeTextButton(
        parent: Node,
        title: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fill: Color,
        onClick: () => void
    ) {
        const node = new Node(title);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = fill;
        graphics.roundRect(-width / 2, -height / 2, width, height, 12);
        graphics.fill();

        const labelNode = new Node('Label');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = node;
        labelNode.addComponent(UITransform).setContentSize(width - 12, height - 8);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = title;
        label.fontSize = 22;
        label.lineHeight = 28;
        label.isBold = true;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.04;
        node.on(Button.EventType.CLICK, onClick, this);
    }

}
