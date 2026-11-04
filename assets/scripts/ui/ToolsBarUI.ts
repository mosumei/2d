import {
    _decorator, Component, Node, Label, Button, UITransform,
    Graphics, Color, Layers, Sprite, SpriteFrame, resources, isValid,
    tween, Tween, Vec3
} from 'cc';

import { localize } from '../core/Locale';

const { ccclass } = _decorator;

@ccclass('ToolsBarUI')
export class ToolsBarUI extends Component {
    private built = false;
    private wandButton: Node | null = null;
    private magnetButton: Node | null = null;
    private adBadges: Node[] = [];
    public onWandClick: (() => void) | null = null;
    public onHintClick: (() => void) | null = null;
    public onMagnetClick: (() => void) | null = null;
    public onSettingsClick: (() => void) | null = null;
    public onShareClick: (() => void) | null = null;
    private rankLabel: Label | null = null;

    onLoad() {
        this.build();
    }

    public build() {
        if (this.built) return;
        this.built = true;

        this.node.layer = Layers.Enum.UI_2D;
        const root = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        root.setContentSize(680, 200);

        const size = 136;
        this.makeTool('MagnetButton', -214, 'ui/game/btn_lock', size);
        this.makeTool('MagicWandButton', -65, 'ui/game/btn_lock', size);
        this.makeTool('SettingsButton', 84, 'ui/game/btn_gea', size);
    }

    private makeTool(name: string, x: number, imagePath: string, size: number) {
        const buttonNode = new Node(name);
        buttonNode.layer = Layers.Enum.UI_2D;
        buttonNode.parent = this.node;
        buttonNode.setPosition(x, 0, 0);
        buttonNode.addComponent(UITransform).setContentSize(size, size);

        const icon = new Node('Icon');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = buttonNode;
        icon.addComponent(UITransform).setContentSize(size, size);
        const sprite = icon.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(imagePath + '/spriteFrame', SpriteFrame, (err, frame) => {
            if (err || !frame || !isValid(icon)) {
                if (err) console.error(`[Game] 加载 ${imagePath}/spriteFrame 失败`, err);
                return;
            }
            sprite.spriteFrame = frame;
        });

        if (name === 'MagicWandButton') {
            this.wandButton = buttonNode;
            this.adBadges.push(this.makeAdBadge(buttonNode));
            buttonNode.on(Button.EventType.CLICK, () => {
                this.onWandClick?.();
            }, this);
        }

        if (name === 'SettingsButton') {
            buttonNode.on(Button.EventType.CLICK, () => {
                this.onSettingsClick?.();
            }, this);
        }

        if (name === 'MagnetButton') {
            this.magnetButton = buttonNode;
            this.adBadges.push(this.makeAdBadge(buttonNode));
            buttonNode.on(Button.EventType.CLICK, () => {
                this.onMagnetClick?.();
            }, this);
        }

        const button = buttonNode.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.05;
    }

    /**
     * 齿轮按钮上的等级文字。
     * @param text 已本地化的等级文案
     */
    public setRankLabel(text: string) {
        if (this.rankLabel) this.rankLabel.string = text;
    }

    private makeText(name: string, text: string, fontSize: number, color: Color): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(80, fontSize + 8);
        const label = node.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    private makeAdBadge(parent: Node): Node {
        const node = new Node('WatchAdBadge');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        const parentHeight = parent.getComponent(UITransform)?.contentSize.height ?? 136;
        node.setPosition(0, parentHeight * 0.5 + 16, 0);
        node.active = false;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(96, 28);
        Object.assign(transform, { hitTest: () => false });

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(120, 78, 36, 230);
        graphics.roundRect(-48, -14, 96, 28, 14);
        graphics.fill();

        const label = this.makeText('BadgeLabel', localize('查看广告', 'Watch Ad'), 14, new Color(255, 246, 226, 255));
        label.node.parent = node;
        label.node.getComponent(UITransform)?.setContentSize(88, 24);
        const labelTransform = label.node.getComponent(UITransform);
        if (labelTransform) Object.assign(labelTransform, { hitTest: () => false });
        return node;
    }

    /**
     * 磁铁工作时左右摇晃图标。
     */
    public playMagnetShake() {
        const icon = this.magnetButton?.getChildByName('Icon');
        if (!icon) return;
        Tween.stopAllByTarget(icon);
        icon.setPosition(0, 0, 0);
        tween(icon)
            .repeatForever(
                tween(icon)
                    .to(0.08, { position: new Vec3(6, 0, 0) })
                    .to(0.08, { position: new Vec3(-6, 0, 0) })
            )
            .start();
    }

    /**
     * 磁铁结束后把图标放回原位。
     */
    public stopMagnetShake() {
        const icon = this.magnetButton?.getChildByName('Icon');
        if (!icon?.isValid) return;
        Tween.stopAllByTarget(icon);
        icon.setPosition(0, 0, 0);
    }

    public setWandArmed(armed: boolean) {
        this.wandButton?.setScale(armed ? 1.12 : 1, armed ? 1.12 : 1, 1);
    }

    /**
     * 第 3 关起显示「查看广告」。前两关不显示。
     * @param visible 是否显示标签
     */
    public setWatchAdBadge(visible: boolean) {
        for (const badge of this.adBadges) {
            badge.active = visible;
        }
    }

    public getWandFrame(): SpriteFrame | null {
        return this.wandButton
            ?.getChildByName('Icon')
            ?.getComponent(Sprite)
            ?.spriteFrame ?? null;
    }
}
