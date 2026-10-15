
import {
    _decorator,
    Component,
    JsonAsset,
    resources,
    sys
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
    private readonly SAVE_KEY = 'jewel_crush_progress_v1';

    private highestUnlockedLevel = 1;
    private lastPlayedLevel = 1;

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
    onLoad() {
    this.loadProgress();
}

    public loadLevel(
        level: number,
        callback: (data: LevelData | null) => void
    ) {
        if (this.loading) return;

        this.loading = true;

        const number = Math.max(1, Math.floor(level));

        const text = number < 10 ? `0${number}` : `${number}`;
        const fileName = `levels/level_${text}`;

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

    // 读取本地存档
    public loadProgress() {
        try {
            const raw = sys.localStorage.getItem(this.SAVE_KEY);

            if (!raw) {
                console.log('[Save] 新玩家，从第一关开始');
                return;
            }

            const data = JSON.parse(raw);

            const unlocked = Number(data.highestUnlockedLevel);
            const last = Number(data.lastPlayedLevel);

            this.highestUnlockedLevel =
                Number.isSafeInteger(unlocked) && unlocked >= 1
                    ? unlocked
                    : 1;

            this.lastPlayedLevel =
                Number.isSafeInteger(last) &&
                    last >= 1 &&
                    last <= this.highestUnlockedLevel
                    ? last
                    : 1;

            console.log(
                '[Save] 读取存档成功',
                this.highestUnlockedLevel,
                this.lastPlayedLevel
            );
        } catch (error) {
            console.error('[Save] 读取存档失败', error);
        }
    }

    // 保存本地存档
    private saveProgress() {
        const data = {
            highestUnlockedLevel: this.highestUnlockedLevel,
            lastPlayedLevel: this.lastPlayedLevel
        };

        try {
            sys.localStorage.setItem(
                this.SAVE_KEY,
                JSON.stringify(data)
            );

            console.log('[Save] 存档保存成功', data);
        } catch (error) {
            console.error('[Save] 保存失败', error);
        }
    }

    // 通关后解锁下一关
    public unlockNextLevel() {
        const next = this.currentLevel + 1;

        if (next > this.highestUnlockedLevel) {
            this.highestUnlockedLevel = next;
        }

        this.saveProgress();

        console.log(
            `[Save] 已解锁 LEVEL ${this.highestUnlockedLevel}`
        );
    }

    // 获取最高解锁关卡
    public getHighestUnlockedLevel(): number {
        return this.highestUnlockedLevel;
    }

    // 获取上次游玩的关卡
    public getLastPlayedLevel(): number {
        return this.lastPlayedLevel;
    }

    // 记录进入的关卡
    public setLastPlayedLevel(level: number) {
        if (level < 1 || level > this.highestUnlockedLevel) {
            return;
        }

        this.lastPlayedLevel = level;
        this.saveProgress();
    }

    // 开发测试用：重置存档
    public resetProgress() {
        this.currentLevel = 1;
        this.highestUnlockedLevel = 1;
        this.lastPlayedLevel = 1;

        sys.localStorage.removeItem(this.SAVE_KEY);

        console.log('[Save] 存档已重置');
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
