
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

        let completed = 0;

        for (const move of moves) {

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

            const startSize = move.startSize ?? 46;
            const endSize = move.endSize ?? 46;

            // 固定初始像素尺寸
            ui.setContentSize(startSize, startSize);

            flyer.setPosition(startPos);

            const scale =
                endSize / startSize;

            tween(flyer)
                .parallel(
                    tween().to(
                        this.duration,
                        {
                            position: endPos.clone()
                        },
                        {
                            easing: 'sineInOut'
                        }
                    ),
                    tween().to(
                        this.duration,
                        {
                            scale: new Vec3(
                                scale,
                                scale,
                                1
                            )
                        },
                        {
                            easing: 'sineInOut'
                        }
                    )
                )
                .call(() => {
                    flyer.destroy();

                    completed++;

                    if (completed === moves.length) {
                        onComplete();
                    }
                })
                .start();
        }
    }
}
