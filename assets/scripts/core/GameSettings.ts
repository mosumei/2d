
import { sys } from 'cc';

/**
 * 界面语言。system 表示跟随系统。
 */
export type GameLanguage = 'system' | 'zh' | 'en';

/**
 * Jewel Crush 全局游戏设置
 */
export interface GameSettingsData {
    soundEnabled: boolean;       // 游戏音效
    musicEnabled: boolean;       // 背景音乐
    vibrationEnabled: boolean;   // 振动反馈
    language: GameLanguage;
}

export class GameSettings {

    private static readonly KEY = 'jewel_crush_settings_v1';

    // 默认设置
    private static readonly DEFAULT_SETTINGS: GameSettingsData = {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        language: 'system',
    };

    /**
     * 读取保存的设置
     */
    public static load(): GameSettingsData {
        const defaults = { ...this.DEFAULT_SETTINGS };

        try {
            const saved = sys.localStorage.getItem(this.KEY);

            if (!saved) {
                return defaults;
            }

            const data = JSON.parse(saved);

            return {
                soundEnabled:
                    typeof data.soundEnabled === 'boolean'
                        ? data.soundEnabled
                        : defaults.soundEnabled,

                musicEnabled:
                    typeof data.musicEnabled === 'boolean'
                        ? data.musicEnabled
                        : defaults.musicEnabled,

                vibrationEnabled:
                    typeof data.vibrationEnabled === 'boolean'
                        ? data.vibrationEnabled
                        : defaults.vibrationEnabled,

                language: this.readLanguage(data.language),
            };

        } catch (error) {
            console.warn('[GameSettings] 加载设置失败:', error);
            return defaults;
        }
    }

    /**
     * 保存全部设置
     */
    public static save(settings: GameSettingsData): void {
        try {
            sys.localStorage.setItem(
                this.KEY,
                JSON.stringify(settings)
            );
        } catch (error) {
            console.warn('[GameSettings] 保存设置失败:', error);
        }
    }

    /**
     * 更新部分设置，并保留其他设置
     */
    public static update(
        changes: Partial<GameSettingsData>
    ): GameSettingsData {

        const settings = {
            ...this.load(),
            ...changes,
        };

        this.save(settings);

        return settings;
    }

    /**
     * 获取音效状态
     */
    public static isSoundEnabled(): boolean {
        return this.load().soundEnabled;
    }

    /**
     * 获取音乐状态
     */
    public static isMusicEnabled(): boolean {
        return this.load().musicEnabled;
    }

    /**
     * 获取振动状态
     */
    public static isVibrationEnabled(): boolean {
        return this.load().vibrationEnabled;
    }

    /**
     * 设置音效
     */
    public static setSoundEnabled(enabled: boolean): void {
        this.update({ soundEnabled: enabled });
    }

    /**
     * 设置音乐
     */
    public static setMusicEnabled(enabled: boolean): void {
        this.update({ musicEnabled: enabled });
    }

    /**
     * 设置振动
     */
    public static setVibrationEnabled(enabled: boolean): void {
        this.update({ vibrationEnabled: enabled });
    }

    /**
     * 读取界面语言。没有存过时是跟随系统。
     */
    public static getLanguage(): GameLanguage {
        return this.load().language;
    }

    /**
     * 保存界面语言。
     * @param language system 跟随系统，zh 中文，en 英文
     */
    public static setLanguage(language: GameLanguage): void {
        this.update({ language });
    }

    private static readLanguage(value: unknown): GameLanguage {
        switch (value) {
            case 'system':
            case 'zh':
            case 'en':
                return value;
            default:
                return 'system';
        }
    }
}
