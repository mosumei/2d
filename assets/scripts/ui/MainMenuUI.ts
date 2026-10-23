
import {
    _decorator,
    Component,
    Button,
    Node,
    Vec3,
    tween,
    Tween,
    director,
    Label,
    UITransform,
    Color,
    Layers
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('MainMenuUI')
export class MainMenuUI extends Component {

    @property(Button)
    startButton: Button | null = null;

    private isStarting = false;

    onLoad() {
          console.log('✅ MainMenuUI.ts 已经运行！');
        if (!this.startButton) {
            console.error('StartButton 未绑定！');
            return;
        }

        const buttonNode = this.startButton.node;
        this.ensurePlainLook(buttonNode);

        // 启动自动呼吸动画
        this.startBreathingAnimation();

        // 监听按钮点击
        buttonNode.on(
            Button.EventType.CLICK,
            this.onStartGame,
            this
        );
    }

    private ensurePlainLook(buttonNode: Node) {
        if (!buttonNode.getChildByName('PlainLabel')) {
            const labelNode = new Node('PlainLabel');
            labelNode.layer = Layers.Enum.UI_2D;
            labelNode.parent = buttonNode;
            const parentSize = buttonNode.getComponent(UITransform)?.contentSize;
            labelNode.addComponent(UITransform).setContentSize(
                parentSize?.width ?? 280,
                parentSize?.height ?? 80
            );
            const label = labelNode.addComponent(Label);
            label.useSystemFont = true;
            label.fontFamily = 'PingFang SC';
            label.string = '开始';
            label.fontSize = 42;
            label.lineHeight = 50;
            label.isBold = true;
            label.color = new Color(92, 58, 32, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
        }

        const canvas = buttonNode.parent;
        if (!canvas || canvas.getChildByName('TitleLabel')) return;

        const titleNode = new Node('TitleLabel');
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.parent = canvas;
        titleNode.setPosition(0, 220, 0);
        titleNode.addComponent(UITransform).setContentSize(520, 80);
        const title = titleNode.addComponent(Label);
        title.useSystemFont = true;
        title.fontFamily = 'PingFang SC';
        title.string = 'Jewel Crush';
        title.fontSize = 64;
        title.lineHeight = 76;
        title.isBold = true;
        title.color = new Color(92, 58, 32, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;
    }

    // 按钮自动放大、缩小
    private startBreathingAnimation() {
        if (!this.startButton) return;

        const node = this.startButton.node;

        Tween.stopAllByTarget(node);

        node.setScale(1, 1, 1);

        tween(node)
            .to(0.7, {
                scale: new Vec3(1.1, 1.1, 1)
            }, {
                easing: 'sineInOut'
            })
            .to(0.7, {
                scale: new Vec3(1, 1, 1)
            }, {
                easing: 'sineInOut'
            })
            .union()
            .repeatForever()
            .start();
    }

    // 点击后立即进入游戏
    private onStartGame() {
        if (this.isStarting || !this.startButton) return;

        this.isStarting = true;

        Tween.stopAllByTarget(this.startButton.node);

        director.loadScene('Game');
    }

    onDestroy() {
        if (!this.startButton) return;

        const node = this.startButton.node;

        node.off(
            Button.EventType.CLICK,
            this.onStartGame,
            this
        );

        Tween.stopAllByTarget(node);
    }
}
