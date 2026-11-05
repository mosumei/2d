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
        const jobs = ILLUSTRATED_COLORS.map((color) => {
            const name = assetName(color);
            return Promise.all([
                loadFrame(`gems/gem_${name}/spriteFrame`),
                loadFrame(`gems/socket_${name}/spriteFrame`)
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
