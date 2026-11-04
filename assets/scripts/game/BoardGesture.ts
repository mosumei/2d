import {
    _decorator, Component, EventMouse, EventTouch, Node, UITransform, Vec2, Vec3
} from 'cc';

const { ccclass } = _decorator;

/** Only the board moves. The fixed viewport owns input and clips its children. */
@ccclass('BoardGesture')
export class BoardGesture extends Component {
    public static swallowTap = false;
    public canInteract: (() => boolean) | null = null;
    public onViewChanged: (() => void) | null = null;

    private readonly minScale = 1;
    private readonly maxScale = 5;
    private readonly tapSlop = 18;
    private viewport: Node | null = null;
    private rest = new Vec3(0, 100, 0);
    private origin = new Vec2();
    private lastPoint = new Vec2();
    private readonly touchIds = new Set<number>();
    private tracking = false;
    private pinchDistance = 0;
    private pinchScale = 1;
    private pinchCenter = new Vec3();

    onEnable(): void { this.bind(this.viewport ?? this.node, true); }
    onDisable(): void {
        this.bind(this.viewport ?? this.node, false);
        this.touchIds.clear();
        this.tracking = false;
        this.pinchDistance = 0;
    }

    public setViewport(viewport: Node): void {
        if (this.viewport === viewport) return;
        if (this.enabledInHierarchy) this.bind(this.viewport ?? this.node, false);
        this.viewport = viewport;
        if (this.enabledInHierarchy) this.bind(viewport, true);
    }

    private bind(node: Node, listen: boolean): void {
        // Capture before GemCell handles touch-end, so a pinch never places gems.
        if (listen) {
            node.on(Node.EventType.TOUCH_START, this.onStart, this, true);
            node.on(Node.EventType.TOUCH_MOVE, this.onMove, this, true);
            node.on(Node.EventType.TOUCH_END, this.onEnd, this, true);
            node.on(Node.EventType.TOUCH_CANCEL, this.onEnd, this, true);
            node.on(Node.EventType.MOUSE_WHEEL, this.onWheel, this, true);
        } else {
            node.off(Node.EventType.TOUCH_START, this.onStart, this, true);
            node.off(Node.EventType.TOUCH_MOVE, this.onMove, this, true);
            node.off(Node.EventType.TOUCH_END, this.onEnd, this, true);
            node.off(Node.EventType.TOUCH_CANCEL, this.onEnd, this, true);
            node.off(Node.EventType.MOUSE_WHEEL, this.onWheel, this, true);
        }
    }

    public rememberRest(): void { this.rest.set(this.node.position); }

    public resetView(): void {
        this.touchIds.clear();
        this.pinchDistance = 0;
        this.tracking = false;
        BoardGesture.swallowTap = false;
        this.node.setScale(1, 1, 1);
        this.node.setPosition(this.rest);
        this.onViewChanged?.();
    }

    private onStart(event: EventTouch): void {
        if (this.canInteract && !this.canInteract()) return;
        for (const touch of event.getTouches()) {
            if (this.contains(touch.getUILocation())) this.touchIds.add(touch.getID());
        }
        const points = this.readPoints(event);
        if (points.length >= 2) {
            BoardGesture.swallowTap = true;
            this.tracking = false;
            this.beginPinch(points[0], points[1]);
        } else if (points.length === 1) {
            BoardGesture.swallowTap = false;
            this.origin.set(points[0]);
            this.lastPoint.set(points[0]);
            this.tracking = true;
            this.pinchDistance = 0;
        }
    }

    private onMove(event: EventTouch): void {
        if (this.canInteract && !this.canInteract()) return;
        const points = this.readPoints(event);
        if (points.length >= 2) {
            BoardGesture.swallowTap = true;
            this.tracking = false;
            const distance = Vec2.distance(points[0], points[1]);
            if (this.pinchDistance <= 0) { this.beginPinch(points[0], points[1]); return; }
            const center = this.toParent(new Vec2((points[0].x + points[1].x) / 2,
                (points[0].y + points[1].y) / 2));
            this.applyScale(this.pinchScale * distance / this.pinchDistance, center, this.pinchCenter);
            this.pinchCenter.set(center);
            return;
        }
        this.pinchDistance = 0;
        if (!this.tracking || points.length !== 1) return;
        const point = points[0];
        const current = this.toParent(point);
        const previous = this.toParent(this.lastPoint);
        this.lastPoint.set(point);
        if (Vec2.distance(point, this.origin) < this.tapSlop && !BoardGesture.swallowTap) return;
        BoardGesture.swallowTap = true;
        if (this.node.scale.x <= this.minScale + 0.001) return;
        this.node.setPosition(this.node.position.x + current.x - previous.x,
            this.node.position.y + current.y - previous.y, this.node.position.z);
        this.clamp();
    }

