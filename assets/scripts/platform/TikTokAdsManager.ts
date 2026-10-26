export type RewardedAdResult =
    | 'completed'
    | 'closed'
    | 'unavailable'
    | 'error'
    | 'busy';

interface RewardedVideoCloseResult {
    isEnded?: boolean;
}

interface RewardedVideoAd {
    show: () => Promise<void>;
    onClose: (callback: (result: RewardedVideoCloseResult) => void) => void;
    offClose?: (callback: (result: RewardedVideoCloseResult) => void) => void;
    onError: (callback: (error: unknown) => void) => void;
    offError?: (callback: (error: unknown) => void) => void;
}

interface TikTokGameApi {
    createRewardedVideoAd?: (options: { adUnitId: string }) => RewardedVideoAd;
}

const AD_UNIT_ID = 'ad7698653587427395604';
const AD_TIMEOUT_MS = 120000;

/**
 * 同一时间只允许一条激励视频。魔法棒和放大镜共用这个广告位。
 */
let showingRewardedAd = false;

/**
 * TikTok Minis 激励视频。每次展示都新建实例，只有完整观看才返回 completed。
 */
export class TikTokAdsManager {

    /**
     * 播放一次激励视频。
     * 不在 TikTok、加载失败、提前关闭都不会返回 completed。
     */
    public static showRewardedAd(): Promise<RewardedAdResult> {
        if (showingRewardedAd) {
            return Promise.resolve('busy');
        }

        const game = (globalThis as { TTMinis?: { game?: TikTokGameApi } }).TTMinis?.game;
        const createAd = game?.createRewardedVideoAd;
        if (typeof createAd !== 'function') {
            console.warn('[TikTokAds] 当前环境没有激励视频');
            return Promise.resolve('unavailable');
        }

        let ad: RewardedVideoAd;
        try {
            ad = createAd({ adUnitId: AD_UNIT_ID });
        } catch (error) {
            console.error('[TikTokAds] 创建激励视频失败', error);
            return Promise.resolve('error');
        }

        showingRewardedAd = true;
        return new Promise((resolve) => {
            let settled = false;
            const finish = (result: RewardedAdResult) => {
                if (settled) return;
                settled = true;
                showingRewardedAd = false;
                clearTimeout(timer);
                ad.offClose?.(handleClose);
                ad.offError?.(handleError);
                resolve(result);
            };

            const handleClose = (result: RewardedVideoCloseResult) => {
                finish(result.isEnded === true ? 'completed' : 'closed');
            };
            const handleError = (error: unknown) => {
                console.error('[TikTokAds] 激励视频播放失败', error);
                finish('error');
            };
            const timer = setTimeout(() => {
                console.warn('[TikTokAds] 激励视频超时');
                finish('error');
            }, AD_TIMEOUT_MS);

            ad.onClose(handleClose);
            ad.onError(handleError);
            ad.show().catch((error: unknown) => {
                console.error('[TikTokAds] 激励视频无法展示', error);
                finish('error');
            });
        });
    }
}
