import {
    _decorator, Component, Node, Label, Button, UITransform,
    Graphics, Color, Layers
} from 'cc';

const { ccclass } = _decorator;

@ccclass('ToolsBarUI')
export class ToolsBarUI extends Component {
    private built = false;

    onLoad() {
        this.build();
    }

    public build() {
        if (this.built) return;
        this.built = true;

        this.node.layer = Layers.Enum.UI_2D;
        const root = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        root.setContentSize(360, 110);

        this.makeTool('MagicWandButton', -115, '魔法棒', new Color(124, 92, 214, 255), 3);
        this.makeTool('XRayButton', 0, '透视镜', new Color(156, 164, 176, 255), undefined, 10);
        this.makeTool('MagnetButton', 115, '磁铁', new Color(156, 164, 176, 255), undefined, 15);
    }

    private makeTool(
        name: string,
        x: number,
        title: string,
        tint: Color,
        count?: number,
        lockLevel?: number
    ) {
        const buttonNode = new Node(name);
        buttonNode.layer = Layers.Enum.UI_2D;
        buttonNode.parent = this.node;
        buttonNode.setPosition(x, 6, 0);
        buttonNode.addComponent(UITransform).setContentSize(92, 92);

        const icon = new Node('Icon');
        icon.layer = Layers.Enum.UI_2D;
        icon.parent = buttonNode;
        icon.setPosition(0, 10, 0);
        icon.addComponent(UITransform).setContentSize(70, 70);
        const iconGraphics = icon.addComponent(Graphics);
        iconGraphics.fillColor = tint;
        iconGraphics.roundRect(-35, -35, 70, 70, 16);
        iconGraphics.fill();

        const nameLabel = this.makeText('NameLabel', title, 16, new Color(72, 52, 36, 255));
        nameLabel.node.parent = buttonNode;
        nameLabel.node.setPosition(0, -38, 0);
        nameLabel.node.getComponent(UITransform)?.setContentSize(92, 22);

        if (count !== undefined) {
            const badge = new Node('CountBadge');
            badge.layer = Layers.Enum.UI_2D;
            badge.parent = buttonNode;
            badge.setPosition(30, -8, 0);
            badge.addComponent(UITransform).setContentSize(28, 28);
            const badgeGraphics = badge.addComponent(Graphics);
            badgeGraphics.fillColor = new Color(62, 176, 92, 255);
            badgeGraphics.circle(0, 0, 14);
            badgeGraphics.fill();
            const countLabel = this.makeText('CountLabel', `${count}`, 16, Color.WHITE);
            countLabel.node.parent = badge;
            countLabel.node.getComponent(UITransform)?.setContentSize(28, 28);
        }

        if (lockLevel !== undefined) {
            const overlay = new Node('LockOverlay');
            overlay.layer = Layers.Enum.UI_2D;
            overlay.parent = buttonNode;
            overlay.setPosition(0, 10, 0);
            overlay.addComponent(UITransform).setContentSize(70, 70);
            const overlayGraphics = overlay.addComponent(Graphics);
            overlayGraphics.fillColor = new Color(48, 52, 60, 150);
            overlayGraphics.roundRect(-35, -35, 70, 70, 16);
            overlayGraphics.fill();
            const lockLabel = this.makeText(
                'LockLabel',
                `LEVEL ${lockLevel}`,
                13,
                Color.WHITE
            );
            lockLabel.node.parent = overlay;
            lockLabel.node.getComponent(UITransform)?.setContentSize(70, 36);
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
}
