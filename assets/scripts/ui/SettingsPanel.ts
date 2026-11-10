import {
    _decorator,
    BlockInputEvents,
    Button,
    Color,
    Component,
    Graphics,
    isValid,
    Label,
    Layers,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    UITransform
} from 'cc';

import { GameSettings } from '../core/GameSettings';
import { AudioManager } from '../core/AudioManager';
import { localize } from '../core/Locale';

const { ccclass, property } = _decorator;

const BROWN = new Color(122, 72, 36, 255);

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

    private pauseBuilt = false;
    private dimCloses = false;
    private pauseTitle: Label | null = null;
    private saveTitle: Label | null = null;
    private homeTitle: Label | null = null;
    private replayTitle: Label | null = null;

    onLoad() {
        this.ensurePause();
    }

    onEnable() {
        this.refreshUI();
    }

    /**
     * 打开设置面板
     */
    public openPanel() {
        this.ensurePause();
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

    /** 点到弹窗以外的遮罩时关闭。卡片和按钮在遮罩上面，不会走到这里。 */
    private closeFromDim() {
        this.closePanel();
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

        if (this.pauseTitle) this.pauseTitle.string = localize('暂停', 'Pause');
        if (this.saveTitle) this.saveTitle.string = localize('保存进度', 'Save Your Progress');
        if (this.homeTitle) this.homeTitle.string = localize('主页', 'Home');
        if (this.replayTitle) this.replayTitle.string = localize('重玩', 'Replay');

        this.setToggleIcon('ToggleMusic', settings.musicEnabled);
        this.setToggleIcon('ToggleSound', settings.soundEnabled);
    }

    /**
     * 用切图搭暂停弹窗。旧预制体卡片藏起来，避免改场景后被编辑器清掉。
     */
    private ensurePause() {
        const legacy = this.node.getChildByName('PopupCard');
        if (legacy) legacy.active = false;

        const dim = this.node.getChildByName('DimBackground');
        if (dim) {
            if (!dim.getComponent(BlockInputEvents)) {
                dim.addComponent(BlockInputEvents);
            }
            const sprite = dim.getComponent(Sprite);
            if (sprite) sprite.enabled = false;
            dim.getComponent(Graphics)?.destroy();
            dim.setSiblingIndex(0);

            // 图片节点上再画矩形不会显示。遮罩单独放一个只有绘图的节点，并大于屏幕，四角不透。
            const width = 1080;
            const height = 1920;
            dim.getComponent(UITransform)?.setContentSize(width, height);
            let shade = dim.getChildByName('DimShade');
            if (!shade) {
                shade = new Node('DimShade');
                shade.layer = Layers.Enum.UI_2D;
                shade.parent = dim;
                shade.addComponent(UITransform);
                shade.addComponent(Graphics);
            }
            const shadeTransform = shade.getComponent(UITransform);
            if (shadeTransform) {
                shadeTransform.setContentSize(width, height);
                shadeTransform.hitTest = () => false;
            }
            const graphics = shade.getComponent(Graphics);
            if (graphics) {
                graphics.clear();
                graphics.fillColor = new Color(0, 0, 0, 130);
                graphics.rect(-width / 2, -height / 2, width, height);
                graphics.fill();
            }
            if (!this.dimCloses) {
                this.dimCloses = true;
                dim.on(Node.EventType.TOUCH_END, this.closeFromDim, this);
            }
        }

        if (this.pauseBuilt || this.node.getChildByName('PauseRoot')) {
            this.pauseBuilt = true;
            return;
        }
        this.pauseBuilt = true;

        const root = new Node('PauseRoot');
        root.layer = Layers.Enum.UI_2D;
        root.parent = this.node;

        const panel = this.addSprite(root, 'Panel', 'ui/pause/panel_pause/spriteFrame', 0, -38, 605, 482);
        panel.addComponent(BlockInputEvents);

        const title = this.addSprite(
            root, 'TitleFrame', 'ui/pause/frame_pause_title/spriteFrame', 0, 210, 292, 132
        );
        const titleSprite = title.getComponent(Sprite);
        if (titleSprite) titleSprite.trim = false;
        this.pauseTitle = this.addLabel(title, 'Title', 220, 56, 42, BROWN, 0, -5);

        this.addToggle(root, 'ToggleMusic', 'ui/pause/btn_music/spriteFrame', -167, 21, () => this.toggleMusic());
        this.addToggle(root, 'ToggleVibration', 'ui/pause/btn_vibration/spriteFrame', 0, 21, () => this.toggleVibration());
        this.addToggle(root, 'ToggleSound', 'ui/pause/btn_sound/spriteFrame', 167, 21, () => this.toggleSound());

        this.homeTitle = this.addAction(
            root, 'HomeButton', 'ui/pause/btn_home/spriteFrame', -138, -120, BROWN, () => this.onHome?.()
        );
        this.replayTitle = this.addAction(
            root, 'ReplayButton', 'ui/pause/btn_replay/spriteFrame', 138, -120, Color.WHITE, () => this.onReplay?.()
        );

        this.addClose(root);
    }

    /**
     * 打开用没有斜杠的图标，关闭换成带斜杠的。两个弹窗同一套图。
     * @param name 开关节点名
     * @param enabled 是否打开
     */
    private setToggleIcon(name: 'ToggleMusic' | 'ToggleSound', enabled: boolean): void {
        const sprite = this.node.getChildByName('PauseRoot')
            ?.getChildByName(name)
            ?.getComponent(Sprite);
        if (!sprite) return;
        const path = this.toggleFrame(name, enabled);
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !sprite.isValid) {
                if (error) console.error(`[Settings] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
        });
    }

    /**
     * 音乐、音效的开和关对应哪张图。
     * @param name 开关节点名
     * @param enabled 是否打开
     */
    private toggleFrame(name: 'ToggleMusic' | 'ToggleSound', enabled: boolean): string {
        switch (name) {
            case 'ToggleMusic':
                return enabled
                    ? 'ui/pause/btn_music/spriteFrame'
                    : 'ui/settings/home/icon_music_off/spriteFrame';
            case 'ToggleSound':
                return enabled
                    ? 'ui/pause/btn_sound/spriteFrame'
                    : 'ui/settings/home/icon_sound_off/spriteFrame';
            default: {
                const unexpected: never = name;
                return unexpected;
            }
        }
    }

    /**
     * 关闭钮在卡片右上角，标题牌右侧那块空位。
     * @param parent 弹窗根节点
     */
    private addClose(parent: Node) {
        const node = this.addSprite(
            parent, 'CloseButton', 'ui/pause/btn_close/spriteFrame', 266, 192, 64, 64
        );
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, () => this.closePanel(), this);
    }

    private addToggle(parent: Node, name: string, path: string, x: number, y: number, onClick: () => void) {
        const node = this.addSprite(parent, name, path, x, y, 119, 111);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.05;
        node.on(Button.EventType.CLICK, onClick, this);
    }

    private addAction(
        parent: Node,
        name: string,
        path: string,
        x: number,
        y: number,
        color: Color,
        onClick: () => void
    ): Label {
        const node = this.addSprite(parent, name, path, x, y, 250, 92);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.04;
        node.on(Button.EventType.CLICK, onClick, this);
        return this.addLabel(node, 'Title', 180, 48, 34, color, 0, 2);
    }

    private addSprite(
        parent: Node,
        name: string,
        path: string,
        x: number,
        y: number,
        width: number,
        height: number
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = Color.WHITE;
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !isValid(node)) {
                if (error) console.error(`[Settings] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            transform.setContentSize(width, height);
        });
        return node;
    }

    private addLabel(
        parent: Node,
        name: string,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        x: number,
        y: number
    ): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.isBold = true;
        label.color = color;
        label.overflow = Label.Overflow.SHRINK;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

}
