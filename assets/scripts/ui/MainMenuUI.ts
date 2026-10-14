
import {
    _decorator,
    Component,
    Button,
    Node,
    Vec3,
    tween,
    Tween,
    director
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

        // 启动自动呼吸动画
        this.startBreathingAnimation();

        // 监听按钮点击
        buttonNode.on(
            Button.EventType.CLICK,
            this.onStartGame,
            this
        );
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
