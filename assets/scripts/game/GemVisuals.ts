import { Color, Graphics, Layers, Node, Sprite, UITransform } from 'cc';
import type { GemColor } from './GemCell';

// Yellow, blue, red, black, green and pink use the imported spheres.
// White and gray stay vector beads because the new set has no matching art.
export const BEAD_COLORS: Record<GemColor, [number, number, number]> = {
    yellow: [246, 187, 48], blue: [57, 109, 220], red: [242, 91, 70],
    black: [65, 80, 91], white: [224, 216, 196], pink: [245, 139, 179],
    green: [67, 190, 137], gray: [143, 147, 140]
};
export type GemPalette = Partial<Record<GemColor, [number, number, number]>>;
let activePalette: Record<GemColor, [number, number, number]> = { ...BEAD_COLORS };

/** Reset on EVERY level load so chart-specific colors never leak into other levels. */
export function configureGemPalette(palette?: GemPalette): void {
    activePalette = { ...BEAD_COLORS, ...(palette ?? {}) };
}

const ILLUSTRATED: ReadonlySet<GemColor> = new Set([
    'yellow', 'blue', 'red', 'black', 'green', 'pink'
]);

/** True when this color should show the imported sphere instead of a vector bead. */
export function usesIllustratedGem(color: GemColor): boolean {
    return ILLUSTRATED.has(color);
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
