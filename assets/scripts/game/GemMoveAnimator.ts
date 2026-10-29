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
    Color,
    Graphics,
    UIOpacity
} from 'cc';
import { drawBead, readBeadColor } from './GemVisuals';
import type { GemColor } from './GemCell';

const { ccclass } = _decorator;

const LIFT_TIME = 0.06;
const FLIGHT_TIME = 0.22;
const SETTLE_TIME = 0.11;

export interface GemMove {
    frame: SpriteFrame;
    from: Node;
    to: Node;
    startSize?: number;
    endSize?: number;
    delay?: number;

    /**
     * arc 是各自走短弧线。stack 是先叠成一摞再散开。
     * sequential 为 true 时，这颗要等到自己的 delay 结束才离位。
     */
    flight?: 'arc' | 'stack';
    sequential?: boolean;

    /**
     * 飞行替身出现时调用，用来藏起原来的那颗。
     */
    onDepart?: () => void;

    /**
     * 这颗棋子落稳时调用。只提交这一颗，不要等整批结束。
     */
    onArrive?: () => void;
}

@ccclass('GemMoveAnimator')
export class GemMoveAnimator extends Component {
    private cancelCurrent: (() => void) | null = null;

    public play(moves: GemMove[], onComplete: () => void): void {
        this.cancelCurrent?.();
        this.cancelCurrent = null;

        if (moves.length === 0) {
            onComplete();
            return;
        }

        if (moves.every(move => move.flight === 'stack')) {
            this.playStack(moves, onComplete);
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
            this.unschedule(watchdog);
            for (const land of pending) land();
            clearFlyers();
            if (this.cancelCurrent === finish) this.cancelCurrent = null;
            onComplete();
        };
        const watchdog = () => finish();
        this.cancelCurrent = finish;

        const parent = this.node.parent;
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);

