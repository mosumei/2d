import { resources, SpriteFrame } from 'cc';

import type { GemColor } from './GemCell';

export type TileFrames = Partial<Record<GemColor, SpriteFrame>>;

export type TileSet = {
    tiles: TileFrames;
    targets: TileFrames;
};

let cached: TileSet | null = null;
let loading: Promise<TileSet> | null = null;

/** 珍珠、四边形、八边形。地址 ?gem=square 或 ?gem=octagon，缺省是珍珠。 */
export type GemStyle = 'pearl' | 'square' | 'octagon';

const gemStyle = readGemStyle();

/** 当前珠子样式。整局只在启动时读一次地址。 */
export function currentGemStyle(): GemStyle {
    return gemStyle;
}

const ILLUSTRATED_COLORS: GemColor[] = [
    'yellow', 'blue', 'red', 'black', 'white', 'pink', 'green',
    'darkRed', 'orange', 'brown', 'olive', 'teal', 'navy', 'purple'
];

function assetName(color: GemColor): string {
    switch (color) {
        case 'darkRed': return 'dark_red';
        case 'yellow':
        case 'blue':
        case 'red':
        case 'black':
        case 'white':
        case 'pink':
        case 'green':
        case 'orange':
        case 'brown':
        case 'olive':
        case 'teal':
        case 'navy':
        case 'purple':
            return color;
        case 'gray':
            return '';
        default: {
            const unknown: never = color;
            return unknown;
        }
    }
}

function readGemStyle(): GemStyle {
    if (typeof location === 'undefined') return 'pearl';
    const value = new URLSearchParams(location.search).get('gem');
    if (value === 'square' || value === 'octagon') return value;
    return 'pearl';
}

/** 四边形、八边形目前各有 6 颗珠子。没有的颜色用现有珠子里最接近的一颗。 */
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
    if (gemStyle === 'pearl') {
        const name = assetName(color);
        return name ? `gems/pearl/gem_${name}/spriteFrame` : '';
    }
    return `gems/${gemStyle}/gem_${shapedGemName(color)}/spriteFrame`;
}

/** 棋盘上的孔跟着珠子样式走。珍珠用圆孔，另外两种用现有的方孔或八边孔。 */
function socketPath(color: GemColor): string {
    if (gemStyle === 'pearl') {
        const name = assetName(color);
        return name ? `gems/pearl/socket_${name}/spriteFrame` : '';
    }
    return `gems/${gemStyle}/socket_${shapedSocketName(color)}/spriteFrame`;
}

/** 托盘空孔。三套都先用原来的圆孔，方孔和八边孔的托盘图还没到。 */
export function trayWellPaths(): { well: string; faint: string } {
    return {
        well: 'ui/game/socket_well/spriteFrame',
        faint: 'ui/game/socket_well_faint/spriteFrame'
    };
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
        const colors: GemColor[] = gemStyle === 'pearl'
            ? ILLUSTRATED_COLORS
            : [...ILLUSTRATED_COLORS, 'gray'];
        console.info(`[TileSprites] 珠子样式 ${gemStyle}`);
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
