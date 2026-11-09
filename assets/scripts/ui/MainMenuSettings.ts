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
    UITransform
} from 'cc';

import { GameSettings } from '../core/GameSettings';
import { LevelSession } from '../core/LevelSession';
import { localize } from '../core/Locale';

type ToggleKey = 'music' | 'sound';
type MenuAction = 'feedback' | 'share' | 'privacy';

/** 设计稿是 375 宽，游戏画布是 720。 */
const SCALE = 720 / 375;

const BROWN = new Color(122, 72, 36, 255);
const ROW_TEXT = new Color(166, 124, 78, 255);
const ROW_FILL = new Color(250, 243, 234, 255);
const ROW_STROKE = new Color(233, 207, 177, 255);
const CLOSE_FILL = new Color(253, 243, 230, 255);
const CLOSE_STROKE = new Color(220, 186, 146, 255);

/**
 * 主页左上角的设置。弹窗按首页切图排，不改主菜单场景。
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
        node.addComponent(UITransform).setContentSize(77, 77);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('ui/game/btn_gea/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !node.isValid) {
                if (error) console.error('[MainMenu] 加载 ui/game/btn_gea/spriteFrame 失败', error);
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
        dimGraphics.fillColor = new Color(20, 24, 32, 150);
        dimGraphics.rect(-450, -850, 900, 1700);
        dimGraphics.fill();
        dim.on(Node.EventType.TOUCH_END, () => {
            panel.active = false;
        });

        const cardWidth = MainMenuSettings.px(307);
        const cardHeight = MainMenuSettings.px(335);
        const card = new Node('Card');
        card.layer = Layers.Enum.UI_2D;
        card.parent = panel;
        card.setPosition(0, -MainMenuSettings.px(15.5), 0);
        card.addComponent(UITransform).setContentSize(cardWidth, cardHeight);
        card.addComponent(BlockInputEvents);
        MainMenuSettings.addSprite(card, 'ui/settings/home/panel/spriteFrame', cardWidth, cardHeight);

        const titleWidth = MainMenuSettings.px(158);
        const titleHeight = MainMenuSettings.px(46.5);
        const titleFrame = new Node('TitleFrame');
        titleFrame.layer = Layers.Enum.UI_2D;
        titleFrame.parent = card;
        titleFrame.setPosition(0, MainMenuSettings.px(167), 0);
        titleFrame.addComponent(UITransform).setContentSize(titleWidth, titleHeight);
        MainMenuSettings.addSprite(titleFrame, 'ui/settings/home/title_frame/spriteFrame', titleWidth, titleHeight);

        const title = MainMenuSettings.addLabel(
            card, '', titleWidth - 24, titleHeight - 16, 34, BROWN, Label.HorizontalAlign.CENTER
        );
        title.node.name = 'PanelTitle';
        title.node.setPosition(0, MainMenuSettings.px(164), 0);

        const toggles: { key: ToggleKey; x: number }[] = [
            { key: 'music', x: -MainMenuSettings.px(58.5) },
            { key: 'sound', x: MainMenuSettings.px(58.5) }
        ];
        for (const item of toggles) {
            MainMenuSettings.addSpriteButton(
                card,
                `Toggle_${item.key}`,
                MainMenuSettings.togglePath(item.key, false),
                item.x,
                MainMenuSettings.px(69.5),
                MainMenuSettings.px(62),
                MainMenuSettings.px(58),
                () => MainMenuSettings.toggle(panel, item.key)
            );
        }

        const rows: { name: string; icon: string; text: string; action: MenuAction }[] = [
            { name: 'Action_feedback', icon: 'icon_feedback', text: '意见反馈', action: 'feedback' },
            { name: 'Action_share', icon: 'icon_share', text: '分享给好友', action: 'share' },
            { name: 'Action_privacy', icon: 'icon_privacy', text: '隐私政策', action: 'privacy' }
        ];
        const rowPitch = MainMenuSettings.px(46);
        const middleRow = -MainMenuSettings.px(55.5);
        rows.forEach((row, index) => {
            MainMenuSettings.addSettingRow(
                card,
                row.name,
                row.icon,
                middleRow + (1 - index) * rowPitch,
                () => MainMenuSettings.onAction(panel, row.action)
            );
        });

        MainMenuSettings.addCloseButton(card, () => {
            panel.active = false;
        });

        const tip = MainMenuSettings.addLabel(
            panel, '', 420, 36, 22, BROWN, Label.HorizontalAlign.CENTER
        );
        tip.node.setPosition(0, card.position.y - cardHeight / 2 - 36, 0);
        tip.node.name = 'Tip';

        return panel;
    }

    private static toggle(panel: Node, key: ToggleKey): void {
        switch (key) {
            case 'music':
                GameSettings.setMusicEnabled(!GameSettings.isMusicEnabled());
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
        if (title) title.string = localize('游戏设置', 'Settings');

        MainMenuSettings.setRowTitle(card, 'Action_feedback', localize('意见反馈', 'Feedback'));
        MainMenuSettings.setRowTitle(card, 'Action_share', localize('分享给好友', 'Share With Friends'));
        MainMenuSettings.setRowTitle(card, 'Action_privacy', localize('隐私政策', 'Privacy Policy'));

        const settings = GameSettings.load();
        MainMenuSettings.setToggle(panel, 'music', settings.musicEnabled);
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

    private static setToggle(panel: Node, key: ToggleKey, enabled: boolean): void {
        const sprite = panel.getChildByName('Card')
            ?.getChildByName(`Toggle_${key}`)
            ?.getComponent(Sprite);
        if (!sprite) return;
        const path = MainMenuSettings.togglePath(key, enabled);
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !sprite.isValid) {
                if (error) console.error(`[MainMenu] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
        });
    }

    /**
     * 打开用没有斜杠的米色图标，关闭换成带斜杠的。
     * @param key 音乐或音效
     * @param enabled 是否打开
     */
    private static togglePath(key: ToggleKey, enabled: boolean): string {
        switch (key) {
            case 'music':
                return enabled
                    ? 'ui/pause/btn_music/spriteFrame'
                    : 'ui/settings/home/icon_music_off/spriteFrame';
            case 'sound':
                return enabled
                    ? 'ui/pause/btn_sound/spriteFrame'
                    : 'ui/settings/home/icon_sound_off/spriteFrame';
            default: {
                const unexpected: never = key;
                return unexpected;
            }
        }
    }

    private static showTip(panel: Node, text: string): void {
        const tip = panel.getChildByName('Tip')?.getComponent(Label);
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

    private static addCloseButton(card: Node, onClick: () => void): void {
        const size = MainMenuSettings.px(31);
        const node = new Node('CloseButton');
        node.layer = Layers.Enum.UI_2D;
        node.parent = card;
        node.setPosition(MainMenuSettings.px(137.5), MainMenuSettings.px(164.5), 0);
        node.addComponent(UITransform).setContentSize(size, size);
        const graphics = node.addComponent(Graphics);
        const radius = size / 2 - 1;
        graphics.fillColor = CLOSE_FILL;
        graphics.circle(0, 0, radius);
        graphics.fill();
        graphics.strokeColor = CLOSE_STROKE;
        graphics.lineWidth = 2;
        graphics.circle(0, 0, radius);
        graphics.stroke();
        graphics.strokeColor = BROWN;
        graphics.lineWidth = 3;
        graphics.moveTo(-7, -7);
        graphics.lineTo(7, 7);
        graphics.stroke();
        graphics.moveTo(-7, 7);
        graphics.lineTo(7, -7);
        graphics.stroke();

        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, onClick);
    }

    private static addSprite(parent: Node, path: string, width: number, height: number): Sprite {
        const sprite = parent.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
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
        y: number,
        onClick: () => void
    ): void {
        const width = MainMenuSettings.px(255);
        const height = MainMenuSettings.px(32);
        const radius = MainMenuSettings.px(18);
        const row = new Node(name);
        row.layer = Layers.Enum.UI_2D;
        row.parent = card;
        row.setPosition(0, y, 0);
        row.addComponent(UITransform).setContentSize(width, height);
        const plate = row.addComponent(Graphics);
        plate.fillColor = ROW_FILL;
        plate.roundRect(-width / 2, -height / 2, width, height, radius);
        plate.fill();
        plate.strokeColor = ROW_STROKE;
        plate.lineWidth = 2;
        plate.roundRect(-width / 2, -height / 2, width, height, radius);
        plate.stroke();
        plate.moveTo(-MainMenuSettings.px(78), -height * 0.28);
        plate.lineTo(-MainMenuSettings.px(78), height * 0.28);
        plate.stroke();
        const button = row.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.03;
        row.on(Button.EventType.CLICK, onClick);

        const glyph = new Node('Glyph');
        glyph.layer = Layers.Enum.UI_2D;
        glyph.parent = row;
        glyph.setPosition(-MainMenuSettings.px(97), 0, 0);
        glyph.addComponent(UITransform);
        MainMenuSettings.addSprite(
            glyph,
            `ui/settings/home/${icon}/spriteFrame`,
            MainMenuSettings.px(19),
            MainMenuSettings.px(18)
        );

        const title = MainMenuSettings.addLabel(
            row, '', MainMenuSettings.px(140), height, 24, ROW_TEXT, Label.HorizontalAlign.CENTER
        );
        title.node.name = 'Title';
        title.node.setPosition(0, 0, 0);

        const mark = new Node('Arrow');
        mark.layer = Layers.Enum.UI_2D;
        mark.parent = row;
        mark.setPosition(MainMenuSettings.px(105), 0, 0);
        mark.addComponent(UITransform);
        MainMenuSettings.addSprite(
            mark,
            'ui/settings/home/icon_arrow/spriteFrame',
            MainMenuSettings.px(6),
            MainMenuSettings.px(11)
        );
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
        label.lineHeight = fontSize + 6;
        label.isBold = true;
        label.color = color;
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    /** 把设计稿上的 pt 换成 720 宽画布上的像素。 */
    private static px(designPoint: number): number {
        return Math.round(designPoint * SCALE);
    }
}
