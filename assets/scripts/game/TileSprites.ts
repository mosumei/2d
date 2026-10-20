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
            loadFrame('gems/tile_blue/spriteFrame'),
            loadFrame('gems/tile_gray/spriteFrame'),
            loadFrame('gems/tile_blue_target/spriteFrame'),
            loadFrame('gems/tile_gray_target/spriteFrame')
        ]).then(([blue, gray, blueTarget, grayTarget]) => {
            cached = {
                tiles: {
                    blue: blue ?? undefined,
                    black: gray ?? undefined
                },
                targets: {
                    blue: blueTarget ?? undefined,
                    black: grayTarget ?? undefined
                }
            };
            return cached;
        });
    }

    return loading;
}
