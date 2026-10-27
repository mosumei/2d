import {
    BlockInputEvents,
    Button,
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    Tween,
    tween,
    UITransform
} from 'cc';

import { GameSettings } from '../core/GameSettings';
import { LevelSession } from '../core/LevelSession';
import { currentLanguage, languageChoiceLabel, localize } from '../core/Locale';

const BROWN = new Color(92, 58, 32, 255);
const CREAM = new Color(255, 246, 226, 255);
const ROW = new Color(255, 252, 245, 255);
const STROKE = new Color(196, 142, 64, 255);
const ON = new Color(72, 122, 64, 255);
const OFF = new Color(160, 120, 90, 255);

type ToggleKey = 'music' | 'vibration' | 'sound';
type MenuAction = 'feedback' | 'share' | 'save' | 'privacy';

/**
 * 主页左上角的设置。文字弹窗，不改主菜单场景。
 */
export class MainMenuSettings {

    /**
     * 在主菜单画布上放设置按钮和弹窗。重复调用不会再建一份。
     * @param canvas 主菜单画布
     */
    public static attach(canvas: Node): void {
        if (canvas.getChildByName('MainMenuSettingsEntry')) return;

        const panel = MainMenuSettings.createPanel(canvas);
        panel.active = false;

        const entry = MainMenuSettings.createEntry(canvas, () => {
            panel.active = true;
            panel.setSiblingIndex(canvas.children.length - 1);
            MainMenuSettings.refresh(panel);
        });
        entry.setSiblingIndex(panel.getSiblingIndex());
        MainMenuSettings.refresh(panel);
    }

