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

/** 八边形目前有 6 颗珠子。没有的颜色用现有珠子里最接近的一颗。 */
function shapedGemName(color: GemColor): string {
    switch (color) {
        case 'white': return 'white';
        case 'yellow':
        case 'orange':
        case 'brown': return 'yellow';
        case 'red':
        case 'pink':
        case 'darkRed': return 'red';
        case 'green':
        case 'teal':
        case 'olive': return 'green';
        case 'blue':
        case 'navy':
        case 'purple': return 'blue';
        case 'black':
        case 'gray': return 'gray';
        default: {
            const unknown: never = color;
            return unknown;
        }
    }
}

/** 孔也只有 6 张，按珠子的颜色配最接近的一张。 */
function shapedSocketName(color: GemColor): string {
    switch (color) {
        case 'white': return 'light';
        case 'yellow':
        case 'orange':
        case 'brown': return 'gold';
        case 'red':
        case 'pink':
        case 'darkRed': return 'dark_red';
        case 'green':
        case 'teal':
        case 'olive': return 'green_dark';
        case 'blue':
        case 'navy':
        case 'purple': return 'blue_dark';
        case 'black':
        case 'gray': return 'black';
        default: {
            const unknown: never = color;
            return unknown;
        }
    }
}

function gemPath(color: GemColor): string {
    return `gems/octagon/gem_${shapedGemName(color)}/spriteFrame`;
}

/** 棋盘上的孔用八边形插槽。 */
function socketPath(color: GemColor): string {
    return `gems/octagon/socket_${shapedSocketName(color)}/spriteFrame`;
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
