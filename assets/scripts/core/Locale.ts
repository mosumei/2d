import { sys } from 'cc';

/**
 * 按系统语言在中文和英文之间选择。
 * @param zh 中文
 * @param en 英文
 */
export function localize(zh: string, en: string): string {
    const language = String(sys.language).toLowerCase();
    return language.startsWith('zh') ? zh : en;
}
