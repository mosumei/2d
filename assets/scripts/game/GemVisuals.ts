import { Color, Graphics, Layers, Node, Sprite, UITransform } from 'cc';
import type { GemColor } from './GemCell';

// 灰色有 gem_gray。其余颜色用 gems/octagon/ 里最接近的珠子。
export const BEAD_COLORS: Record<GemColor, [number, number, number]> = {
    yellow: [230, 190, 40], blue: [40, 80, 200], red: [210, 40, 40],
    black: [40, 48, 46], white: [236, 236, 236], pink: [180, 40, 110],
    green: [40, 160, 70], gray: [143, 147, 140],
    darkRed: [160, 40, 32], orange: [230, 110, 30], brown: [170, 110, 50],
    olive: [170, 180, 50], teal: [40, 140, 140], navy: [30, 50, 140],
    purple: [120, 50, 180]
};
export type GemPalette = Partial<Record<GemColor, [number, number, number]>>;
let activePalette: Record<GemColor, [number, number, number]> = { ...BEAD_COLORS };

/** Reset on EVERY level load so chart-specific colors never leak into other levels. */
export function configureGemPalette(palette?: GemPalette): void {
    activePalette = { ...BEAD_COLORS, ...(palette ?? {}) };
}

const ILLUSTRATED: ReadonlySet<GemColor> = new Set([
    'yellow', 'blue', 'red', 'black', 'white', 'pink', 'green', 'gray',
    'darkRed', 'orange', 'brown', 'olive', 'teal', 'navy', 'purple'
]);

/** 这些颜色用八边形切图。 */
export function usesIllustratedGem(color: GemColor): boolean {
    return ILLUSTRATED.has(color);
}

/** 珠子相对插槽的边长。插槽为 1 时珠子是 0.85。 */
export const ILLUSTRATED_GEM_RATIO = 0.85;

/** 没有切图时，矢量珠相对格子的边长。 */
export const VECTOR_GEM_RATIO = 0.72;

/** 插图珠相对格子或托盘孔的边长比例。 */
export function illustratedGemRatio(): number {
    return ILLUSTRATED_GEM_RATIO;
}

/**
 * 珠子画在插槽上的边长。
 * @param color 珠子颜色
 * @param slotSize 插槽边长
 */
export function gemDrawSize(color: GemColor, slotSize: number): number {
    return slotSize * (usesIllustratedGem(color) ? illustratedGemRatio() : VECTOR_GEM_RATIO);
}

