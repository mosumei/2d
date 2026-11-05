
import { sys } from 'cc';

interface ProgressData {
    highestUnlockedLevel: number;
    lastPlayedLevel: number;
    levelRecords?: Record<string, {
        bestStars: number;
        bestMoves: number;
    }>;
}

/** 正式版本目前做到第二关。 */
export const MAX_LEVEL = 2;

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
                    ? Math.min(MAX_LEVEL, highest)
                    : 1;

            const lastPlayedLevel =
                Number.isSafeInteger(last) &&
                last >= 1 &&
                last <= highestUnlockedLevel
                    ? Math.min(MAX_LEVEL, last)
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

        return Math.max(1, Math.min(level, Math.min(MAX_LEVEL, cap)));
    }

    public static continueGame() {
        this.selectedLevel = null;
    }

    private static gameEntryAllowed = false;

    /**
     * 从首页或选关进入游戏。直接打开游戏场景时不会放行。
     */
    public static allowGameEntry(): void {
        this.gameEntryAllowed = true;
    }

    /**
     * 读取并清掉这次进入许可。只在游戏场景启动时调用一次。
     */
    public static takeGameEntry(): boolean {
        const allowed = this.gameEntryAllowed;
        this.gameEntryAllowed = false;
        return allowed;
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
            finished < MAX_LEVEL
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
        return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL ? level : null;
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
