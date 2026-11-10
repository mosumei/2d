import { Graphics, Size, UITransform, view } from 'cc';

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

/**
 * 当前屏幕在设计分辨率下能看到的尺寸。
 * 只按宽度适配时，更高的手机会让高度大于 1280。
 */
export function visibleCanvasSize(): Size {
    const visible = view.getVisibleSize();
    return new Size(
        Math.max(DESIGN_WIDTH, Math.ceil(visible.width)),
        Math.max(DESIGN_HEIGHT, Math.ceil(visible.height))
    );
}

/**
 * 可见画面比 1280 高出的一半。
 * 靠顶的元素加上它，靠底的元素减去它，间距就跟着屏幕拉开。
 */
export function screenEdgeShift(): number {
    return (visibleCanvasSize().height - DESIGN_HEIGHT) / 2;
}

/** 把节点铺满当前可见画面，锚点保持在中心。 */
export function fillVisibleCanvas(transform: UITransform): Size {
    const size = visibleCanvasSize();
    transform.setContentSize(size.width, size.height);
    return size;
}

/** 在节点本地坐标里铺一块和可见画面一样大的矩形。 */
export function paintVisibleRect(graphics: Graphics, size: Size): void {
    graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height);
    graphics.fill();
}

/**
 * 齿轮和托盘之间的竖直中点。拼图首次出现时摆在这里。
 */
export function playfieldCenterY(): number {
    const shift = screenEdgeShift();
    const gearBottom = 559 + shift - 77 / 2 - 16;
    const trayTop = -354 - shift - 20;
    return (gearBottom + trayTop) / 2;
}

/**
 * 棋盘能占用的宽和高。
 * 左右各留 16。上面停在齿轮按钮下方，下面停在四行托盘上方。
 */
export function boardPlayfield(): Size {
    const screen = visibleCanvasSize();
    const shift = screenEdgeShift();
    const width = screen.width - 32;
    const gearBottom = 559 + shift - 77 / 2 - 16;
    const trayTop = -354 - shift - 20;
    const centerY = playfieldCenterY();
    const half = Math.min(gearBottom - centerY, centerY - trayTop);
    return new Size(width, Math.max(1, half * 2));
}
