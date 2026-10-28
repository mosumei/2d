import {
    _decorator,
    Component,
    EventTouch,
    Node,
    UITransform,
    Vec2,
    Vec3
} from 'cc';

const { ccclass } = _decorator;

/**
 * 只缩放、拖动拼图节点。托盘和道具不在这个节点上。
 */
@ccclass('BoardGesture')
export class BoardGesture extends Component {
    /** 这次手势已经在拖或捏，格子上的点击要丢掉。 */
    public static swallowTap = false;

    private readonly minScale = 1;
    private readonly maxScale = 3;
    private readonly tapSlop = 18;

    private rest = new Vec3(0, 100, 0);
    private origin = new Vec2();
    private tracking = false;
    private pinchDistance = 0;
    private pinchScale = 1;

    onEnable() {
        this.node.on(Node.EventType.TOUCH_START, this.onStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onEnd, this);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onEnd, this);
    }

    /**
     * 记下当前摆放，作为缩回到 1 倍时的位置。
     */
    public rememberRest(): void {
        this.rest.set(this.node.position);
    }

    /**
     * 换关时收回放大和拖动。
     */
    public resetView(): void {
        this.pinchDistance = 0;
        this.tracking = false;
        BoardGesture.swallowTap = false;
        this.node.setScale(1, 1, 1);
        this.node.setPosition(this.rest);
    }

    private onStart(event: EventTouch) {
        const points = this.readPoints(event);
        if (points.length >= 2) {
            BoardGesture.swallowTap = true;
            this.pinchDistance = 0;
            this.tracking = false;
            return;
        }
        BoardGesture.swallowTap = false;
        this.origin.set(points[0]);
        this.tracking = true;
        this.pinchDistance = 0;
    }

    private onMove(event: EventTouch) {
        const points = this.readPoints(event);
        if (points.length >= 2) {
            this.pinch(points[0], points[1]);
            return;
        }
        this.pinchDistance = 0;
        if (!this.tracking || points.length !== 1) return;
        const dx = points[0].x - this.origin.x;
        const dy = points[0].y - this.origin.y;
        if (dx * dx + dy * dy < this.tapSlop * this.tapSlop) return;
        BoardGesture.swallowTap = true;
        if (this.node.scale.x <= this.minScale + 0.001) return;
        const delta = event.getUIDelta();
        this.node.setPosition(
            this.node.position.x + delta.x,
            this.node.position.y + delta.y,
            this.node.position.z
        );
        this.clamp();
    }

    private onEnd(event: EventTouch) {
        const left = event.getTouches();
        this.pinchDistance = 0;
        if (left.length === 0) {
            this.tracking = false;
            return;
        }
        if (left.length === 1) {
            const loc = left[0].getUILocation();
            this.origin.set(loc.x, loc.y);
            this.tracking = true;
        }
    }

    private pinch(a: Vec2, b: Vec2) {
        BoardGesture.swallowTap = true;
        this.tracking = false;
        const dist = Vec2.distance(a, b);
        if (dist < 1) return;
        if (this.pinchDistance <= 0) {
            this.pinchDistance = dist;
            this.pinchScale = this.node.scale.x;
            return;
        }
        const mid = new Vec2((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.applyScale(this.pinchScale * (dist / this.pinchDistance), this.toParent(mid));
    }

    /**
     * 以两指中心为原点放大或缩小。
     * @param next 目标倍数
     * @param focal 父节点坐标里的两指中心
     */
    private applyScale(next: number, focal: Vec3) {
        const old = this.node.scale.x;
        if (old <= 0) return;
        const scale = Math.min(this.maxScale, Math.max(this.minScale, next));
        const ratio = scale / old;
        const pos = this.node.position;
        this.node.setScale(scale, scale, 1);
        this.node.setPosition(
            focal.x - (focal.x - pos.x) * ratio,
            focal.y - (focal.y - pos.y) * ratio,
            pos.z
        );
        this.clamp();
    }

    private clamp() {
        const scale = this.node.scale.x;
        if (scale <= this.minScale + 0.001) {
            this.node.setScale(1, 1, 1);
            this.node.setPosition(this.rest);
            return;
        }
        const size = this.node.getComponent(UITransform)?.contentSize;
        const width = size?.width ?? 600;
        const height = size?.height ?? 720;
        const maxX = (width * (scale - 1)) / 2;
        const maxY = (height * (scale - 1)) / 2;
        const x = Math.min(this.rest.x + maxX, Math.max(this.rest.x - maxX, this.node.position.x));
        const y = Math.min(this.rest.y + maxY, Math.max(this.rest.y - maxY, this.node.position.y));
        this.node.setPosition(x, y, this.node.position.z);
    }

    private readPoints(event: EventTouch): Vec2[] {
        const points: Vec2[] = [];
        for (const touch of event.getTouches()) {
            const loc = touch.getUILocation();
            points.push(new Vec2(loc.x, loc.y));
        }
        if (points.length === 0) {
            const loc = event.getUILocation();
            points.push(new Vec2(loc.x, loc.y));
        }
        return points;
    }

    private toParent(point: Vec2): Vec3 {
        const parent = this.node.parent?.getComponent(UITransform);
        const raw = new Vec3(point.x, point.y, 0);
        if (!parent) return raw;
        return parent.convertToNodeSpaceAR(raw);
    }
}
