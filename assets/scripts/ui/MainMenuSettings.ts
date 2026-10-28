import {
    BlockInputEvents,
    Button,
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    Tween,
    tween,
    UIOpacity,
    UITransform
} from 'cc';

import { GameSettings } from '../core/GameSettings';
import { LevelSession } from '../core/LevelSession';
import { currentLanguage, localize } from '../core/Locale';

type ToggleKey = 'music' | 'vibration' | 'sound';
type MenuAction = 'feedback' | 'share' | 'save' | 'privacy';

/**
 * 主页左上角的设置。弹窗用切图，不改主菜单场景。
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
        node.setPosition(-278, 559, 0);
        node.addComponent(UITransform).setContentSize(80, 80);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('ui/home/btn_settings/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !node.isValid) {
                if (error) console.error('[MainMenu] 加载 ui/home/btn_settings/spriteFrame 失败', error);
                return;
            }
            sprite.spriteFrame = frame;
        });

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
        dimGraphics.fillColor = new Color(20, 24, 32, 170);
        dimGraphics.rect(-450, -850, 900, 1700);
        dimGraphics.fill();
        dim.on(Node.EventType.TOUCH_END, () => {
            MainMenuSettings.hideLanguageMenu(panel);
            panel.active = false;
        });

        const card = new Node('Card');
        card.layer = Layers.Enum.UI_2D;
        card.parent = panel;
        card.setPosition(0, 20, 0);
        card.addComponent(UITransform).setContentSize(599, 811);
        card.addComponent(BlockInputEvents);
        MainMenuSettings.addSprite(card, 'ui/settings/panel_settings/spriteFrame', 599, 811);

        const title = MainMenuSettings.addLabel(
            card, '', 280, 64, 44, Color.WHITE, Label.HorizontalAlign.CENTER
        );
        title.node.name = 'PanelTitle';
        title.node.setPosition(0, 327, 0);
        title.enableOutline = true;
        title.outlineColor = new Color(24, 110, 196, 255);
        title.outlineWidth = 3;

        const sheet = new Node('Sheet');
        sheet.layer = Layers.Enum.UI_2D;
        sheet.parent = card;
        sheet.setPosition(0, -70, 0);
        sheet.addComponent(UITransform).setContentSize(536, 533);
        const sheetGraphics = sheet.addComponent(Graphics);
        sheetGraphics.fillColor = new Color(255, 255, 255, 255);
        sheetGraphics.roundRect(-268, -266, 536, 533, 36);
        sheetGraphics.fill();

        const toggles: { key: ToggleKey; icon: string; x: number }[] = [
            { key: 'sound', icon: 'icon_sound', x: -149 },
            { key: 'music', icon: 'icon_music', x: 0 },
            { key: 'vibration', icon: 'icon_vibration', x: 149 }
        ];
        for (const item of toggles) {
            const button = MainMenuSettings.addSpriteButton(
                card, `Toggle_${item.key}`, `ui/settings/${item.icon}/spriteFrame`,
                item.x, 125, 93, 93, () => {
                    MainMenuSettings.hideLanguageMenu(panel);
                    MainMenuSettings.toggle(panel, item.key);
                }
            );
            button.addComponent(UIOpacity);
        }

        const rows: { name: string; icon: string; arrow: string; y: number; action?: MenuAction }[] = [
            { name: 'Language', icon: 'icon_language', arrow: 'icon_arrow_down', y: 12 },
            { name: 'Action_feedback', icon: 'icon_feedback', arrow: 'icon_arrow_right', y: -59, action: 'feedback' },
            { name: 'Action_share', icon: 'icon_share', arrow: 'icon_arrow_right', y: -130, action: 'share' },
            { name: 'Action_save', icon: 'icon_save', arrow: 'icon_arrow_right', y: -200, action: 'save' },
            { name: 'Action_privacy', icon: 'icon_privacy', arrow: 'icon_arrow_right', y: -271, action: 'privacy' }
        ];
        for (const row of rows) {
            MainMenuSettings.addSettingRow(card, row.name, row.icon, row.arrow, row.y, () => {
                if (row.name === 'Language') {
                    MainMenuSettings.toggleLanguageMenu(panel);
                    return;
                }
                MainMenuSettings.hideLanguageMenu(panel);
                if (row.action) MainMenuSettings.onAction(panel, row.action);
            });
        }
        MainMenuSettings.createLanguageMenu(card, panel);

        const tip = MainMenuSettings.addLabel(
            card, '', 400, 32, 20, new Color(46, 130, 220, 255), Label.HorizontalAlign.CENTER
        );
        tip.node.setPosition(0, -320, 0);
        tip.node.name = 'Tip';

        const close = MainMenuSettings.addSpriteButton(
            card, 'CloseButton', 'ui/settings/btn_close/spriteFrame',
            232, 362, 80, 80, () => {
                MainMenuSettings.hideLanguageMenu(panel);
                panel.active = false;
            }
        );
        close.setSiblingIndex(card.children.length - 1);

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
        if (canvas) MainMenuSettings.refreshStart(canvas);

        const card = panel.getChildByName('Card');
        const title = card?.getChildByName('PanelTitle')?.getComponent(Label);
        if (title) title.string = localize('设置', 'Settings');

        MainMenuSettings.setRowTitle(card, 'Language', localize('语言', 'Language'));
        MainMenuSettings.setRowTitle(card, 'Action_feedback', localize('反馈', 'Feedback'));
        MainMenuSettings.setRowTitle(card, 'Action_share', localize('分享给好友', 'Share With Friends'));
        MainMenuSettings.setRowTitle(card, 'Action_save', localize('保存进度', 'Save Your Progress'));
        MainMenuSettings.setRowTitle(card, 'Action_privacy', localize('隐私政策', 'Privacy Policy'));
        MainMenuSettings.refreshLanguageMenu(panel);

        const settings = GameSettings.load();
        MainMenuSettings.setToggle(panel, 'music', settings.musicEnabled);
        MainMenuSettings.setToggle(panel, 'vibration', settings.vibrationEnabled);
        MainMenuSettings.setToggle(panel, 'sound', settings.soundEnabled);
    }

    private static refreshStart(canvas: Node): void {
        const level = LevelSession.getProgress().lastPlayedLevel;
        const play = canvas.getChildByName('HomeRoot')
            ?.getChildByName('PlayButton')
            ?.getChildByName('HomePlayLabel')
            ?.getComponent(Label);
        if (play) play.string = localize(`等级 ${level}`, `Level ${level}`);
    }

    private static setRowTitle(card: Node | null, rowName: string, text: string): void {
        const label = card?.getChildByName(rowName)?.getChildByName('Title')?.getComponent(Label);
        if (label) label.string = text;
    }

    private static createLanguageMenu(card: Node, panel: Node): void {
        const menu = new Node('LanguageMenu');
        menu.layer = Layers.Enum.UI_2D;
        menu.parent = card;
        menu.setPosition(130, -92, 0);
        menu.addComponent(UITransform).setContentSize(210, 128);
        menu.addComponent(BlockInputEvents);
        MainMenuSettings.paint(menu, 210, 128, 16, Color.WHITE, new Color(46, 130, 220, 255));
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
                row, titles[index], 130, 40, 22, new Color(46, 130, 220, 255), Label.HorizontalAlign.LEFT
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
            dot.strokeColor = new Color(46, 130, 220, 255);
            dot.circle(0, 0, 10);
            dot.stroke();
            if (code !== selected) continue;
            dot.fillColor = new Color(46, 130, 220, 255);
            dot.circle(0, 0, 6);
            dot.fill();
        }
    }

    private static setToggle(panel: Node, key: ToggleKey, enabled: boolean): void {
        const opacity = panel.getChildByName('Card')
            ?.getChildByName(`Toggle_${key}`)
            ?.getComponent(UIOpacity);
        if (!opacity) return;
        opacity.opacity = enabled ? 255 : 110;
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

    private static addSprite(parent: Node, path: string, width: number, height: number): Sprite {
        const sprite = parent.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !parent.isValid) {
                if (error) console.error(`[MainMenu] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
        });
        parent.getComponent(UITransform)?.setContentSize(width, height);
        return sprite;
    }

    private static addSpriteButton(
        parent: Node,
        name: string,
        path: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick: () => void
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        MainMenuSettings.addSprite(node, path, width, height);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.05;
        node.on(Button.EventType.CLICK, onClick);
        return node;
    }

    private static addSettingRow(
        card: Node,
        name: string,
        icon: string,
        arrow: string,
        y: number,
        onClick: () => void
    ): void {
        const row = new Node(name);
        row.layer = Layers.Enum.UI_2D;
        row.parent = card;
        row.setPosition(0, y, 0);
        row.addComponent(UITransform).setContentSize(473, 65);
        const plate = row.addComponent(Graphics);
        plate.fillColor = new Color(8, 13, 9, 45);
        plate.roundRect(-236, -36, 473, 65, 29);
        plate.fill();
        plate.fillColor = new Color(253, 253, 253, 255);
        plate.roundRect(-236, -32, 473, 65, 29);
        plate.fill();
        const button = row.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.03;
        row.on(Button.EventType.CLICK, onClick);

        const glyph = new Node('Glyph');
        glyph.layer = Layers.Enum.UI_2D;
        glyph.parent = row;
        glyph.setPosition(-199, 0, 0);
        glyph.addComponent(UITransform).setContentSize(43, 43);
        MainMenuSettings.addSprite(glyph, `ui/settings/${icon}/spriteFrame`, 43, 43);

        const title = MainMenuSettings.addLabel(
            row, '', 260, 44, 24, new Color(46, 130, 220, 255), Label.HorizontalAlign.LEFT
        );
        title.node.name = 'Title';
        title.node.setPosition(-40, 0, 0);

        const mark = new Node('Arrow');
        mark.layer = Layers.Enum.UI_2D;
        mark.parent = row;
        mark.setPosition(198, 0, 0);
        mark.addComponent(UITransform).setContentSize(27, 29);
        MainMenuSettings.addSprite(mark, `ui/settings/${arrow}/spriteFrame`, 27, 29);
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
