import {
    _decorator, Component, Node, Button, Vec3, tween, Tween,
    Sprite, SpriteFrame, Label, resources, isValid, Color,
    UITransform, Graphics, Layers, BlockInputEvents
} from 'cc';
import { StarRating } from './StarRating';
import { ARTIFACTS } from '../core/ArtifactCollectionManager';

const { ccclass, property } = _decorator;

const CARD_WIDTH = 600;
const CARD_HEIGHT = 750;
const IMAGE_MAX_WIDTH = 168;
const IMAGE_MAX_HEIGHT = 140;

@ccclass('CompletePanelUI')
export class CompletePanelUI extends Component {
    @property(Node) popupCard: Node | null = null;
    @property(Button) nextButton: Button | null = null;
    @property(Button) restartButton: Button | null = null;
    @property(Button) homeButton: Button | null = null;
    @property(StarRating) starRating: StarRating | null = null;

    @property(Sprite) artifactImage: Sprite | null = null;
    @property(Label) artifactName: Label | null = null;
    @property(Label) rewardStatus: Label | null = null;
    @property(Button) collectionButton: Button | null = null;

    public onNext: (() => void) | null = null;
    public onRestart: (() => void) | null = null;
    public onHome: (() => void) | null = null;
    public onCollection: (() => void) | null = null;
    private showToken = 0;

    onLoad() {
        this.ensureRewardNodes();
        this.layoutPopup();
        this.nextButton?.node.on(Button.EventType.CLICK, this.handleNext, this);
        this.restartButton?.node.on(Button.EventType.CLICK, this.handleRestart, this);
        this.homeButton?.node.on(Button.EventType.CLICK, this.handleHome, this);
        this.collectionButton?.node.on(Button.EventType.CLICK, this.handleCollection, this);
    }

