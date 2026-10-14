
import {
    _decorator,
    Component,
    JsonAsset,
    resources
} from 'cc';

const { ccclass } = _decorator;

export interface LevelData {
    id: number;
    name: string;
    rows: number;
    cols: number;
    trayCapacity: number;
    target: string[];
    initialSwaps: number[][];
}

@ccclass('LevelManager')
export class LevelManager extends Component {

    private currentLevel = 1;

    // 防止多个关卡同时加载
    private loading = false;

    public getCurrentLevel(): number {
        return this.currentLevel;
    }

    public setCurrentLevel(level: number) {
        this.currentLevel = Math.max(1, Math.floor(level));
    }

    public isLoading(): boolean {
        return this.loading;
    }

    public loadLevel(
        level: number,
        callback: (data: LevelData | null) => void
    ) {
        if (this.loading) return;

        this.loading = true;

        const number = Math.max(1, Math.floor(level));

        const fileName =
            `levels/level_${String(number).padStart(2, '0')}`;

        console.log('[LevelManager] 加载', fileName);

        resources.load(
            fileName,
            JsonAsset,
            (error, asset) => {

                this.loading = false;

                if (error || !asset) {
                    console.error(
                        `[LevelManager] 关卡 ${number} 加载失败`,
                        error
                    );
                    callback(null);
                    return;
                }

                const data = asset.json as LevelData;

                if (!this.validateLevel(data)) {
                    callback(null);
                    return;
                }

                this.currentLevel = number;

                console.log(
                    `[LevelManager] LEVEL ${number} 加载成功`
                );

                callback(data);
            }
        );
    }

    private validateLevel(data: LevelData): boolean {
        if (
            !data ||
            !Number.isInteger(data.rows) ||
            !Number.isInteger(data.cols) ||
            data.rows <= 0 ||
            data.cols <= 0 ||
            !Array.isArray(data.target) ||
            data.target.length !== data.rows ||
            data.target.some(
                row => typeof row !== 'string' ||
                       row.length !== data.cols ||
                       !/^[YBR.]+$/.test(row)
            ) ||
            !Number.isInteger(data.trayCapacity) ||
            data.trayCapacity < 1 ||
            !Array.isArray(data.initialSwaps)
        ) {
            console.error(
                '[LevelManager] 关卡数据格式错误',
                data
            );
            return false;
        }

        for (const swap of data.initialSwaps) {
            if (
                !Array.isArray(swap) ||
                swap.length !== 4 ||
                !swap.every(Number.isInteger)
            ) {
                console.error('交换配置错误', swap);
                return false;
            }

            const [r1, c1, r2, c2] = swap;

            if (
                r1 < 0 || r1 >= data.rows ||
                r2 < 0 || r2 >= data.rows ||
                c1 < 0 || c1 >= data.cols ||
                c2 < 0 || c2 >= data.cols ||
                data.target[r1][c1] === '.' ||
                data.target[r2][c2] === '.'
            ) {
                console.error('交换坐标无效', swap);
                return false;
            }
        }

        return true;
    }
}
