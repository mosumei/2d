import {
    _decorator, Component, Node, Prefab, instantiate, Button, Sprite,
    SpriteFrame, Label, resources, isValid, UITransform, Color,
    Graphics, Layers, BlockInputEvents
} from 'cc';
import { ARTIFACTS, ArtifactCollectionManager } from '../core/ArtifactCollectionManager';

const { ccclass, property } = _decorator;

const CARD_WIDTH = 230;
const CARD_HEIGHT = 280;

@ccclass('ArtifactCollectionUI')
export class ArtifactCollectionUI extends Component {
    @property(Node) content: Node | null = null;
    @property(Prefab) itemPrefab: Prefab | null = null;
    @property(Button) closeButton: Button | null = null;
    @property(Label) counterLabel: Label | null = null;

    private version = 0;
    private detailToken = 0;
    private built = false;
    private detail: Node | null = null;
    private detailImage: Sprite | null = null;
    private detailName: Label | null = null;
    private detailState: Label | null = null;
    private detailLevel: Label | null = null;
    private detailKeep: Label | null = null;

    onLoad() {
        this.ensureBuilt();
    }

    public show() {
        this.ensureBuilt();
        this.node.active = true;
        const parent = this.node.parent;
        if (parent) {
            this.node.setSiblingIndex(parent.children.length - 1);
        }
        this.closeDetail();
        this.refresh();
    }

    public hide() {
        this.version++;
        this.detailToken++;
        this.closeDetail();
        this.node.active = false;
    }

    public refresh() {
        this.ensureBuilt();
        if (!this.content) {
            console.error('[CollectionUI] 请绑定 Content');
            return;
        }

        const token = ++this.version;
        for (const child of [...this.content.children]) child.destroy();

        const owned = ArtifactCollectionManager.getAll();
        if (this.counterLabel) {
            this.counterLabel.string = `已修复 ${owned.length} 件`;
        }

        const visible = owned.filter(record => ARTIFACTS[record.level]);
        const gap = 310;
        const start = visible.length > 0 ? ((visible.length - 1) * gap) / 2 : 0;

        for (let index = 0; index < visible.length; index++) {
            const record = visible[index];
            const info = ARTIFACTS[record.level];
            const item = this.createItem();
            item.parent = this.content;
            item.name = `Artifact_${record.level}`;
            item.setPosition(0, start - index * gap, 0);
            item.on(Node.EventType.TOUCH_END, () => {
                this.openDetail(record.level);
            }, this);

            const title = item.getChildByName('Name')?.getComponent(Label);
            if (title) title.string = info.name;

            const image = item.getChildByName('Artwork')?.getComponent(Sprite);
            if (!image) continue;
            image.spriteFrame = null;
            resources.load(info.image + '/spriteFrame', SpriteFrame, (err, frame) => {
                if (err || !frame || token !== this.version || !isValid(item)) return;
                this.applyFrame(image, frame, 190, 158);
            });
        }
    }

    private openDetail(level: number) {
        const info = ARTIFACTS[level];
        if (!info || !this.detail) return;

        this.detail.active = true;
        this.detail.setSiblingIndex(this.node.children.length - 1);
        if (this.detailName) this.detailName.string = info.name;
        if (this.detailState) this.detailState.string = '已修复 · 已收藏';
        if (this.detailLevel) this.detailLevel.string = `所属关卡    LEVEL ${level}`;
        if (this.detailKeep) this.detailKeep.string = '收藏状态    永久收藏（本机）';
        if (this.detailImage) {
            this.detailImage.spriteFrame = null;
            this.detailImage.node.active = false;
        }

        const token = ++this.detailToken;
        resources.load(info.image + '/spriteFrame', SpriteFrame, (err, frame) => {
            if (err || !frame || token !== this.detailToken || !this.detail?.active) return;
            if (!this.detailImage || !isValid(this.detailImage.node)) return;
            this.detailImage.node.active = true;
            this.applyFrame(this.detailImage, frame, 400, 334);
        });
    }

    private closeDetail() {
        this.detailToken++;
        if (this.detail) this.detail.active = false;
    }

    private ensureBuilt() {
        if (this.built) return;
        this.built = true;

        this.node.layer = Layers.Enum.UI_2D;
        const root = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        root.setContentSize(720, 1280);
        if (!this.node.getComponent(BlockInputEvents)) {
            this.node.addComponent(BlockInputEvents);
        }
        if (!this.node.getComponent(Graphics)) {
            const backdrop = this.node.addComponent(Graphics);
            backdrop.fillColor = new Color(18, 28, 42, 168);
            backdrop.rect(-360, -640, 720, 1280);
            backdrop.fill();
        }

        const floor = new Node('CollectionFloor');
        floor.layer = Layers.Enum.UI_2D;
        floor.parent = this.node;
        floor.addComponent(UITransform).setContentSize(640, 1040);
        const floorGraphics = floor.addComponent(Graphics);
        floorGraphics.fillColor = new Color(255, 246, 230, 255);
        floorGraphics.roundRect(-320, -520, 640, 1040, 28);
        floorGraphics.fill();

        if (!this.node.getChildByName('CollectionTitle')) {
            const title = this.makeLabel('CollectionTitle', '我的文物收藏', 40, 470, new Color(92, 58, 32, 255));
            title.node.parent = this.node;
        }

        if (!this.counterLabel) {
            this.counterLabel = this.makeLabel('CounterLabel', '已修复 0 件', 24, 415, new Color(120, 86, 52, 255));
            this.counterLabel.node.parent = this.node;
        }

        if (!this.content) {
            const content = new Node('Content');
            content.layer = Layers.Enum.UI_2D;
            content.parent = this.node;
            content.setPosition(0, 20, 0);
            content.addComponent(UITransform).setContentSize(640, 700);
            this.content = content;
        }

        const oldClose = this.node.getChildByName('CloseButton');
        oldClose?.destroy();
        this.closeButton = this.makeIconButton('CloseButton', '×', 300, 500, 64, this.hide);
        this.ensureDetail();
    }

