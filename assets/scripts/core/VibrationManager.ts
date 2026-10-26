import { sys } from 'cc';
import { GameSettings } from './GameSettings';

export type VibrationType = 'light' | 'medium' | 'heavy';

/**
 * 各平台振动入口。不挂到场景节点。
 * 关闭振动后所有请求都会直接返回。
 */
export class VibrationManager {

    /**
     * 游戏振动统一入口。
     * @param type 振动强度。微信、抖音、TikTok 使用各自的短振动接口。
     */
    public static vibrate(
        type: VibrationType = 'light'
    ): void {

        if (!GameSettings.isVibrationEnabled()) {
            return;
        }

        try {
            const env = globalThis as any;

            // 1. TikTok Mini Games
            // 仅在运行时实际提供对应方法时调用
            const tiktokGame = env.TTMinis?.game;

            if (
                tiktokGame &&
                typeof tiktokGame.vibrateShort === 'function'
            ) {
                tiktokGame.vibrateShort({
                    type: type,
                });
                return;
            }

            // 2. 微信小游戏
            if (env.wx?.vibrateShort) {
                env.wx.vibrateShort({
                    type: type,
                });
                return;
            }

            // 3. 国内抖音小游戏
            if (env.tt?.vibrateShort) {
                env.tt.vibrateShort({
                    type: type,
                });
                return;
            }

            // 4. 原生 iOS / Android
            // 原生平台需要专门的系统桥接实现
            if (sys.isNative) {
                return;
            }

            // 5. Web / H5
            const browser = env.navigator;

            if (
                browser &&
                typeof browser.vibrate === 'function'
            ) {
                const duration =
                    type === 'heavy' ? 60 :
                    type === 'medium' ? 35 : 15;

                browser.vibrate(duration);
            }

        } catch (error) {
            console.warn(
                '[VibrationManager] 振动调用失败:',
                error
            );
        }
    }

    /**
     * 宝石正确归位。一次操作只振一次。
     */
    public static gemMatched(): void {
        this.vibrate('light');
    }

    /**
     * 魔法棒成功使用。
     */
    public static magicUsed(): void {
        this.vibrate('medium');
    }

    /**
     * 关卡完成。
     */
    public static levelCompleted(): void {
        this.vibrate('heavy');
    }
}
