
import {
    _decorator,
    Component,
    Node,
    Button,
    Vec3,
    tween,
    Tween
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CompletePanelUI')
export class CompletePanelUI extends Component {

    @property(Node)
    popupCard: Node | null = null;

    @property(Button)
    nextButton: Button | null = null;

    @property(Button)
    restartButton: Button | null = null;

    @property(Button)
    homeButton: Button | null = null;

    public onNext: (() => void) | null = null;
    public onRestart: (() => void) | null = null;
    public onHome: (() => void) | null = null;

    onLoad() {
        this.nextButton?.node.on(
            Button.EventType.CLICK,
            this.handleNext,
            this
        );

        this.restartButton?.node.on(
            Button.EventType.CLICK,
            this.handleRestart,
            this
        );

        this.homeButton?.node.on(
            Button.EventType.CLICK,
            this.handleHome,
            this
        );
    }

    public show() {
        this.node.active = true;

        if (!this.popupCard) return;

        Tween.stopAllByTarget(this.popupCard);

        this.popupCard.setScale(0.65, 0.65, 1);

        tween(this.popupCard)
            .to(
                0.22,
                {
                    scale: new Vec3(1.08, 1.08, 1)
                },
                {
                    easing: 'backOut'
                }
            )
            .to(
                0.12,
                {
                    scale: new Vec3(1, 1, 1)
                }
            )
            .start();
    }

    public hide() {
        this.node.active = false;
    }

    private handleNext() {
        this.onNext?.();
    }

    private handleRestart() {
        this.onRestart?.();
    }

    private handleHome() {
        this.onHome?.();
    }

    onDestroy() {
        this.nextButton?.node.off(
            Button.EventType.CLICK,
            this.handleNext,
            this
        );

        this.restartButton?.node.off(
            Button.EventType.CLICK,
            this.handleRestart,
            this
        );

        this.homeButton?.node.off(
            Button.EventType.CLICK,
            this.handleHome,
            this
        );

        if (this.popupCard) {
            Tween.stopAllByTarget(this.popupCard);
        }
    }
}