        for (const move of moves) {
            if (!move.from?.isValid || !move.to?.isValid) continue;

            const gem = this.sourceGem(move.from);
            const shot = this.snapshot(parentUI, gem, move);
            const startPos = shot.start;
            const endPos = shot.end;
            const control = this.arcControl(startPos, endPos);
            const flyer = this.makeFlyer(shot.size, move.frame, shot.color);
            flyer.setPosition(startPos);

            const endScale = shot.endSize / shot.size;
            const lifted = new Vec3(1.12, 1.12, 1);
            const landed = new Vec3(endScale, endScale, 1);
            const squash = new Vec3(endScale * 1.12, endScale * 0.88, 1);
            const delay = Math.max(0, move.delay ?? 0);
            const sequential = move.sequential === true;
            if (delay > maxDelay) maxDelay = delay;
            const opacity = sequential ? flyer.addComponent(UIOpacity) : null;
            if (opacity) opacity.opacity = 0;
            else move.onDepart?.();
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

            const motion = tween(flyer);
            if (sequential) {
                motion.delay(delay).call(() => {
                    if (!flyer.isValid) return;
                    if (opacity) opacity.opacity = 255;
                    move.onDepart?.();
                });
            } else {
                motion.delay(delay);
            }
            motion
                .to(LIFT_TIME, { scale: lifted }, { easing: 'quadOut' })
                .to(FLIGHT_TIME, { scale: landed }, {
                    easing: 'sineOut',
                    onUpdate: (_target, ratio) => {
                        if (!flyer.isValid) return;
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
     * 进托盘：点中的那颗先弹起来，同色叠到它上面，再散开落下，落地闪白星。
     */
    private playStack(moves: GemMove[], onComplete: () => void): void {
        const parentUI = this.node.getComponent(UITransform);
        if (!parentUI || !moves[0]?.from?.isValid) {
            for (const move of moves) {
                move.onDepart?.();
                move.onArrive?.();
            }
            onComplete();
            return;
        }

        const parent = this.node.parent;
        if (parent) this.node.setSiblingIndex(parent.children.length - 1);

        const gatherTime = 0.16;
        const fallTime = 0.24;
        const stagger = 0.05;
        let settled = false;
        let completed = 0;
        let started = 0;
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
            this.unschedule(watchdog);
            for (const land of pending) land();
            clearFlyers();
            if (this.cancelCurrent === finish) this.cancelCurrent = null;
            onComplete();
        };
        const watchdog = () => finish();
        this.cancelCurrent = finish;

        const originGem = this.sourceGem(moves[0].from);
        const origin = parentUI.convertToNodeSpaceAR(originGem.worldPosition);

        moves.forEach((move, index) => {
            if (!move.from?.isValid || !move.to?.isValid) return;
            const gem = this.sourceGem(move.from);
            const shot = this.snapshot(parentUI, gem, move);
            const startPos = shot.start;
            const endPos = shot.end;
            const pile = new Vec3(origin.x, origin.y + index * 7, 0);
            const spread = (index - (moves.length - 1) / 2) * 16;
            const control = new Vec3(
                startPos.x * 0.25 + endPos.x * 0.75 + spread,
                pile.y * 0.4 + endPos.y * 0.6,
                0
            );
            const flyer = this.makeFlyer(shot.size, move.frame, shot.color);
            flyer.setPosition(startPos);
            move.onDepart?.();

            const endScale = shot.endSize / shot.size;
            const popped = new Vec3(1.2, 1.2, 1);
            const piled = new Vec3(1.08, 1.08, 1);
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
                this.sparkle(endPos);
                completed += 1;
                if (!settled && completed >= started) this.scheduleOnce(finish, 0);
            };
            pending.push(land);
            started += 1;

            const sequence = tween(flyer);
            if (index === 0) {
                sequence
                    .to(0.1, { scale: popped }, { easing: 'quadOut' })
                    .delay(0.12);
            } else {
                sequence
                    .delay(0.06)
                    .to(gatherTime, { position: pile, scale: piled }, { easing: 'quadOut' })
                    .delay(index * stagger);
            }
            sequence
                .to(fallTime, { scale: landed }, {
                    easing: 'sineIn',
                    onUpdate: (_target, ratio) => {
                        if (!flyer.isValid) return;
                        const t = ratio ?? 0;
                        const u = 1 - t;
                        flyer.setPosition(
                            u * u * pile.x + 2 * u * t * control.x + t * t * endPos.x,
                            u * u * pile.y + 2 * u * t * control.y + t * t * endPos.y,
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
        });

        if (started === 0) {
            finish();
            return;
        }

        this.scheduleOnce(
            watchdog,
            0.22 + stagger * Math.max(0, moves.length - 1) + fallTime + SETTLE_TIME + 0.4
        );
    }

    /**
     * 飞行中点往侧面拱起，形成一条平滑短弧线。
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

    private sourceGem(from: Node): Node {
        return from.getChildByName('GemSprite')
            ?? from.getChildByName('GemImage')
            ?? from;
    }

    private snapshot(layer: UITransform, gem: Node, move: GemMove): {
        start: Vec3;
        end: Vec3;
        size: number;
        endSize: number;
        color: GemColor | undefined;
    } {
        const width = gem.getComponent(UITransform)?.width ?? move.startSize ?? 46;
        const worldScale = Math.abs(gem.worldScale.x / Math.max(0.0001, this.node.worldScale.x));
        const size = Math.max(1, width * worldScale);
        return {
            start: layer.convertToNodeSpaceAR(gem.worldPosition),
            end: layer.convertToNodeSpaceAR(move.to.worldPosition),
            size,
            endSize: Math.max(1, move.endSize === undefined ? size : move.endSize *
                Math.abs(move.to.worldScale.x / Math.max(0.0001, this.node.worldScale.x))),
            color: readBeadColor(gem)
        };
    }

    private makeFlyer(size: number, frame: SpriteFrame, color: GemColor | undefined): Node {
        const flyer = new Node('GemFlyer');
        flyer.layer = Layers.Enum.UI_2D;
        flyer.parent = this.node;
        const ui = flyer.addComponent(UITransform);
        ui.setContentSize(size, size);
        const sprite = flyer.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        sprite.color = Color.WHITE;
        if (color) drawBead(flyer, size, color);
        return flyer;
    }

    /**
     * 棋子落进托盘时的一小片白星。动画结束后再删，避免卡在回调里。
     */
    private sparkle(at: Vec3): void {
        const node = new Node('LandSpark');
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.node;
        node.setPosition(at);
        node.addComponent(UITransform).setContentSize(36, 36);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(255, 255, 255, 230);
        graphics.moveTo(0, 14);
        graphics.lineTo(3, 3);
        graphics.lineTo(14, 0);
        graphics.lineTo(3, -3);
        graphics.lineTo(0, -14);
        graphics.lineTo(-3, -3);
        graphics.lineTo(-14, 0);
        graphics.lineTo(-3, 3);
        graphics.close();
        graphics.fill();
        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 255;
        node.setScale(0.55, 0.55, 1);
        tween(node).to(0.28, { scale: new Vec3(1.25, 1.25, 1) }).start();
        tween(opacity).to(0.28, { opacity: 0 }).start();
        this.scheduleOnce(() => {
            if (!node.isValid) return;
            Tween.stopAllByTarget(node);
            Tween.stopAllByTarget(opacity);
            node.destroy();
        }, 0.32);
    }

    onDestroy(): void {
        this.cancelCurrent = null;
        this.unscheduleAllCallbacks();
        for (const node of [...this.node.children]) {
            Tween.stopAllByTarget(node);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
        }
    }
}
