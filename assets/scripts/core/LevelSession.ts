
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
        'jewel_crush_progress_v1';

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

        const level =
            this.selectedLevel ?? progress.lastPlayedLevel;

        this.selectedLevel = null;

        return Math.max(
            1,
            Math.min(level, progress.highestUnlockedLevel)
        );
    }

    public static continueGame() {
        this.selectedLevel = null;
    }
}
