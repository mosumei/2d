import { sys } from 'cc';

export interface CollectedArtifact {
    level: number;
    collectedAt: string;
}

// 路径不带 resources/ 和后缀；后续关卡在这里增加配置。
export const ARTIFACTS: Record<number, { name: string; image: string }> = {
    1: { name: '蓝灰之心', image: 'artifacts/level_01_vase' }
};

export class ArtifactCollectionManager {
    private static readonly KEY = 'jewel_restored_artifacts_v1';

    static getAll(): CollectedArtifact[] {
        try {
            const stored = sys.localStorage.getItem(this.KEY);
            if (!stored) return [];
            const parsed: unknown = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((item): item is CollectedArtifact =>
                item != null && Number.isInteger(item.level) &&
                item.level > 0 && typeof item.collectedAt === 'string'
            ).sort((a, b) => a.level - b.level);
        } catch (e) {
            console.warn('[Collection] 读取失败', e);
            return [];
        }
    }

    static has(level: number): boolean {
        return this.getAll().some(item => item.level === level);
    }

    // 返回 true 表示首次获得。
    static collect(level: number): boolean {
        if (!ARTIFACTS[level] || this.has(level)) return false;
        const records = this.getAll();
        records.push({ level, collectedAt: new Date().toISOString() });
        try {
            sys.localStorage.setItem(this.KEY, JSON.stringify(records));
            return true;
        } catch (e) {
            console.error('[Collection] 保存失败', e);
            return false;
        }
    }
}
