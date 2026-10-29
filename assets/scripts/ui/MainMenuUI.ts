import {
    _decorator,
    Component,
    Button,
    Node,
    director,
    Label,
    UITransform,
    Color,
    Layers,
    Sprite,
    SpriteFrame,
    resources
} from 'cc';

import { PREVIEW } from 'cc/env';
import { localize } from '../core/Locale';
import { LevelSession } from '../core/LevelSession';
import { MainMenuSettings } from './MainMenuSettings';

const { ccclass, property } = _decorator;

@ccclass('MainMenuUI')
export class MainMenuUI extends Component {

    @property(Button)
    startButton: Button | null = null;

    private isStarting = false;
    private playButton: Node | null = null;

    onLoad() {
        if (PREVIEW && typeof location !== 'undefined' &&
            /^[1-6]$/.test(new URLSearchParams(location.search).get('preview-level') ?? '')) {
            director.loadScene('Game');
            return;
        }

        const canvas = this.startButton?.node.parent ?? this.node.parent;
        if (!canvas) return;

        if (this.startButton) this.startButton.node.active = false;
        const oldBackground = canvas.getChildByName('Background');
        if (oldBackground) oldBackground.active = false;

        this.buildHome(canvas);
        MainMenuSettings.attach(canvas);
    }

    private buildHome(canvas: Node) {
        if (canvas.getChildByName('HomeRoot')) return;

        const root = new Node('HomeRoot');
        root.layer = Layers.Enum.UI_2D;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(720, 1280);

        this.addImage(root, 'HomeBackground', 'ui/home/bg_home/spriteFrame', 0, 0, 720, 1280);
        this.addImage(root, 'HomeLogo', 'ui/home/logo_jewel_crush/spriteFrame', 0, 377, 392, 283);
        this.addUnlock(root);
        this.addImage(root, 'CollectionButton', 'ui/home/icon_collection/spriteFrame', 258, -232, 107, 103);
        this.playButton = this.addImage(
            root,
            'PlayButton',
            'ui/home/btn_play/spriteFrame',
            0,
            -383,
            279,
            93,
            this.onStartGame
        );
        this.addPlayLabel(this.playButton);
    }

    private addUnlock(parent: Node) {
        const icon = this.addImage(
            parent,
            'UnlockButton',
            'ui/home/icon_level_unlock/spriteFrame',
            -269,
            -230,
            99,
            118
        );
        const labelNode = new Node('UnlockLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = icon;
        labelNode.setPosition(0, -93, 0);
        labelNode.addComponent(UITransform).setContentSize(160, 64);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = localize('50关\n解锁', 'Level 50\nUnlock');
        label.fontSize = 22;
        label.lineHeight = 28;
        label.isBold = true;
        label.color = new Color(255, 255, 255, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(36, 120, 210, 255);
        label.outlineWidth = 2;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
    }

    private addPlayLabel(button: Node) {
        const level = LevelSession.getProgress().lastPlayedLevel;
        const labelNode = new Node('HomePlayLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = button;
        labelNode.addComponent(UITransform).setContentSize(260, 64);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = localize(`等级 ${level}`, `Level ${level}`);
        label.fontSize = 36;
        label.lineHeight = 44;
        label.isBold = true;
        label.color = Color.WHITE;
        label.enableOutline = true;
        label.outlineColor = new Color(36, 140, 28, 255);
        label.outlineWidth = 3;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
    }

    private addImage(
        parent: Node,
        name: string,
        path: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick?: () => void
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !node.isValid) {
                if (error) console.error(`[MainMenu] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
        });
        if (onClick) {
            const button = node.addComponent(Button);
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 1.06;
            node.on(Button.EventType.CLICK, onClick, this);
        }
        return node;
    }

    private onStartGame() {
        if (this.isStarting) return;
        const panel = this.playButton?.parent?.parent
            ?.getChildByName('MainMenuSettingsPanel');
        if (panel?.active) return;

        this.isStarting = true;
        director.loadScene('Game');
    }

    onDestroy() {
        this.playButton?.off(Button.EventType.CLICK, this.onStartGame, this);
    }
}
