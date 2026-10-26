import { TikTokAdsManager, RewardedAdResult } from '../platform/TikTokAdsManager';

/**
 * 魔法棒广告规则。
 * 第 1、2 关直接使用。第 3 关起必须完整看完激励视频。
 */
export class MagicWandAdGate {

    private static isProcessing = false;

    /**
     * 请求使用一次魔法棒。
     * @param levelNumber 当前正在玩的关卡，不是最高解锁关
     * @param useMagicWand 广告通过后才执行的魔法棒动作
     */
    public static async requestUse(
        levelNumber: number,
        useMagicWand: () => void
    ): Promise<RewardedAdResult> {
        if (this.isProcessing) {
            return 'busy';
        }

        this.isProcessing = true;

        try {
            if (levelNumber <= 2) {
                useMagicWand();
                return 'completed';
            }

            const result = await TikTokAdsManager.showRewardedAd();
            return this.grant(result, useMagicWand);
        } catch (error) {
            console.error('[MagicWand] 执行失败', error);
            return 'error';
        } finally {
            this.isProcessing = false;
        }
    }

    private static grant(
        result: RewardedAdResult,
        useMagicWand: () => void
    ): RewardedAdResult {
        switch (result) {
            case 'completed':
                useMagicWand();
                return 'completed';
            case 'closed':
            case 'unavailable':
            case 'error':
            case 'busy':
                console.log('[MagicWand] 广告未完成，不执行魔法棒', result);
                return result;
            default: {
                const unknown: never = result;
                void unknown;
                return 'error';
            }
        }
    }
}
