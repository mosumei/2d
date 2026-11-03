
import { sys } from 'cc';

interface ProgressData {
    highestUnlockedLevel: number;
    lastPlayedLevel: number;
    levelRecords?: Record<string, {
        bestStars: number;
        bestMoves: number;
    }>;
}

export class LevelSession {

    private static readonly SAVE_KEY =
        'jewel_crush_progress_v2';

    private static readonly SHOWCASE_KEY =
        'jewel_crush_showcase_level';

    private static selectedLevel: number | null = null;

    public static getProgress(): ProgressData {
        const fallback: ProgressData = {
            highestUnlockedLevel: 1,
            lastPlayedLevel: 1,
            levelRecords: {}
        };

        try {
            const raw = sys.localStorage.getItem(
                this.SAVE_KEY
            );

            if (!raw) return fallback;

            const data = JSON.parse(raw);

            const highest = Number(
                data.highestUnlockedLevel
            );

            const last = Number(data.lastPlayedLevel);

            const highestUnlockedLevel =
                Number.isSafeInteger(highest) && highest >= 1
                    ? highest
                    : 1;

            const lastPlayedLevel =
                Number.isSafeInteger(last) &&
                last >= 1 &&
                last <= highestUnlockedLevel
                    ? last
                    : 1;

            return {
                highestUnlockedLevel,
                lastPlayedLevel,
                levelRecords:
                    data.levelRecords &&
                    typeof data.levelRecords === 'object' &&
                    !Array.isArray(data.levelRecords)
                        ? data.levelRecords
                        : {}
            };

        } catch (error) {
            console.error(
                '[LevelSession] 读取存档失败',
                error
            );
            return fallback;
        }
    }

    public static selectLevel(level: number): boolean {
        const progress = this.getProgress();

        if (
            !Number.isInteger(level) ||
            level < 1 ||
            level > progress.highestUnlockedLevel
        ) {
            return false;
        }

        this.selectedLevel = level;
        return true;
    }

    public static consumeStartLevel(): number {
        const progress = this.getProgress();

        const picked = this.selectedLevel;
        this.selectedLevel = null;
        const level = picked ?? this.getContinueLevel();
        const cap = picked === null
            ? Math.max(progress.highestUnlockedLevel, level)
            : progress.highestUnlockedLevel;

        return Math.max(1, Math.min(level, Math.min(7, cap)));
    }

    public static continueGame() {
        this.selectedLevel = null;
    }

    /**
     * 首页开始按钮要进的关卡。刚通关的那一关不再重复，改为下一关。
     */
    public static getContinueLevel(): number {
        const progress = this.getProgress();
        const finished = this.getShowcaseLevel();
        if (
            finished !== null &&
            progress.lastPlayedLevel <= finished &&
            finished < 7
        ) {
            return finished + 1;
        }
        return progress.lastPlayedLevel;
    }

    /**
     * 记下刚通关的关卡，首页花瓣框用它来显示作品。
     * @param level 刚完成的关卡编号
     */
    public static rememberCompletedLevel(level: number): void {
        if (!Number.isInteger(level) || level < 1) return;
        sys.localStorage.setItem(this.SHOWCASE_KEY, String(level));
    }

    /**
     * 最近一次通关的关卡。还没通关过时返回 null。
     */
    public static getShowcaseLevel(): number | null {
        const level = Number(sys.localStorage.getItem(this.SHOWCASE_KEY));
        return Number.isInteger(level) && level >= 1 ? level : null;
    }

    /**
     * 把已解锁关卡和星级再写进本机。没有存档时写入默认进度。
     */
    public static flushProgress(): void {
        const raw = sys.localStorage.getItem(this.SAVE_KEY);
        if (raw) {
            sys.localStorage.setItem(this.SAVE_KEY, raw);
            return;
        }

        const progress = this.getProgress();
        sys.localStorage.setItem(
            this.SAVE_KEY,
            JSON.stringify({
                highestUnlockedLevel: progress.highestUnlockedLevel,
                lastPlayedLevel: progress.lastPlayedLevel,
                levelRecords: progress.levelRecords ?? {}
            })
        );
    }
}
