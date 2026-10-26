
import {
    _decorator,
    Component,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    Layers,
    Vec3,
    tween,
    Tween,
    Color
} from 'cc';

const { ccclass } = _decorator;

export interface GemMove {
    frame: SpriteFrame;
    from: Node;
    to: Node;

    // 开始与结束尺寸
    startSize?: number;
    endSize?: number;
    delay?: number;
}

@ccclass('GemMoveAnimator')
export class GemMoveAnimator extends Component {

    private readonly duration = 0.3;

    public play(
        moves: GemMove[],
        onComplete: () => void
    ) {
        if (moves.length === 0) {
            onComplete();
            return;
        }

        const parentUI =
            this.node.getComponent(UITransform);

        if (!parentUI) {
            console.error(
                'AnimationLayer 缺少 UITransform'
            );
            onComplete();
            return;
        }

        let settled = false;
        const clearFlyers = () => {
            for (const child of [...this.node.children]) {
                if (child.name !== 'GemFlyer' || !child.isValid) continue;
                Tween.stopAllByTarget(child);
                child.destroy();
            }
        };
        const finish = () => {
            if (settled) return;
            settled = true;
            this.unschedule(finish);
            this.unschedule(watchdog);
            clearFlyers();
            onComplete();
        };
        const watchdog = () => finish();

        let completed = 0;
        let started = 0;
        let maxDelay = 0;
        const parent = this.node.parent;
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);

        for (const move of moves) {
            if (!move.from?.isValid || !move.to?.isValid) continue;

            const startPos =
                parentUI.convertToNodeSpaceAR(
                    move.from.worldPosition
                );
            const endPos =
                parentUI.convertToNodeSpaceAR(
                    move.to.worldPosition
                );

            const flyer = new Node('GemFlyer');
            flyer.layer = Layers.Enum.UI_2D;
            flyer.parent = this.node;

            const ui = flyer.addComponent(UITransform);
            const sprite = flyer.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = move.frame;
            sprite.color = Color.WHITE;

            const startSize = Math.max(1, move.startSize ?? 46);
            const endSize = Math.max(1, move.endSize ?? 46);
            const delay = Math.max(0, move.delay ?? 0);
            if (delay > maxDelay) maxDelay = delay;
            ui.setContentSize(startSize, startSize);
            flyer.setPosition(startPos);

            const scale = endSize / startSize;
            started += 1;
            tween(flyer)
                .delay(delay)
                .to(this.duration, {
                    position: endPos.clone(),
                    scale: new Vec3(scale, scale, 1)
                }, { easing: 'sineInOut' })
                .call(() => {
                    completed += 1;
                    if (completed >= started) this.scheduleOnce(finish, 0);
                })
                .start();
        }

        if (started === 0) {
            finish();
            return;
        }

        this.scheduleOnce(watchdog, this.duration + maxDelay + 0.25);
    }
}