const beadColors = new WeakMap<Node, GemColor>();
export function readBeadColor(node: Node): GemColor | undefined {
    return beadColors.get(node);
}
function shade(rgb: number[], amount: number, alpha = 255): Color {
    return new Color(...rgb.map(value => Math.round(amount >= 0
        ? value + (255 - value) * amount : value * (1 + amount))) as [number, number, number], alpha);
}
function visual(parent: Node, name: string, size: number): Graphics {
    let node = parent.getChildByName(name);
    if (!node) {
        node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        // Children are decorative: GemCell / TraySlot owns the touch target.
        node.addComponent(UITransform);
    }
    node.getComponent(UITransform)!.setContentSize(size, size);
    const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    g.clear();
    return g;
}
function octagon(x: number, y: number, r: number): [number, number][] {
    const a = r * 0.54;
    return [[x-a,y+r],[x+a,y+r],[x+r,y+a],[x+r,y-a],
        [x+a,y-r],[x-a,y-r],[x-r,y-a],[x-r,y+a]];
}
function polygon(g: Graphics, points: [number, number][], color: Color): void {
    g.fillColor = color;
    g.moveTo(points[0][0], points[0][1]);
    for (let i=1; i<points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.close(); g.fill();
}
export function drawBead(node: Node, size: number, color: GemColor): void {
    beadColors.set(node, color);
    const sprite = node.getComponent(Sprite);
    const drawn = node.getChildByName('BeadVisual');
    if (usesIllustratedGem(color) && sprite?.spriteFrame) {
        sprite.enabled = true;
        placeGemFill(sprite, size);
        if (drawn) drawn.active = false;
        return;
    }
    if (sprite) sprite.enabled = false;
    if (drawn) drawn.active = true;
    const g = visual(node, 'BeadVisual', size);
    const rgb = activePalette[color], r = size * 0.48;
    polygon(g, octagon(0, -r * 0.08, r * 1.03), shade(rgb, -0.52));
    const outer = octagon(0, 0, r);
    const inner = octagon(0, r * 0.09, r * 0.68);
    const facets = [0.40, 0.24, -0.08, -0.22, -0.30, -0.20, 0.03, 0.27];
    for (let i=0; i<8; i++) {
        const next = (i+1)%8;
        polygon(g, [outer[i], outer[next], inner[next], inner[i]], shade(rgb, facets[i]));
    }
    polygon(g, inner, shade(rgb, 0.09));
    polygon(g, octagon(-r * 0.20, r * 0.29, r * 0.27), shade(rgb, 0.44, 115));
}
const SOCKET_TILE = 180;

/**
 * 按切图矩形把精灵铺进给定边长。插槽和棋子共用这一套。
 * @param sprite 精灵
 * @param size 目标边长
 * @param bleed 四周多伸出的像素
 * @param tileCap 切图里算作满铺的一边
 */
function placeFrame(sprite: Sprite, size: number, bleed: number, tileCap: number): void {
    const frame = sprite.spriteFrame;
    const ui = sprite.getComponent(UITransform);
    if (!frame || !ui) return;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.type = Sprite.Type.SIMPLE;
    sprite.trim = true;
    const width = frame.rect.width;
    const height = frame.rect.height;
    if (width < 1 || height < 1 || tileCap < 1) {
        ui.setContentSize(size, size);
        sprite.node.setPosition(0, 0, 0);
        return;
    }
    const tile = Math.min(width, tileCap);
    const insetX = (width - tile) / 2;
    const insetTop = width > tileCap ? (width - tileCap) / 2 : 0;
    const cover = size + bleed;
    const nodeW = cover * (width / tile);
    const nodeH = cover * (height / tile);
    ui.setContentSize(nodeW, nodeH);
    const dx = (width / 2 - (insetX + tile / 2)) / width * nodeW;
    const dy = ((insetTop + tile / 2) - height / 2) / height * nodeH;
    sprite.node.setPosition(dx, dy, 0);
}

/** 把原来的珠子切图铺进给定边长。 */
export function placeGemFill(sprite: Sprite, size: number): void {
    placeFrame(sprite, size, 0, sprite.spriteFrame?.rect.width ?? size);
}

/**
 * 把插槽切图里的色块铺满格子，并多伸出 1 像素压住接缝。
 * @param sprite 插槽精灵
 * @param size 格子边长
 */
export function placeSocketFill(sprite: Sprite, size: number): void {
    placeFrame(sprite, size, 1, SOCKET_TILE);
}

export function drawSocket(node: Node, size: number, color: GemColor): void {
    const sprite = node.getComponent(Sprite);
    const drawn = node.getChildByName('SocketVisual');
    if (usesIllustratedGem(color) && sprite?.spriteFrame) {
        sprite.enabled = true;
        if (drawn) drawn.active = false;
        return;
    }
    if (sprite) sprite.enabled = false;
    if (drawn) drawn.active = true;
    const g = visual(node, 'SocketVisual', size);
    const rgb = activePalette[color], half = size / 2;
    g.fillColor = shade(rgb, -0.47);
    g.rect(-half, -half, size, size); g.fill();
    g.fillColor = shade(rgb, -0.11);
    g.rect(-half + size * 0.035, -half + size * 0.05, size * 0.93, size * 0.90); g.fill();
    polygon(g, octagon(0, 0, size * 0.40), shade(rgb, 0.29));
    polygon(g, octagon(0, size * 0.015, size * 0.37), shade(rgb, -0.39));
    polygon(g, octagon(0, -size * 0.045, size * 0.30), shade(rgb, -0.22));
}

/** 托盘空位上的圆孔，外圈压暗，上沿留阴影，下沿留亮边。 */
export function drawShelfSocket(g: Graphics, size: number): void {
    const radius = size * 0.42;
    g.fillColor = new Color(168, 132, 92, 255);
    g.circle(0, 0, radius);
    g.fill();
    g.fillColor = new Color(255, 232, 206, 255);
    g.circle(0, -radius * 0.12, radius * 0.76);
    g.fill();
    g.fillColor = new Color(255, 252, 246, 255);
    g.circle(0, -radius * 0.38, radius * 0.58);
    g.fill();
    g.fillColor = new Color(255, 236, 214, 255);
    g.circle(0, -radius * 0.18, radius * 0.52);
    g.fill();
}
