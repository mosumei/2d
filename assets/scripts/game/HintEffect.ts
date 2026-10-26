import {
    _decorator,
    Component,
    Node,
    tween,
    Tween,
    Vec3,
} from 'cc';

const { ccclass } = _decorator;

/**
 * 放大镜高亮。只缩放提示节点，不改棋盘数据。
 */
@ccclass('HintEffect')
export class HintEffect extends Component {

    private sourceNode: Node | null = null;
    private targetNode: Node | null = null;

    private sourceScale = new Vec3();
    private targetScale = new Vec3();

    /**
     * 播放放大镜提示。
     * @param source 需要移动的宝石
     * @param target 建议放置的目标格
     */
    public showHint(source: Node, target: Node): void {
        this.clearHint();

        if (!source.isValid || !target.isValid) return;

        this.sourceNode = source;
        this.targetNode = target;

        this.sourceScale.set(source.scale);
        this.targetScale.set(target.scale);

        this.pulse(source, this.sourceScale, 1.12);

        if (source !== target) {
            this.pulse(target, this.targetScale, 1.08);
        }
    }

    private pulse(
        node: Node,
        originalScale: Vec3,
        factor: number
    ): void {
        const enlarged = new Vec3(
            originalScale.x * factor,
            originalScale.y * factor,
            originalScale.z
        );

        tween(node)
            .repeatForever(
                tween(node)
                    .to(0.35, { scale: enlarged })
                    .to(0.35, { scale: originalScale.clone() })
            )
            .start();
    }

    /**
     * 玩家操作或关闭提示时调用。
     */
    public clearHint(): void {
        const restore = (
            node: Node | null,
            scale: Vec3
        ) => {
            if (!node || !node.isValid) return;

            Tween.stopAllByTarget(node);
            node.setScale(scale);
        };

        restore(this.sourceNode, this.sourceScale);
        if (this.targetNode !== this.sourceNode) {
            restore(this.targetNode, this.targetScale);
        }

        this.sourceNode = null;
        this.targetNode = null;
    }

    protected onDisable(): void {
        this.clearHint();
    }

    protected onDestroy(): void {
        this.clearHint();
    }
}