    private onEnd(event: EventTouch): void {
        for (const touch of event.getTouches()) this.touchIds.delete(touch.getID());
        const left = this.readPoints(event);
        this.pinchDistance = 0;
        this.tracking = left.length === 1;
        if (left.length === 1) {
            this.origin.set(left[0]);
            this.lastPoint.set(left[0]);
        } else if (left.length >= 2) {
            this.beginPinch(left[0], left[1]);
        }
        // Keep swallowTap through the last touch-end; reset only on a new tap.
    }

    private onWheel(event: EventMouse): void {
        if ((this.canInteract && !this.canInteract()) || !this.contains(event.getUILocation())) return;
        const delta = event.getScrollY();
        if (!delta) return;
        this.applyScale(this.node.scale.x * Math.exp(delta * 0.0015), this.toParent(event.getUILocation()));
        event.propagationStopped = true;
    }

    private beginPinch(a: Vec2, b: Vec2): void {
        this.pinchDistance = Math.max(1, Vec2.distance(a, b));
        this.pinchScale = this.node.scale.x;
        this.pinchCenter.set(this.toParent(new Vec2((a.x + b.x) / 2, (a.y + b.y) / 2)));
    }

    private applyScale(next: number, focal: Vec3, previousFocal = focal): void {
        const old = this.node.scale.x;
        if (old <= 0) return;
        const scale = Math.min(this.maxScale, Math.max(this.minScale, next));
        const ratio = scale / old;
        const pos = this.node.position;
        this.node.setScale(scale, scale, 1);
        this.node.setPosition(focal.x - (previousFocal.x - pos.x) * ratio,
            focal.y - (previousFocal.y - pos.y) * ratio, pos.z);
        this.clamp();
    }

    private clamp(): void {
        const scale = this.node.scale.x;
        if (scale <= this.minScale + 0.001) {
            this.node.setScale(1, 1, 1);
            this.node.setPosition(this.rest);
            this.onViewChanged?.();
            return;
        }
        const board = this.node.getComponent(UITransform);
        const frame = this.viewport?.getComponent(UITransform);
        const scaledW = (board?.contentSize.width ?? 600) * scale;
        const scaledH = (board?.contentSize.height ?? 720) * scale;
        const windowW = frame?.contentSize.width ?? 660;
        const windowH = frame?.contentSize.height ?? 760;
        const frameLeft = -(frame?.anchorPoint.x ?? 0.5) * windowW;
        const frameBottom = -(frame?.anchorPoint.y ?? 0.5) * windowH;
        const anchorX = board?.anchorPoint.x ?? 0.5;
        const anchorY = board?.anchorPoint.y ?? 0.5;
        // 四周留出半个窗口，放大后仍能把背景拖出来。
        const x = this.limitAxis(
            this.node.position.x, anchorX, scaledW, frameLeft, frameLeft + windowW, windowW * 0.5
        );
        const y = this.limitAxis(
            this.node.position.y, anchorY, scaledH, frameBottom, frameBottom + windowH, windowH * 0.5
        );
        this.node.setPosition(x, y, this.node.position.z);
        this.onViewChanged?.();
    }

    /** 拼图可贴着窗口，也可以再往外移一段，露出后面的背景。 */
    private limitAxis(
        center: number,
        anchor: number,
        length: number,
        low: number,
        high: number,
        inset: number
    ): number {
        const atLow = low + anchor * length;
        const atHigh = high - (1 - anchor) * length;
        const min = Math.min(atLow, atHigh) - inset;
        const max = Math.max(atLow, atHigh) + inset;
        return Math.min(max, Math.max(min, center));
    }

    private readPoints(event: EventTouch): Vec2[] {
        // getTouches() includes only changed fingers; pinch needs ALL active ones.
        return event.getAllTouches().filter(touch => this.touchIds.has(touch.getID()))
            .map(touch => touch.getUILocation());
    }

    private contains(point: Vec2): boolean {
        const ui = (this.viewport ?? this.node).getComponent(UITransform);
        if (!ui) return false;
        const local = ui.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        return local.x >= -ui.width * ui.anchorX && local.x <= ui.width * (1 - ui.anchorX) &&
            local.y >= -ui.height * ui.anchorY && local.y <= ui.height * (1 - ui.anchorY);
    }

    private toParent(point: Vec2): Vec3 {
        const parent = this.node.parent?.getComponent(UITransform);
        const raw = new Vec3(point.x, point.y, 0);
        return parent ? parent.convertToNodeSpaceAR(raw) : raw;
    }
}
