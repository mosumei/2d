import { resources, SpriteFrame } from 'cc';

import type { GemColor } from './GemCell';

export type TileFrames = Partial<Record<GemColor, SpriteFrame>>;

export type TileSet = {
    tiles: TileFrames;
    targets: TileFrames;
};

let cached: TileSet | null = null;
let loading: Promise<TileSet> | null = null;

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
        loading = Promise.all([
            loadFrame('gems/gem_blue/spriteFrame'),
            loadFrame('gems/gem_black/spriteFrame'),
            loadFrame('gems/gem_yellow/spriteFrame'),
            loadFrame('gems/gem_green/spriteFrame'),
            loadFrame('gems/gem_red/spriteFrame'),
            loadFrame('gems/gem_pink/spriteFrame'),
            loadFrame('gems/socket_blue/spriteFrame'),
            loadFrame('gems/socket_black/spriteFrame'),
            loadFrame('gems/socket_yellow/spriteFrame'),
            loadFrame('gems/socket_green/spriteFrame'),
            loadFrame('gems/socket_red/spriteFrame'),
            loadFrame('gems/socket_pink/spriteFrame')
        ]).then(([
            blue, black, yellow, green, red, pink,
            blueTarget, blackTarget, yellowTarget, greenTarget, redTarget, pinkTarget
        ]) => {
            cached = {
                tiles: {
                    blue: blue ?? undefined,
                    black: black ?? undefined,
                    yellow: yellow ?? undefined,
                    green: green ?? undefined,
                    red: red ?? undefined,
                    pink: pink ?? undefined
                },
                targets: {
                    blue: blueTarget ?? undefined,
                    black: blackTarget ?? undefined,
                    yellow: yellowTarget ?? undefined,
                    green: greenTarget ?? undefined,
                    red: redTarget ?? undefined,
                    pink: pinkTarget ?? undefined
                }
            };
            return cached;
        });
    }

    return loading;
}