    public show(earnedStars: number = 3, level: number = 1, newlyCollected = false) {
        this.layoutPopup();
        this.node.active = true;
        this.starRating?.showStars(earnedStars);
        const artifact = ARTIFACTS[level];
        if (this.artifactName) this.artifactName.string = artifact?.name ?? `LEVEL ${level}`;
        if (this.rewardStatus) {
            this.rewardStatus.string = newlyCollected
                ? '新文物已收藏！'
                : '已收入我的文物收藏';
        }

        const token = ++this.showToken;
        if (this.artifactImage) {
            this.artifactImage.spriteFrame = null;
            this.artifactImage.node.active = false;
            this.artifactImage.node.setScale(1, 1, 1);
        }
        if (artifact && this.artifactImage) {
            const image = this.artifactImage;
            resources.load(artifact.image + '/spriteFrame', SpriteFrame, (err, frame) => {
                if (err || !frame) {
                    console.warn(`[CompletePanel] 图片加载失败 ${artifact.image}`, err);
                    return;
                }
                if (!isValid(this.node) || token !== this.showToken || !this.node.active) return;
                if (!isValid(image.node)) return;
                image.sizeMode = Sprite.SizeMode.CUSTOM;
                image.spriteFrame = frame;
                image.color = Color.WHITE;
                image.node.active = true;
                this.fitRewardImage(image, frame);
            });
        }
        if (!this.popupCard) return;
        Tween.stopAllByTarget(this.popupCard);
        this.popupCard.setScale(0.65, 0.65, 1);
        tween(this.popupCard)
            .to(0.22, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'backOut' })
            .to(0.12, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    public hide() {
        this.showToken++;
        this.node.active = false;
    }

    private ensureRewardNodes() {
        this.ensureDimBackground();
        const card = this.popupCard;
        if (!card) return;

        let area = card.getChildByName('ArtifactRewardArea');
        if (!area) {
            area = new Node('ArtifactRewardArea');
            area.layer = Layers.Enum.UI_2D;
            area.parent = card;
            area.addComponent(UITransform).setContentSize(260, 220);
        }

        if (!this.artifactImage) {
            const node = new Node('ArtifactRewardImage');
            node.layer = Layers.Enum.UI_2D;
            node.parent = area;
            node.addComponent(UITransform).setContentSize(IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = Color.WHITE;
            this.artifactImage = sprite;
        } else if (this.artifactImage.node.parent !== area) {
            this.artifactImage.node.parent = area;
        }

        if (!this.artifactName) {
            this.artifactName = this.makeLabel(area, 'ArtifactName', 28, new Color(255, 252, 245, 255));
        } else if (this.artifactName.node.parent !== area) {
            this.artifactName.node.parent = area;
        }

        if (!this.rewardStatus) {
            this.rewardStatus = this.makeLabel(area, 'RewardStatus', 22, new Color(255, 244, 214, 255));
        } else if (this.rewardStatus.node.parent !== area) {
            this.rewardStatus.node.parent = area;
        }

        if (!this.collectionButton) {
            this.collectionButton = this.makeButton(card, 'CollectionButton', '查看我的文物');
        }
        this.attachButtonLabel(this.collectionButton.node, '查看我的文物');
    }

    private layoutPopup() {
        const card = this.popupCard;
        if (!card) return;

        const cardTransform = card.getComponent(UITransform);
        cardTransform?.setContentSize(CARD_WIDTH, CARD_HEIGHT);
        const cardSprite = card.getComponent(Sprite);
        if (cardSprite) cardSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        this.starRating?.node.setPosition(0, 145, 0);
        this.homeButton?.node.setPosition(-150, -230, 0);
        this.restartButton?.node.setPosition(150, -230, 0);
        this.nextButton?.node.setPosition(0, -305, 0);
        this.homeButton?.node.setScale(0.78, 0.78, 1);
        this.restartButton?.node.setScale(0.78, 0.78, 1);
        this.nextButton?.node.setScale(0.78, 0.78, 1);

        const area = card.getChildByName('ArtifactRewardArea');
        area?.setPosition(0, -5, 0);
        area?.getComponent(UITransform)?.setContentSize(260, 220);
        this.artifactImage?.node.setPosition(0, 42, 0);
        this.artifactName?.node.setPosition(0, -62, 0);
        this.rewardStatus?.node.setPosition(0, -96, 0);
        this.collectionButton?.node.setPosition(0, -155, 0);
    }

    private ensureDimBackground() {
        if (this.node.getChildByName('DimBackground')) return;

        const dim = new Node('DimBackground');
        dim.layer = Layers.Enum.UI_2D;
        dim.parent = this.node;
        dim.setSiblingIndex(0);
        dim.addComponent(UITransform).setContentSize(720, 1280);
        dim.addComponent(BlockInputEvents);
        const graphics = dim.addComponent(Graphics);
        graphics.fillColor = new Color(16, 28, 46, 120);
        graphics.rect(-360, -640, 720, 1280);
        graphics.fill();
    }

    private fitRewardImage(image: Sprite, frame: SpriteFrame) {
        const source = frame.originalSize;
        const width = source.width > 0 ? source.width : IMAGE_MAX_WIDTH;
        const height = source.height > 0 ? source.height : IMAGE_MAX_HEIGHT;
        const scale = Math.min(IMAGE_MAX_WIDTH / width, IMAGE_MAX_HEIGHT / height);
        image.getComponent(UITransform)?.setContentSize(width * scale, height * scale);
    }

    private makeLabel(parent: Node, name: string, fontSize: number, color: Color): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.addComponent(UITransform).setContentSize(250, fontSize + 10);
        const label = node.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.string = '';
        return label;
    }

    private makeButton(parent: Node, name: string, text: string): Button {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.addComponent(UITransform).setContentSize(210, 44);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(255, 248, 236, 255);
        graphics.roundRect(-105, -22, 210, 44, 12);
        graphics.fill();
        this.attachButtonLabel(node, text);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        return button;
    }

    private attachButtonLabel(buttonNode: Node, text: string) {
        buttonNode.getComponent(Label)?.destroy();

        let labelNode = buttonNode.getChildByName('ButtonLabel');
        if (!labelNode) {
            labelNode = new Node('ButtonLabel');
            labelNode.layer = Layers.Enum.UI_2D;
            labelNode.parent = buttonNode;
            labelNode.setPosition(0, 0, 0);
            labelNode.addComponent(UITransform).setContentSize(190, 32);
            labelNode.addComponent(Label);
        }

        const label = labelNode.getComponent(Label);
        if (!label) return;
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.string = text;
        label.fontSize = 22;
        label.lineHeight = 28;
        label.color = new Color(117, 85, 38, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
    }

    private handleNext() { this.onNext?.(); }
    private handleRestart() { this.onRestart?.(); }
    private handleHome() { this.onHome?.(); }
    private handleCollection() { this.onCollection?.(); }

    onDestroy() {
        this.showToken++;
        this.nextButton?.node?.off(Button.EventType.CLICK, this.handleNext, this);
        this.restartButton?.node?.off(Button.EventType.CLICK, this.handleRestart, this);
        this.homeButton?.node?.off(Button.EventType.CLICK, this.handleHome, this);
        this.collectionButton?.node?.off(Button.EventType.CLICK, this.handleCollection, this);
        if (this.popupCard?.isValid) Tween.stopAllByTarget(this.popupCard);
    }
}
