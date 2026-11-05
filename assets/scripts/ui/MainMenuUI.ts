import {
    _decorator,
    Component,
    Button,
    Node,
    director,
    Label,
    UITransform,
    Color,
    Layers,
    Sprite,
    SpriteFrame,
    resources,
    tween,
    UIOpacity,
    JsonAsset
} from 'cc';

import { PREVIEW } from 'cc/env';
import { localize } from '../core/Locale';
import { ARTIFACTS } from '../core/ArtifactCollectionManager';
import { LevelSession, MAX_LEVEL } from '../core/LevelSession';
import { MainMenuSettings } from './MainMenuSettings';
import { GEM_COLOR_LETTERS, GemColor } from '../game/GemCell';
import { configureGemPalette, drawBead, GemPalette } from '../game/GemVisuals';
import { loadTileSet, TileFrames } from '../game/TileSprites';

const { ccclass, property } = _decorator;

const SHOWCASE_COLORS: Record<string, GemColor> = GEM_COLOR_LETTERS;

type ShowcaseLevel = {
    target: string[];
    palette?: GemPalette;
};

@ccclass('MainMenuUI')
export class MainMenuUI extends Component {

    @property(Button)
    startButton: Button | null = null;

    private isStarting = false;
    private playButton: Node | null = null;

    onLoad() {
        if (PREVIEW && typeof location !== 'undefined' &&
            new RegExp(`^[1-${MAX_LEVEL}]$`).test(new URLSearchParams(location.search).get('preview-level') ?? '')) {
            LevelSession.allowGameEntry();
            director.loadScene('Game');
            return;
        }

        const canvas = this.startButton?.node.parent ?? this.node.parent;
        if (!canvas) return;

        if (this.startButton) this.startButton.node.active = false;
        const oldBackground = canvas.getChildByName('Background');
        if (oldBackground) oldBackground.active = false;

        this.buildHome(canvas);
        MainMenuSettings.attach(canvas);
        const opacity = canvas.getComponent(UIOpacity) ?? canvas.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(0.28, { opacity: 255 }, { easing: 'sineOut' }).start();
    }

    private buildHome(canvas: Node) {
        if (canvas.getChildByName('HomeRoot')) return;

        const root = new Node('HomeRoot');
        root.layer = Layers.Enum.UI_2D;
        root.parent = canvas;
        root.addComponent(UITransform).setContentSize(720, 1280);

        this.addImage(root, 'HomeBackground', 'ui/game/bg_scene/spriteFrame', 0, 0, 720, 1280);
        this.addImage(root, 'HomeLogo', 'ui/home/logo_jewel_puzzle/spriteFrame', 0, 430, 460, 166);
        const frame = this.addImage(root, 'ShowcaseFrame', 'ui/home/frame_showcase/spriteFrame', 0, 90, 420, 420);
        this.addShowcaseArt(frame);
        this.playButton = this.addImage(
            root,
            'PlayButton',
            'ui/home/btn_start/spriteFrame',
            0,
            -260,
            430,
            171,
            this.onStartGame
        );
        this.addPlayLabel(this.playButton);
        this.addCollection(root);
    }

    /**
     * 花瓣框里放最近一次通关的作品。有成品插画用插画，否则用该关完成图案缩成珠子图。
     */
    private addShowcaseArt(frame: Node) {
        const level = LevelSession.getShowcaseLevel();
        if (level === null) return;
        const image = ARTIFACTS[level]?.image;
        if (image) {
            this.addFramedImage(frame, image);
            return;
        }
        this.addBeadPicture(frame, level);
    }

    private addFramedImage(frame: Node, image: string) {
        const node = new Node('ShowcaseArt');
        node.layer = Layers.Enum.UI_2D;
        node.parent = frame;
        node.addComponent(UITransform);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(image + '/spriteFrame', SpriteFrame, (error, loaded) => {
            if (error || !loaded || !node.isValid) {
                if (error) console.error(`[MainMenu] 加载 ${image}/spriteFrame 失败`, error);
                return;
            }
            sprite.spriteFrame = loaded;
            const source = loaded.originalSize;
            const width = source.width > 0 ? source.width : 300;
            const height = source.height > 0 ? source.height : 340;
            const scale = Math.min(240 / width, 280 / height);
            node.getComponent(UITransform)?.setContentSize(width * scale, height * scale);
        });
    }

