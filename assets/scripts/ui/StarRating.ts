
import {
    _decorator,
    Component,
    Prefab,
    Node,
    Sprite,
    UITransform,
    instantiate,
    Vec3,
    tween,
    Tween
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('StarRating')
export class StarRating extends Component {

    // 绑定你自己制作的 Star.prefab
    @property(Prefab)
    starPrefab: Prefab | null = null;

    // 动态星数范围
    @property
    maxStars = 5;

    @property
    starSize = 72;

    @property
    spacing = 12;

    // 月牙形高度，越大弧度越明显
    @property
    arcHeight = 16;

    // 每颗星出现的间隔
    @property
    appearInterval = 0.22;

    private stars: Node[] = [];
    private baseScales: number[] = [];

    /**
     * 动态显示星级。
     * 例如 showStars(3) 显示 3 颗；
     * showStars(5) 显示 5 颗。
     */
    public showStars(earned: number) {
        if (!this.starPrefab) {
            console.error('[StarRating] Star.prefab 未绑定');
            return;
        }

        const count = Math.max(
            0,
            Math.min(this.maxStars, Math.floor(earned))
        );

        this.clearStars();

        if (count === 0) return;

        const step = this.starSize + this.spacing;
        const center = (count - 1) / 2;

        for (let i = 0; i < count; i++) {
            const star = instantiate(this.starPrefab);

            star.name = `Star_${i + 1}`;
            star.parent = this.node;
            star.active = true;

            const ui = star.getComponent(UITransform);
            const sprite = star.getComponent(Sprite);

            if (sprite) {
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }

            ui?.setContentSize(
                this.starSize,
                this.starSize
            );

            // 以获得的星数为中心排列
            const offset = i - center;
            const x = offset * step;

            // 中间高，两侧低
            const y = 38 -
                offset * offset * this.arcHeight;

            // 中间略大，两侧稍小
            const baseScale = Math.max(
                0.8,
                1.12 - Math.abs(offset) * 0.1
            );

            star.setPosition(x, y, 0);
            star.setScale(0, 0, 1);

            this.stars.push(star);
            this.baseScales.push(baseScale);

            // 从左到右依次弹出
            tween(star)
                .delay(i * this.appearInterval)
                .to(
                    0.27,
                    {
                        scale: new Vec3(
                            baseScale * 1.2,
                            baseScale * 1.2,
                            1
                        )
                    },
                    { easing: 'backOut' }
                )
                .to(
                    0.13,
                    {
                        scale: new Vec3(
                            baseScale,
                            baseScale,
                            1
                        )
                    },
                    { easing: 'sineOut' }
                )
                .start();
        }

        console.log(
            `[StarRating] 展示 ${count} 颗星`
        );
    }

    private clearStars() {
        for (const star of this.stars) {
            Tween.stopAllByTarget(star);
            star.destroy();
        }

        this.stars = [];
        this.baseScales = [];
    }

    onDestroy() {
        this.clearStars();
    }
}
