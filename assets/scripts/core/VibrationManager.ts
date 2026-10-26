import { native, sys } from 'cc';
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
            // 对应实现在 native-vibration/。构建原生工程后把源文件放进 native/engine。
            if (sys.isNative) {
                this.vibrateNative(type);
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
     * 调用 iOS / Android 工程里的 Vibration 类。
     * @param type 振动强度
     */
    private static vibrateNative(type: VibrationType): void {
        if (typeof native.reflection?.callStaticMethod !== 'function') {
            return;
        }

        switch (sys.os) {
            case sys.OS.IOS:
                native.reflection.callStaticMethod('Vibration', 'vibrate:', type);
                return;
            case sys.OS.ANDROID:
                native.reflection.callStaticMethod(
                    'com/cocos/game/Vibration',
                    'vibrate',
                    '(Ljava/lang/String;)V',
                    type
                );
                return;
            case sys.OS.OSX:
            case sys.OS.WINDOWS:
            case sys.OS.LINUX:
            case sys.OS.OHOS:
            case sys.OS.OPENHARMONY:
            case sys.OS.UNKNOWN:
                return;
            default: {
                const unsupported: never = sys.os;
                void unsupported;
                return;
            }
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