    /** 没有成品插画时，把这一关的目标图案缩进花瓣框。 */
    private addBeadPicture(frame: Node, level: number) {
        const text = level < 10 ? `0${level}` : `${level}`;
        void Promise.all([
            this.loadShowcaseLevel(`levels/level_${text}`),
            loadTileSet()
        ]).then(([data, tiles]) => {
            if (!data || !frame.isValid) return;
            this.drawTargetBeads(frame, data, tiles.tiles);
        });
    }

    private loadShowcaseLevel(path: string): Promise<ShowcaseLevel | null> {
        return new Promise(resolve => {
            resources.load(path, JsonAsset, (error, asset) => {
                if (error || !asset) {
                    if (error) console.error(`[MainMenu] 加载 ${path} 失败`, error);
                    resolve(null);
                    return;
                }
                const data = asset.json as ShowcaseLevel;
                if (!Array.isArray(data?.target) || data.target.length === 0) {
                    resolve(null);
                    return;
                }
                resolve(data);
            });
        });
    }

    private drawTargetBeads(frame: Node, data: ShowcaseLevel, frames: TileFrames) {
        const rows = data.target.length;
        const cols = data.target[0]?.length ?? 0;
        if (rows === 0 || cols === 0) return;
        configureGemPalette(data.palette);
        const cell = Math.min(240 / cols, 280 / rows);
        const beadSize = cell * 0.86;
        const root = new Node('ShowcaseBeads');
        root.layer = Layers.Enum.UI_2D;
        root.parent = frame;
        root.addComponent(UITransform);
        for (let row = 0; row < rows; row++) {
            const line = data.target[row] ?? '';
            for (let col = 0; col < cols; col++) {
                const color = SHOWCASE_COLORS[line[col] ?? ''];
                if (!color) continue;
                const bead = new Node('Bead');
                bead.layer = Layers.Enum.UI_2D;
                bead.parent = root;
                bead.setPosition((col - (cols - 1) / 2) * cell, ((rows - 1) / 2 - row) * cell, 0);
                bead.addComponent(UITransform).setContentSize(beadSize, beadSize);
                const sprite = bead.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = frames[color] ?? null;
                sprite.color = Color.WHITE;
                drawBead(bead, beadSize, color);
            }
        }
    }

    private addPlayLabel(button: Node) {
        const level = LevelSession.getContinueLevel();
        this.addLabel(button, 'HomePlayTitle', localize('开始游戏', 'Play'), 0, 16, 34, Color.WHITE, false);
        this.addLabel(
            button,
            'HomePlayLevel',
            localize(`— 第 ${level} 关 —`, `— Level ${level} —`),
            0,
            -24,
            22,
            Color.WHITE,
            false
        );
    }

    private addCollection(parent: Node) {
        const button = this.addImage(
            parent,
            'CollectionButton',
            'ui/home/btn_collection/spriteFrame',
            0,
            -450,
            440,
            150
        );
        this.addImage(button, 'CollectionIcon', 'ui/home/icon_temple/spriteFrame', -72, 0, 46, 46);
        this.addLabel(
            button,
            'CollectionLabel',
            localize('收藏馆  >', 'Collection  >'),
            24,
            0,
            28,
            new Color(146, 96, 48, 255),
            false
        );
    }

    private addLabel(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        fontSize: number,
        color: Color,
        outline: boolean
    ) {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = parent;
        labelNode.setPosition(x, y, 0);
        labelNode.addComponent(UITransform).setContentSize(360, fontSize + 16);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.isBold = true;
        label.color = color;
        label.enableOutline = outline;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
    }

    private addImage(
        parent: Node,
        name: string,
        path: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick?: () => void
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !node.isValid) {
                if (error) console.error(`[MainMenu] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
        });
        if (onClick) {
            const button = node.addComponent(Button);
            button.transition = Button.Transition.SCALE;
            button.zoomScale = 1.06;
            node.on(Button.EventType.CLICK, onClick, this);
        }
        return node;
    }

    private onStartGame() {
        if (this.isStarting) return;
        const panel = this.playButton?.parent?.parent
            ?.getChildByName('MainMenuSettingsPanel');
        if (panel?.active) return;

        this.isStarting = true;
        LevelSession.allowGameEntry();
        director.loadScene('Game');
    }

    onDestroy() {
        this.playButton?.off(Button.EventType.CLICK, this.onStartGame, this);
    }
}