    private ensureDetail() {
        const detail = new Node('ArtifactDetailPanel');
        detail.layer = Layers.Enum.UI_2D;
        detail.parent = this.node;
        detail.active = false;
        detail.addComponent(UITransform).setContentSize(720, 1280);
        detail.addComponent(BlockInputEvents);
        const dim = detail.addComponent(Graphics);
        dim.fillColor = new Color(18, 28, 42, 210);
        dim.rect(-360, -640, 720, 1280);
        dim.fill();

        const card = new Node('DetailCard');
        card.layer = Layers.Enum.UI_2D;
        card.parent = detail;
        card.addComponent(UITransform).setContentSize(520, 820);
        const cardGraphics = card.addComponent(Graphics);
        cardGraphics.fillColor = new Color(255, 248, 236, 255);
        cardGraphics.roundRect(-260, -410, 520, 820, 24);
        cardGraphics.fill();

        const artwork = new Node('DetailArtwork');
        artwork.layer = Layers.Enum.UI_2D;
        artwork.parent = card;
        artwork.setPosition(0, 150, 0);
        artwork.addComponent(UITransform).setContentSize(400, 334);
        this.detailImage = artwork.addComponent(Sprite);
        this.detailImage.sizeMode = Sprite.SizeMode.CUSTOM;

        this.detailName = this.makeLabel('DetailName', '', 36, 0, new Color(92, 58, 32, 255));
        this.detailName.node.parent = card;
        this.detailName.node.setPosition(0, -50, 0);

        this.detailState = this.makeLabel('DetailState', '', 24, 0, new Color(120, 86, 52, 255));
        this.detailState.node.parent = card;
        this.detailState.node.setPosition(0, -98, 0);

        this.detailLevel = this.makeLabel('DetailLevel', '', 22, 0, new Color(72, 52, 32, 255));
        this.detailLevel.node.parent = card;
        this.detailLevel.node.setPosition(0, -160, 0);

        this.detailKeep = this.makeLabel('DetailKeep', '', 22, 0, new Color(72, 52, 32, 255));
        this.detailKeep.node.parent = card;
        this.detailKeep.node.setPosition(0, -204, 0);

        this.makeTextButton(card, '返回', 0, -320, () => this.closeDetail());
        this.detail = detail;
    }

    private createItem(): Node {
        if (this.itemPrefab) {
            return instantiate(this.itemPrefab);
        }

        const item = new Node('ArtifactItem');
        item.layer = Layers.Enum.UI_2D;
        item.addComponent(UITransform).setContentSize(CARD_WIDTH, CARD_HEIGHT);
        const card = item.addComponent(Graphics);
        card.fillColor = new Color(255, 252, 246, 255);
        card.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 16);
        card.fill();
        card.strokeColor = new Color(210, 176, 130, 255);
        card.lineWidth = 3;
        card.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 16);
        card.stroke();

        const artwork = new Node('Artwork');
        artwork.layer = Layers.Enum.UI_2D;
        artwork.parent = item;
        artwork.setPosition(0, 28, 0);
        artwork.addComponent(UITransform).setContentSize(190, 158);
        const sprite = artwork.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const name = this.makeLabel('Name', '', 26, -108, new Color(92, 58, 32, 255));
        name.node.parent = item;
        name.node.getComponent(UITransform)?.setContentSize(200, 36);
        return item;
    }

    private applyFrame(sprite: Sprite, frame: SpriteFrame, maxWidth: number, maxHeight: number) {
        const source = frame.originalSize;
        const width = source.width > 0 ? source.width : maxWidth;
        const height = source.height > 0 ? source.height : maxHeight;
        const scale = Math.min(maxWidth / width, maxHeight / height);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        sprite.color = Color.WHITE;
        sprite.getComponent(UITransform)?.setContentSize(width * scale, height * scale);
    }

    private makeIconButton(
        name: string,
        text: string,
        x: number,
        y: number,
        size: number,
        handler: () => void
    ): Button {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.node;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(size, size);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(255, 248, 236, 255);
        graphics.circle(0, 0, size / 2);
        graphics.fill();
        const label = this.makeLabel('ButtonLabel', text, 36, 0, new Color(92, 58, 32, 255));
        label.node.parent = node;
        label.node.getComponent(UITransform)?.setContentSize(size, size);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.08;
        node.on(Button.EventType.CLICK, handler, this);
        return button;
    }

    private makeTextButton(parent: Node, text: string, x: number, y: number, handler: () => void) {
        const node = new Node('BackButton');
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(180, 48);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(92, 64, 42, 255);
        graphics.roundRect(-90, -24, 180, 48, 12);
        graphics.fill();
        const label = this.makeLabel('ButtonLabel', text, 24, 0, new Color(255, 248, 236, 255));
        label.node.parent = node;
        label.node.getComponent(UITransform)?.setContentSize(160, 36);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, handler, this);
    }

    private makeLabel(name: string, text: string, fontSize: number, y: number, color: Color): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(0, y, 0);
        node.addComponent(UITransform).setContentSize(420, fontSize + 16);
        const label = node.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    onDestroy() {
        this.version++;
        this.detailToken++;
        this.closeButton?.node?.off(Button.EventType.CLICK, this.hide, this);
    }
}
