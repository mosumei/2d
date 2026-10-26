import {
    _decorator,
    Color,
    Component,
    isValid,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    tween,
    Tween,
    UITransform,
    Vec3
} from 'cc';

const { ccclass } = _decorator;

const HAND_FRAME = 'ui/tutorial/hand_glove/spriteFrame';
const HAND_WIDTH = 150;
const HAND_HEIGHT = 143;
const TIP_ANCHOR_X = 0.17;
const TIP_ANCHOR_Y = 0.89;

let handFrame: Promise<SpriteFrame | null> | null = null;

function loadHandFrame(): Promise<SpriteFrame | null> {
    if (!handFrame) {
        handFrame = new Promise((resolve) => {
            resources.load(HAND_FRAME, SpriteFrame, (error, frame) => {
                if (error || !frame) {
                    console.error('[TutorialHand] 手套图片加载失败', error);
                    resolve(null);
                    return;
                }
                resolve(frame);
            });
        });
    }
    return handFrame;
}

/**
 * 循环点按的手套提示。指尖锚在目标上，点击会穿过手套。
 */
@ccclass('TutorialHand')
export class TutorialHand extends Component {

    /**
     * 把指尖移到目标上并循环轻点。
     * @param worldX 世界坐标 x
     * @param worldY 世界坐标 y
     */
    public pointAt(worldX: number, worldY: number) {
        this.node.active = true;
        this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1);
        this.node.setWorldPosition(worldX, worldY, 0);
        Tween.stopAllByTarget(this.node);
        this.node.setScale(1, 1, 1);
        tween(this.node)
            .repeatForever(
                tween(this.node)
                    .to(0.42, { scale: new Vec3(0.84, 0.84, 1) }, { easing: 'sineInOut' })
                    .to(0.42, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            )
            .start();
    }

    /**
     * 隐藏手套。
     */
    public hide() {
        Tween.stopAllByTarget(this.node);
        this.node.active = false;
    }
}

/**
 * 在父节点下创建手套。
 * @param parent 父节点
 */
export function createTutorialHand(parent: Node): TutorialHand {
    const node = new Node('TutorialHand');
    node.layer = parent.layer;
    node.parent = parent;

    const transform = node.addComponent(UITransform);
    transform.setContentSize(HAND_WIDTH, HAND_HEIGHT);
    transform.setAnchorPoint(TIP_ANCHOR_X, TIP_ANCHOR_Y);
    Object.assign(transform, { hitTest: () => false });

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.color = Color.WHITE;
    void loadHandFrame().then((frame) => {
        if (!frame || !isValid(node)) return;
        sprite.spriteFrame = frame;
    });

    return node.addComponent(TutorialHand);
}
