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

const LIFT_TIME = 0.06;
const FLIGHT_TIME = 0.22;
const SETTLE_TIME = 0.11;

export interface GemMove {
    frame: SpriteFrame;
    from: Node;
    to: Node;

    // 开始与结束尺寸
    startSize?: number;
    endSize?: number;
    delay?: number;

    /**
     * 这颗棋子落稳时调用。只提交这一颗，不要等整批结束。
     */
    onArrive?: () => void;
}

@ccclass('GemMoveAnimator')
export class GemMoveAnimator extends Component {

    public play(
        moves: GemMove[],
        onComplete: () => void
    ) {
        if (moves.length === 0) {
            onComplete();
            return;
        }

        const parentUI = this.node.getComponent(UITransform);
        if (!parentUI) {
            console.error('AnimationLayer 缺少 UITransform');
            onComplete();
            return;
        }

        let settled = false;
        let completed = 0;
        let started = 0;
        let maxDelay = 0;
        const pending: Array<() => void> = [];

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
            for (const land of pending) land();
            clearFlyers();
            onComplete();
        };
        const watchdog = () => finish();

        const parent = this.node.parent;
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);

        for (const move of moves) {
            if (!move.from?.isValid || !move.to?.isValid) continue;

            const startPos = parentUI.convertToNodeSpaceAR(move.from.worldPosition);
            const endPos = parentUI.convertToNodeSpaceAR(move.to.worldPosition);
            const control = this.arcControl(startPos, endPos);

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

            const endScale = endSize / startSize;
            const lifted = new Vec3(1.12, 1.12, 1);
            const landed = new Vec3(endScale, endScale, 1);
            const squash = new Vec3(endScale * 1.12, endScale * 0.88, 1);
            let arrived = false;
            const land = () => {
                if (arrived) return;
                arrived = true;
                if (move.onArrive) {
                    if (flyer.isValid) flyer.active = false;
                    move.onArrive();
                }
                completed += 1;
                if (!settled && completed >= started) this.scheduleOnce(finish, 0);
            };
            pending.push(land);
            started += 1;

            tween(flyer)
                .delay(delay)
                .to(LIFT_TIME, { scale: lifted }, { easing: 'quadOut' })
                .to(FLIGHT_TIME, { scale: landed }, {
                    easing: 'sineOut',
                    onUpdate: (_target, ratio) => {
                        const t = ratio ?? 0;
                        const u = 1 - t;
                        flyer.setPosition(
                            u * u * startPos.x + 2 * u * t * control.x + t * t * endPos.x,
                            u * u * startPos.y + 2 * u * t * control.y + t * t * endPos.y,
                            0
                        );
                    }
                })
                .call(() => {
                    if (flyer.isValid) flyer.setPosition(endPos);
                })
                .to(0.05, { scale: squash }, { easing: 'quadOut' })
                .to(0.06, { scale: landed }, { easing: 'sineOut' })
                .call(() => {
                    this.scheduleOnce(() => {
                        if (!flyer.isValid) return;
                        Tween.stopAllByTarget(flyer);
                        flyer.destroy();
                    }, 0);
                    land();
                })
                .start();
        }

        if (started === 0) {
            finish();
            return;
        }

        this.scheduleOnce(
            watchdog,
            LIFT_TIME + FLIGHT_TIME + SETTLE_TIME + maxDelay + 0.35
        );
    }

    /**
     * 飞行中点往侧面拱起，形成一条平滑弧线。
     */
    private arcControl(start: Vec3, end: Vec3): Vec3 {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len;
        let ny = dx / len;
        if (ny < 0) {
            nx = -nx;
            ny = -ny;
        }
        const arc = Math.min(78, Math.max(28, len * 0.16));
        return new Vec3(
            (start.x + end.x) / 2 + nx * arc,
            (start.y + end.y) / 2 + ny * arc + arc * 0.25,
            0
        );
    }
}
