import { resources, SpriteFrame } from 'cc';

import type { GemColor } from './GemCell';

export type TileFrames = Partial<Record<GemColor, SpriteFrame>>;

export type TileSet = {
    tiles: TileFrames;
    targets: TileFrames;
};

let cached: TileSet | null = null;
let loading: Promise<TileSet> | null = null;

const ILLUSTRATED_COLORS: GemColor[] = [
    'yellow', 'blue', 'red', 'black', 'white', 'pink', 'green', 'gray',
    'darkRed', 'orange', 'brown', 'olive', 'teal', 'navy', 'purple'
];

/**
 * 珠子图。黄用 palette 土黄，蓝用淡蓝。灰色、粉色也在 palette。黑色轮廓仍用八边形深灰珠。
 */
function gemAsset(color: GemColor): string {
    switch (color) {
        case 'white': return 'octagon/gem_white';
        case 'yellow': return 'octagon/palette/gem_ochre';
        case 'orange': return 'octagon/gem_orange';
        case 'brown': return 'octagon/gem_brown';
        case 'red': return 'octagon/gem_red';
        case 'pink': return 'octagon/palette/gem_pink';
        case 'darkRed': return 'octagon/gem_dark_red';
        case 'green': return 'octagon/gem_green';
        case 'teal': return 'octagon/gem_teal';
        case 'olive': return 'octagon/palette/gem_ochre';
        case 'blue': return 'octagon/palette/gem_light_blue';
        case 'navy': return 'octagon/gem_navy';
        case 'purple': return 'octagon/gem_purple';
        case 'black': return 'octagon/gem_gray';
        case 'gray': return 'octagon/palette/gem_gray';
        default: {
            const unknown: never = color;
            return unknown;
        }
    }
}

/**
 * 插槽图。白色孔是浅灰空板。灰色用 palette 的灰框，黑色仍用深色孔。
 */
function socketAsset(color: GemColor): string {
    switch (color) {
        case 'white': return 'octagon/socket_light';
        case 'yellow': return 'octagon/palette/socket_ochre';
        case 'orange': return 'octagon/socket_orange';
        case 'brown': return 'octagon/socket_brown';
        case 'red': return 'octagon/socket_red';
        case 'pink': return 'octagon/palette/socket_pink';
        case 'darkRed': return 'octagon/socket_dark_red';
        case 'green': return 'octagon/socket_green_dark';
        case 'teal': return 'octagon/socket_teal';
        case 'olive': return 'octagon/palette/socket_ochre';
        case 'blue': return 'octagon/palette/socket_light_blue';
        case 'navy': return 'octagon/socket_navy';
        case 'purple': return 'octagon/socket_purple';
        case 'black': return 'octagon/socket_black';
        case 'gray': return 'octagon/palette/socket_gray';
        default: {
            const unknown: never = color;
            return unknown;
        }
    }
}

function gemPath(color: GemColor): string {
    return `gems/${gemAsset(color)}/spriteFrame`;
}

/** 棋盘上的孔用对应插槽。 */
function socketPath(color: GemColor): string {
    return `gems/${socketAsset(color)}/spriteFrame`;
}

/** 托盘空孔用八边形浅色板。 */
export function trayWellPaths(): { well: string; faint: string } {
    const plate = 'gems/octagon/socket_light/spriteFrame';
    return { well: plate, faint: plate };
}

function loadFrame(path: string): Promise<SpriteFrame | null> {
    return new Promise((resolve) => {
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame) {
                console.error(`[TileSprites] 加载 ${path} 失败`, error);
                resolve(null);
                return;
            }
            resolve(frame);
        });
    });
}

export function loadTileSet(): Promise<TileSet> {
    if (cached) {
        return Promise.resolve(cached);
    }

    if (!loading) {
        const colors = ILLUSTRATED_COLORS;
        console.info('[TileSprites] 珠子样式 octagon');
        const jobs = colors.map((color) => {
            const gemFile = gemPath(color);
            const socketFile = socketPath(color);
            return Promise.all([
                gemFile ? loadFrame(gemFile) : Promise.resolve(null),
                socketFile ? loadFrame(socketFile) : Promise.resolve(null)
            ]).then(([gem, socket]) => ({ color, gem, socket }));
        });
        loading = Promise.all(jobs).then((loaded) => {
            const tiles: TileFrames = {};
            const targets: TileFrames = {};
            for (const item of loaded) {
                if (item.gem) tiles[item.color] = item.gem;
                if (item.socket) targets[item.color] = item.socket;
            }
            cached = { tiles, targets };
            return cached;
        });
    }

    return loading;
}