    private static createEntry(canvas: Node, onClick: () => void): Node {
        const node = new Node('MainMenuSettingsEntry');
        node.layer = Layers.Enum.UI_2D;
        node.parent = canvas;
        node.setPosition(-264, 548, 0);
        node.addComponent(UITransform).setContentSize(120, 52);
        MainMenuSettings.paint(node, 120, 52, 18, CREAM, STROKE);
        const entryLabel = MainMenuSettings.addLabel(node, '', 96, 36, 22, BROWN, Label.HorizontalAlign.CENTER);
        entryLabel.node.name = 'EntryLabel';

        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, onClick);
        return node;
    }

    private static createPanel(canvas: Node): Node {
        const panel = new Node('MainMenuSettingsPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = canvas;

        const dim = new Node('Dim');
        dim.layer = Layers.Enum.UI_2D;
        dim.parent = panel;
        dim.addComponent(UITransform).setContentSize(900, 1700);
        dim.addComponent(BlockInputEvents);
        const dimGraphics = dim.addComponent(Graphics);
        dimGraphics.fillColor = new Color(40, 24, 12, 120);
        dimGraphics.rect(-450, -850, 900, 1700);
        dimGraphics.fill();
        dim.on(Node.EventType.TOUCH_END, () => {
            MainMenuSettings.hideLanguageMenu(panel);
        });

        const card = new Node('Card');
        card.layer = Layers.Enum.UI_2D;
        card.parent = panel;
        card.addComponent(UITransform).setContentSize(540, 820);
        card.addComponent(BlockInputEvents);
        MainMenuSettings.paint(card, 540, 820, 28, CREAM, STROKE);

        const title = MainMenuSettings.addLabel(
            card, '', 220, 48, 36, BROWN, Label.HorizontalAlign.CENTER
        );
        title.node.name = 'PanelTitle';
        title.node.setPosition(0, 360, 0);

        const close = MainMenuSettings.makeRowButton(card, ' ', 108, 44, () => {
            MainMenuSettings.hideLanguageMenu(panel);
            panel.active = false;
        });
        close.name = 'CloseButton';
        close.setPosition(190, 360, 0);

        const tip = MainMenuSettings.addLabel(
            card, '', 460, 36, 22, BROWN, Label.HorizontalAlign.CENTER
        );
        tip.node.setPosition(0, -360, 0);
        tip.node.name = 'Tip';

        const toggles: ToggleKey[] = ['music', 'vibration', 'sound'];
        toggles.forEach((key, index) => {
            const y = 270 - index * 70;
            MainMenuSettings.makeChoice(card, '', y, `Toggle_${key}`, () => {
                MainMenuSettings.hideLanguageMenu(panel);
                MainMenuSettings.toggle(panel, key);
            });
        });

        MainMenuSettings.makeChoice(card, '', 60, 'Language', () => {
            MainMenuSettings.toggleLanguageMenu(panel);
        });
        MainMenuSettings.createLanguageMenu(card, panel);

        const actions: { action: MenuAction; y: number }[] = [
            { action: 'feedback', y: -10 },
            { action: 'share', y: -80 },
            { action: 'save', y: -150 },
            { action: 'privacy', y: -220 }
        ];
        for (const item of actions) {
        const row = MainMenuSettings.makeChoice(card, '', item.y, `Action_${item.action}`, () => {
            MainMenuSettings.hideLanguageMenu(panel);
            MainMenuSettings.onAction(panel, item.action);
        });
            const value = row.getChildByName('Value')?.getComponent(Label);
            if (value) value.string = '>';
        }

        return panel;
    }

    private static toggle(panel: Node, key: ToggleKey): void {
        switch (key) {
            case 'music':
                GameSettings.setMusicEnabled(!GameSettings.isMusicEnabled());
                break;
            case 'vibration':
                GameSettings.setVibrationEnabled(!GameSettings.isVibrationEnabled());
                break;
            case 'sound':
                GameSettings.setSoundEnabled(!GameSettings.isSoundEnabled());
                break;
            default: {
                const unexpected: never = key;
                return unexpected;
            }
        }
        MainMenuSettings.refresh(panel);
        MainMenuSettings.showTip(panel, '');
    }

    private static onAction(panel: Node, action: MenuAction): void {
        switch (action) {
            case 'save':
                LevelSession.flushProgress();
                MainMenuSettings.showTip(panel, localize('已保存', 'Saved'));
                break;
            case 'feedback':
            case 'share':
            case 'privacy':
                MainMenuSettings.showTip(panel, localize('暂未开放', 'Not available yet'));
                break;
            default: {
                const unexpected: never = action;
                return unexpected;
            }
        }
    }

    private static refresh(panel: Node): void {
        const canvas = panel.parent;
        const entry = canvas?.getChildByName('MainMenuSettingsEntry')
            ?.getChildByName('EntryLabel')
            ?.getComponent(Label);
        if (entry) entry.string = localize('设置', 'Settings');
        if (canvas) MainMenuSettings.refreshStart(canvas);

        const card = panel.getChildByName('Card');
        const title = card?.getChildByName('PanelTitle')?.getComponent(Label);
        if (title) title.string = localize('设置', 'Settings');
        const close = card?.getChildByName('CloseButton')?.getComponentInChildren(Label);
        if (close) close.string = localize('关闭', 'Close');

        MainMenuSettings.setRowTitle(card, 'Toggle_music', localize('音乐', 'Music'));
        MainMenuSettings.setRowTitle(card, 'Toggle_vibration', localize('振动', 'Vibration'));
        MainMenuSettings.setRowTitle(card, 'Toggle_sound', localize('音效', 'Sound'));
        MainMenuSettings.setRowTitle(card, 'Language', localize('语言', 'Language'));
        MainMenuSettings.setRowTitle(card, 'Action_feedback', localize('反馈', 'Feedback'));
        MainMenuSettings.setRowTitle(card, 'Action_share', localize('分享给好友', 'Share'));
        MainMenuSettings.setRowTitle(card, 'Action_save', localize('保存进度', 'Save'));
        MainMenuSettings.setRowTitle(card, 'Action_privacy', localize('隐私政策', 'Privacy'));

        const language = card?.getChildByName('Language')?.getChildByName('Value')?.getComponent(Label);
        if (language) {
            language.string = `${languageChoiceLabel()} ▾`;
            language.color = BROWN;
        }
        MainMenuSettings.refreshLanguageMenu(panel);

        const settings = GameSettings.load();
        MainMenuSettings.setToggle(panel, 'music', settings.musicEnabled);
        MainMenuSettings.setToggle(panel, 'vibration', settings.vibrationEnabled);
        MainMenuSettings.setToggle(panel, 'sound', settings.soundEnabled);
    }

    private static refreshStart(canvas: Node): void {
        for (const child of canvas.children) {
            const label = child.getChildByName('PlainLabel')?.getComponent(Label);
            if (label) label.string = localize('开始', 'Start');
        }
    }

    private static setRowTitle(card: Node | null, rowName: string, text: string): void {
        const label = card?.getChildByName(rowName)?.getChildByName('Title')?.getComponent(Label);
        if (label) label.string = text;
    }

    private static createLanguageMenu(card: Node, panel: Node): void {
        const menu = new Node('LanguageMenu');
        menu.layer = Layers.Enum.UI_2D;
        menu.parent = card;
        menu.setPosition(130, -40, 0);
        menu.addComponent(UITransform).setContentSize(210, 128);
        menu.addComponent(BlockInputEvents);
        MainMenuSettings.paint(menu, 210, 128, 16, new Color(255, 236, 206, 255), STROKE);
        menu.active = false;

        const options: Array<'zh' | 'en'> = ['zh', 'en'];
        const titles = ['中文', 'English'];
        options.forEach((code, index) => {
            const row = new Node(`Option_${code}`);
            row.layer = Layers.Enum.UI_2D;
            row.parent = menu;
            row.setPosition(0, 28 - index * 56, 0);
            row.addComponent(UITransform).setContentSize(190, 48);

            const dot = new Node('Dot');
            dot.layer = Layers.Enum.UI_2D;
            dot.parent = row;
            dot.setPosition(-72, 0, 0);
            dot.addComponent(UITransform).setContentSize(24, 24);
            dot.addComponent(Graphics);

            const label = MainMenuSettings.addLabel(
                row, titles[index], 130, 40, 22, BROWN, Label.HorizontalAlign.LEFT
            );
            label.node.setPosition(16, 0, 0);

            const button = row.addComponent(Button);
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 1.03;
            row.on(Button.EventType.CLICK, () => {
                GameSettings.setLanguage(code);
                MainMenuSettings.hideLanguageMenu(panel);
                MainMenuSettings.refresh(panel);
                MainMenuSettings.showTip(panel, '');
            });
        });
    }

    private static toggleLanguageMenu(panel: Node): void {
        const menu = panel.getChildByName('Card')?.getChildByName('LanguageMenu');
        if (!menu) return;
        menu.active = !menu.active;
        if (!menu.active) return;
        menu.setSiblingIndex((menu.parent?.children.length ?? 1) - 1);
        MainMenuSettings.refreshLanguageMenu(panel);
    }

    private static hideLanguageMenu(panel: Node): void {
        const menu = panel.getChildByName('Card')?.getChildByName('LanguageMenu');
        if (menu) menu.active = false;
    }

    private static refreshLanguageMenu(panel: Node): void {
        const menu = panel.getChildByName('Card')?.getChildByName('LanguageMenu');
        if (!menu) return;
        const selected = currentLanguage();
        const options: Array<'zh' | 'en'> = ['zh', 'en'];
        for (const code of options) {
            const dot = menu.getChildByName(`Option_${code}`)?.getChildByName('Dot')?.getComponent(Graphics);
            if (!dot) continue;
            dot.clear();
            dot.lineWidth = 3;
            dot.strokeColor = BROWN;
            dot.circle(0, 0, 10);
            dot.stroke();
            if (code !== selected) continue;
            dot.fillColor = new Color(214, 122, 42, 255);
            dot.circle(0, 0, 6);
            dot.fill();
        }
    }

    private static setToggle(panel: Node, key: ToggleKey, enabled: boolean): void {
        const label = panel.getChildByName('Card')
            ?.getChildByName(`Toggle_${key}`)
            ?.getChildByName('Value')
            ?.getComponent(Label);
        if (!label) return;
        label.string = enabled ? localize('开', 'On') : localize('关', 'Off');
        label.color = enabled ? ON : OFF;
    }

    private static showTip(panel: Node, text: string): void {
        const tip = panel.getChildByName('Card')?.getChildByName('Tip')?.getComponent(Label);
        if (!tip) return;
        Tween.stopAllByTarget(tip.node);
        tip.string = text;
        if (!text) return;
        tween(tip.node)
            .delay(1.4)
            .call(() => {
                if (tip.isValid) tip.string = '';
            })
            .start();
    }

    private static makeChoice(
        card: Node,
        title: string,
        y: number,
        valueName: string,
        onClick?: () => void
    ): Node {
        const row = onClick
            ? MainMenuSettings.makeRowButton(card, '', 460, 58, onClick)
            : new Node(title);
        if (!onClick) {
            row.layer = Layers.Enum.UI_2D;
            row.parent = card;
            row.addComponent(UITransform).setContentSize(460, 58);
            MainMenuSettings.paint(row, 460, 58, 14, ROW, STROKE);
        }
        row.name = onClick ? valueName : title;
        row.setPosition(0, y, 0);

        const titleLabel = MainMenuSettings.addLabel(
            row, title, 240, 40, 24, BROWN, Label.HorizontalAlign.LEFT
        );
        titleLabel.node.name = 'Title';
        titleLabel.node.setPosition(-90, 0, 0);

        const value = MainMenuSettings.addLabel(
            row, '', 150, 40, 22, BROWN, Label.HorizontalAlign.RIGHT
        );
        value.node.name = 'Value';
        value.node.setPosition(145, 0, 0);
        if (onClick) row.name = valueName;
        return row;
    }

    private static makeRowButton(
        parent: Node,
        title: string,
        width: number,
        height: number,
        onClick: () => void
    ): Node {
        const node = new Node(title || 'Row');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.addComponent(UITransform).setContentSize(width, height);
        MainMenuSettings.paint(node, width, height, 14, ROW, STROKE);
        if (title) {
            MainMenuSettings.addLabel(
                node, title, width - 12, height - 8, 22, BROWN, Label.HorizontalAlign.CENTER
            );
        }
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.03;
        node.on(Button.EventType.CLICK, onClick);
        return node;
    }

    private static paint(
        node: Node,
        width: number,
        height: number,
        radius: number,
        fill: Color,
        stroke: Color
    ): void {
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = fill;
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.fill();
        graphics.strokeColor = stroke;
        graphics.lineWidth = 3;
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.stroke();
    }

    private static addLabel(
        parent: Node,
        text: string,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        align: Label['horizontalAlign']
    ): Label {
        const node = new Node('Label');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.isBold = true;
        label.color = color;
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }
}
