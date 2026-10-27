import { sys } from 'cc';

import { GameSettings } from './GameSettings';

/**
 * 按当前语言在中文和英文之间选择。
 * @param zh 中文
 * @param en 英文
 */
export function localize(zh: string, en: string): string {
    return currentLanguage() === 'zh' ? zh : en;
}

/**
 * 玩家实际看到的语言。选了跟随系统时，中文系统用中文，其余用英文。
 */
export function currentLanguage(): 'zh' | 'en' {
    const choice = GameSettings.getLanguage();
    switch (choice) {
        case 'zh':
            return 'zh';
        case 'en':
            return 'en';
        case 'system':
            return String(sys.language).toLowerCase().startsWith('zh') ? 'zh' : 'en';
        default: {
            const unexpected: never = choice;
            return unexpected;
        }
    }
}

/**
 * 语言一行右侧显示的文字。没手动选过时，显示系统对应的中文或英文。
 */
export function languageChoiceLabel(): string {
    const language = currentLanguage();
    switch (language) {
        case 'zh':
            return '中文';
        case 'en':
            return 'English';
        default: {
            const unexpected: never = language;
            return unexpected;
        }
    }
}
