import {
    _decorator, Component, Node, Label, Button, UITransform,
    Graphics, Color, Layers, Sprite, SpriteFrame, resources, isValid,
    tween, Tween, Vec3
} from 'cc';

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

    onLoad() {
        this.build();
    }

    public build() {
        if (this.built) return;
        this.built = true;

        this.node.layer = Layers.Enum.UI_2D;
        const root = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        root.setContentSize(480, 120);

        this.makeTool('MagicWandButton', -150, '魔法棒', 'ui/tools/tool_magic_wand');
        this.makeTool('HintButton', 0, '放大镜', 'ui/tools/tool_magnifier');
        this.makeTool('MagnetButton', 150, '磁铁', 'ui/tools/tool_magnet');
    }

    private makeTool(
        name: string,
        x: number,
        title: string,
        imagePath: string,
        lockLevel?: number
    ) {
        const buttonNode = new Node(name);
        buttonNode.layer = Layers.Enum.UI_2D;
        buttonNode.parent = this.node;
        buttonNode.setPosition(x, 6, 0);
        buttonNode.addComponent(UITransform).setContentSize(88, 88);

        const icon = new Node('Icon');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = buttonNode;
        icon.setPosition(0, 8, 0);
        icon.addComponent(UITransform).setContentSize(64, 64);
        const sprite = icon.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = lockLevel === undefined
            ? Color.WHITE
            : new Color(170, 170, 170, 255);
        resources.load(imagePath + '/spriteFrame', SpriteFrame, (err, frame) => {
            if (err || !frame || !isValid(icon)) return;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            icon.getComponent(UITransform)?.setContentSize(64, 64);
        });

        const nameLabel = this.makeText('NameLabel', title, 16, new Color(72, 52, 36, 255));
        nameLabel.node.parent = buttonNode;
        nameLabel.node.setPosition(0, -38, 0);
        nameLabel.node.getComponent(UITransform)?.setContentSize(92, 22);

        if (name === 'MagicWandButton') {
            this.wandButton = buttonNode;
            this.adBadges.push(this.makeAdBadge(buttonNode));
            buttonNode.on(Button.EventType.CLICK, () => {
                this.onWandClick?.();
            }, this);
        }

        if (name === 'HintButton') {
            this.adBadges.push(this.makeAdBadge(buttonNode));
            buttonNode.on(Button.EventType.CLICK, () => {
                this.onHintClick?.();
            }, this);
        }

        if (name === 'MagnetButton') {
            this.magnetButton = buttonNode;
            this.adBadges.push(this.makeAdBadge(buttonNode));
            buttonNode.on(Button.EventType.CLICK, () => {
                this.onMagnetClick?.();
            }, this);
        }

        if (lockLevel !== undefined) {
            const overlay = new Node('LockOverlay');
            overlay.layer = Layers.Enum.UI_2D;
            overlay.parent = buttonNode;
            overlay.setPosition(0, 8, 0);
            overlay.addComponent(UITransform).setContentSize(64, 64);
            const overlayGraphics = overlay.addComponent(Graphics);
            overlayGraphics.fillColor = new Color(48, 52, 60, 150);
            overlayGraphics.roundRect(-32, -32, 64, 64, 14);
            overlayGraphics.fill();
            const lockLabel = this.makeText(
                'LockLabel',
                `LEVEL ${lockLevel}`,
                13,
                Color.WHITE
            );
            lockLabel.node.parent = overlay;
            lockLabel.node.getComponent(UITransform)?.setContentSize(64, 36);
        }

        const button = buttonNode.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.05;
        button.interactable = lockLevel === undefined;
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
        node.setPosition(0, 58, 0);
        node.active = false;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(96, 28);
        Object.assign(transform, { hitTest: () => false });

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(120, 78, 36, 230);
        graphics.roundRect(-48, -14, 96, 28, 14);
        graphics.fill();

        const label = this.makeText('BadgeLabel', '查看广告', 14, new Color(255, 246, 226, 255));
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
        icon.setPosition(0, 8, 0);
        tween(icon)
            .repeatForever(
                tween(icon)
                    .to(0.08, { position: new Vec3(6, 8, 0) })
                    .to(0.08, { position: new Vec3(-6, 8, 0) })
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
        icon.setPosition(0, 8, 0);
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
