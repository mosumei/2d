import {
    assetManager,
    BlockInputEvents,
    Button,
    Color,
    EditBox,
    Graphics,
    ImageAsset,
    Label,
    Layers,
    Mask,
    Node,
    Rect,
    resources,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    tween,
    Tween,
    UITransform
} from 'cc';

import { localize } from '../core/Locale';
import { fillVisibleCanvas, paintVisibleRect } from '../core/VisibleCanvas';

const CARD_WIDTH = 605;
const CARD_HEIGHT = 797;
const MAX_PHOTOS = 3;
const MAX_TEXT = 500;
const SLOT_WIDTH = 156;
const SLOT_HEIGHT = 140;

const BROWN = new Color(110, 64, 32, 255);
const TEXT = new Color(92, 58, 32, 255);
const HINT = new Color(176, 136, 96, 255);
const PLACEHOLDER = new Color(186, 150, 112, 255);
const STAR = new Color(210, 48, 42, 255);
const FIELD_FILL = new Color(252, 246, 236, 255);
const FIELD_STROKE = new Color(214, 176, 122, 255);

type ChosenImage = { tempFilePath?: string };
type ChooseResult = { tempFilePaths?: string[]; tempFiles?: ChosenImage[] };
type ChooseFailure = { errMsg?: string };
type ImageChooser = {
    chooseMedia?: (options: {
        count: number;
        mediaType?: string[];
        sizeType?: string[];
        sourceType?: string[];
        success?: (result: ChooseResult) => void;
        fail?: (error: ChooseFailure) => void;
    }) => void;
    chooseImage?: (options: {
        count: number;
        sizeType?: string[];
        sourceType?: string[];
        success?: (result: ChooseResult) => void;
        fail?: (error: ChooseFailure) => void;
    }) => void;
};

type LoadedPhoto = { frame: SpriteFrame; texture: Texture2D };

/**
 * 首页设置里的意见反馈。弹窗在运行时搭出来，不改主菜单场景。
 */
export class FeedbackPanel {
    private static readonly photos = new Map<Node, LoadedPhoto>();
    private static readonly submitted = new Set<Node>();

    /**
     * 打开意见反馈。已经打开时只把弹窗放到最前面。
     * @param canvas 主菜单画布
     */
    public static open(canvas: Node): void {
        const panel = FeedbackPanel.ensure(canvas);
        FeedbackPanel.reset(panel);
        panel.active = true;
        panel.setSiblingIndex(canvas.children.length - 1);
    }

    private static ensure(canvas: Node): Node {
        const existing = canvas.getChildByName('FeedbackPanel');
        if (existing) return existing;

        const panel = new Node('FeedbackPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.parent = canvas;

        const dim = new Node('Dim');
        dim.layer = Layers.Enum.UI_2D;
        dim.parent = panel;
        const dimTransform = dim.addComponent(UITransform);
        dim.addComponent(BlockInputEvents);
        const dimGraphics = dim.addComponent(Graphics);
        dimGraphics.fillColor = new Color(20, 24, 32, 150);
        paintVisibleRect(dimGraphics, fillVisibleCanvas(dimTransform));
        dim.on(Node.EventType.TOUCH_END, () => FeedbackPanel.close(panel));

        const card = new Node('Card');
        card.layer = Layers.Enum.UI_2D;
        card.parent = panel;
        card.setPosition(0, 8, 0);
        card.addComponent(UITransform).setContentSize(CARD_WIDTH, CARD_HEIGHT);
        card.addComponent(BlockInputEvents);
        FeedbackPanel.addSprite(card, 'ui/feedback/panel/spriteFrame', CARD_WIDTH, CARD_HEIGHT);

        const titleFrame = new Node('TitleFrame');
        titleFrame.layer = Layers.Enum.UI_2D;
        titleFrame.parent = card;
        titleFrame.setPosition(0, CARD_HEIGHT / 2 - 6, 0);
        titleFrame.addComponent(UITransform).setContentSize(330, 132);
        FeedbackPanel.addSprite(titleFrame, 'ui/feedback/title_frame/spriteFrame', 330, 132);

        const title = FeedbackPanel.addLabel(card, '', 240, 56, 40, BROWN, Label.HorizontalAlign.CENTER, true);
        title.node.name = 'PanelTitle';
        title.node.setPosition(0, CARD_HEIGHT / 2 - 18, 0);

        FeedbackPanel.addCloseButton(card, () => FeedbackPanel.close(panel));
        FeedbackPanel.addProblem(card);
        FeedbackPanel.addInput(card, panel);
        FeedbackPanel.addUpload(card);
        FeedbackPanel.addPhotoRow(card, panel);
        FeedbackPanel.addSubmit(card, panel);

        const tip = FeedbackPanel.addLabel(panel, '', 460, 36, 22, BROWN, Label.HorizontalAlign.CENTER, true);
        tip.node.name = 'Tip';
        tip.node.setPosition(0, 8 - CARD_HEIGHT / 2 - 36, 0);

        return panel;
    }

    private static addProblem(card: Node): void {
        const label = FeedbackPanel.addLabel(card, '', 150, 40, 28, BROWN, Label.HorizontalAlign.LEFT, true);
        label.node.name = 'ProblemLabel';
        label.node.setPosition(-168, 268, 0);
        const star = FeedbackPanel.addLabel(card, '*', 24, 40, 28, STAR, Label.HorizontalAlign.LEFT, true);
        star.node.name = 'ProblemStar';
        star.node.setPosition(-70, 268, 0);
    }

    private static addInput(card: Node, panel: Node): void {
        const width = 500;
        const height = 176;
        const well = new Node('InputWell');
        well.layer = Layers.Enum.UI_2D;
        well.parent = card;
        well.setPosition(0, 146, 0);
        well.addComponent(UITransform).setContentSize(width, height);
        const plate = well.addComponent(Graphics);
        plate.fillColor = FIELD_FILL;
        plate.roundRect(-width / 2, -height / 2, width, height, 22);
        plate.fill();
        plate.lineWidth = 2;
        plate.strokeColor = FIELD_STROKE;
        plate.roundRect(-width / 2, -height / 2, width, height, 22);
        plate.stroke();

        const editNode = new Node('Description');
        editNode.layer = Layers.Enum.UI_2D;
        editNode.parent = well;
        editNode.setPosition(0, 16, 0);
        editNode.addComponent(UITransform).setContentSize(468, 124);
        const text = FeedbackPanel.makeFieldLabel(editNode, 'TEXT_LABEL', TEXT);
        const placeholder = FeedbackPanel.makeFieldLabel(editNode, 'PLACEHOLDER_LABEL', PLACEHOLDER);
        const edit = editNode.addComponent(EditBox);
        edit.textLabel = text;
        edit.placeholderLabel = placeholder;
        edit.inputMode = EditBox.InputMode.ANY;
        edit.returnType = EditBox.KeyboardReturnType.DONE;
        edit.maxLength = MAX_TEXT;
        editNode.on(EditBox.EventType.TEXT_CHANGED, () => FeedbackPanel.refreshCount(panel));

        const counter = FeedbackPanel.addLabel(well, '', 120, 32, 20, HINT, Label.HorizontalAlign.RIGHT, false);
        counter.node.name = 'Counter';
        counter.node.setPosition(176, -62, 0);
    }

    private static makeFieldLabel(parent: Node, name: string, color: Color): Label {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.addComponent(UITransform).setAnchorPoint(0, 1);
        const label = node.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'PingFang SC';
        label.fontSize = 24;
        label.lineHeight = 32;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.TOP;
        label.overflow = Label.Overflow.CLAMP;
        label.enableWrapText = true;
        return label;
    }

    private static addUpload(card: Node): void {
        const title = FeedbackPanel.addLabel(card, '', 150, 36, 26, BROWN, Label.HorizontalAlign.LEFT, true);
        title.node.name = 'UploadLabel';
        title.node.setPosition(-168, 18, 0);
        const hint = FeedbackPanel.addLabel(card, '', 240, 36, 22, HINT, Label.HorizontalAlign.LEFT, false);
        hint.node.name = 'UploadHint';
        hint.node.setPosition(28, 18, 0);
    }

    private static addPhotoRow(card: Node, panel: Node): void {
        const row = new Node('PhotoRow');
        row.layer = Layers.Enum.UI_2D;
        row.parent = card;
        row.setPosition(0, -108, 0);
        row.addComponent(UITransform).setContentSize(500, SLOT_HEIGHT);

        const add = new Node('AddPhoto');
        add.layer = Layers.Enum.UI_2D;
        add.parent = row;
        add.addComponent(UITransform).setContentSize(SLOT_WIDTH, SLOT_HEIGHT);
        FeedbackPanel.addSprite(add, 'ui/feedback/btn_add/spriteFrame', SLOT_WIDTH, SLOT_HEIGHT);
        const button = add.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.04;
        add.on(Button.EventType.CLICK, () => FeedbackPanel.pickImages(panel));
    }

    private static addSubmit(card: Node, panel: Node): void {
        const node = new Node('Submit');
        node.layer = Layers.Enum.UI_2D;
        node.parent = card;
        node.setPosition(0, -286, 0);
        node.addComponent(UITransform).setContentSize(482, 165);
        FeedbackPanel.addSprite(node, 'ui/feedback/btn_submit/spriteFrame', 482, 165);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.03;
        node.on(Button.EventType.CLICK, () => FeedbackPanel.submit(panel));
        const label = FeedbackPanel.addLabel(node, '', 280, 56, 34, Color.WHITE, Label.HorizontalAlign.CENTER, true);
        label.node.name = 'SubmitLabel';
        label.node.setPosition(0, 2, 0);
    }

    private static addCloseButton(card: Node, onClick: () => void): void {
        const node = new Node('CloseButton');
        node.layer = Layers.Enum.UI_2D;
        node.parent = card;
        node.setPosition(262, 368, 0);
        node.addComponent(UITransform).setContentSize(88, 88);
        FeedbackPanel.addSprite(node, 'ui/feedback/btn_close/spriteFrame', 88, 88);
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.06;
        node.on(Button.EventType.CLICK, onClick);
    }

    private static reset(panel: Node): void {
        FeedbackPanel.submitted.delete(panel);
        const edit = FeedbackPanel.description(panel);
        if (edit) {
            edit.string = '';
            edit.blur();
        }
        const row = panel.getChildByName('Card')?.getChildByName('PhotoRow');
        if (row) {
            for (const child of [...row.children]) {
                if (child.name !== 'Photo') continue;
                FeedbackPanel.releasePhoto(child);
                child.destroy();
            }
        }
        FeedbackPanel.layoutPhotos(panel);
        FeedbackPanel.refresh(panel);
        FeedbackPanel.showTip(panel, '');
    }

    private static close(panel: Node): void {
        FeedbackPanel.description(panel)?.blur();
        panel.active = false;
    }

    private static submit(panel: Node): void {
        if (FeedbackPanel.submitted.has(panel)) return;
        const edit = FeedbackPanel.description(panel);
        const text = edit?.string.trim() ?? '';
        if (!text) {
            FeedbackPanel.showTip(panel, localize('请填写问题描述', 'Please describe the problem'));
            return;
        }
        FeedbackPanel.submitted.add(panel);
        FeedbackPanel.showTip(panel, localize('已提交', 'Submitted'));
        const tip = panel.getChildByName('Tip');
        if (!tip) {
            FeedbackPanel.close(panel);
            return;
        }
        tween(tip)
            .delay(0.7)
            .call(() => {
                if (panel.isValid) FeedbackPanel.close(panel);
            })
            .start();
    }

    private static refresh(panel: Node): void {
        const card = panel.getChildByName('Card');
        const title = card?.getChildByName('PanelTitle')?.getComponent(Label);
        if (title) title.string = localize('意见反馈', 'Feedback');
        const problem = card?.getChildByName('ProblemLabel')?.getComponent(Label);
        if (problem) problem.string = localize('问题描述', 'Problem');
        const upload = card?.getChildByName('UploadLabel')?.getComponent(Label);
        if (upload) upload.string = localize('上传图片', 'Upload images');
        const hint = card?.getChildByName('UploadHint')?.getComponent(Label);
        if (hint) hint.string = localize('(选填，最多3张)', '(Optional, up to 3)');
        const submit = card?.getChildByName('Submit')?.getChildByName('SubmitLabel')?.getComponent(Label);
        if (submit) submit.string = localize('提交反馈', 'Submit');
        const edit = FeedbackPanel.description(panel);
        if (edit) edit.placeholder = localize('请详细描述您遇到的问题...', 'Please describe the problem...');
        FeedbackPanel.refreshCount(panel);
    }

    private static refreshCount(panel: Node): void {
        const counter = panel.getChildByName('Card')
            ?.getChildByName('InputWell')
            ?.getChildByName('Counter')
            ?.getComponent(Label);
        const length = FeedbackPanel.description(panel)?.string.length ?? 0;
        if (counter) counter.string = `${length}/${MAX_TEXT}`;
    }

    private static description(panel: Node): EditBox | null {
        return panel.getChildByName('Card')
            ?.getChildByName('InputWell')
            ?.getChildByName('Description')
            ?.getComponent(EditBox) ?? null;
    }

    private static pickImages(panel: Node): void {
        const room = MAX_PHOTOS - FeedbackPanel.photoCount(panel);
        if (room <= 0 || FeedbackPanel.submitted.has(panel)) return;
        const chooser = FeedbackPanel.imageChooser();
        if (!chooser) {
            FeedbackPanel.showTip(panel, localize('请在微信里选择图片', 'Choose images in WeChat'));
            return;
        }
        const finish = (result: ChooseResult): void => {
            if (!panel.isValid || !panel.active) return;
            for (const path of FeedbackPanel.chosenPaths(result)) {
                FeedbackPanel.loadPhoto(panel, path);
            }
        };
        const fail = (error: ChooseFailure): void => {
            const message = error.errMsg ?? '';
            if (message.includes('cancel') || !panel.isValid) return;
            FeedbackPanel.showTip(panel, localize('没有选到图片', 'No image selected'));
        };
        if (chooser.chooseMedia) {
            chooser.chooseMedia({
                count: room,
                mediaType: ['image'],
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: finish,
                fail
            });
            return;
        }
        chooser.chooseImage?.({
            count: room,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: finish,
            fail
        });
    }

    private static imageChooser(): ImageChooser | null {
        const env = globalThis as { wx?: ImageChooser; tt?: ImageChooser };
        if (env.wx?.chooseMedia || env.wx?.chooseImage) return env.wx;
        if (env.tt?.chooseMedia || env.tt?.chooseImage) return env.tt ?? null;
        return null;
    }

    private static chosenPaths(result: ChooseResult): string[] {
        const fromFiles = (result.tempFiles ?? [])
            .map(file => file.tempFilePath ?? '')
            .filter(path => path.length > 0);
        if (fromFiles.length > 0) return fromFiles;
        return (result.tempFilePaths ?? []).filter(path => path.length > 0);
    }

    private static loadPhoto(panel: Node, path: string): void {
        assetManager.loadRemote<ImageAsset>(path, { ext: FeedbackPanel.imageExt(path) }, (error, image) => {
            if (!panel.isValid || !panel.active) return;
            if (error || !image || image.width < 1 || image.height < 1) {
                FeedbackPanel.showTip(panel, localize('图片没有加上', 'Could not add the image'));
                return;
            }
            if (FeedbackPanel.photoCount(panel) >= MAX_PHOTOS) return;
            FeedbackPanel.addPhoto(panel, image);
        });
    }

    private static imageExt(path: string): string {
        const clean = path.split('?')[0].toLowerCase();
        if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return '.jpg';
        if (clean.endsWith('.webp')) return '.webp';
        return '.png';
    }

    private static addPhoto(panel: Node, image: ImageAsset): void {
        const row = panel.getChildByName('Card')?.getChildByName('PhotoRow');
        if (!row) return;
        const texture = new Texture2D();
        texture.image = image;
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = new Rect(0, 0, image.width, image.height);
        frame.originalSize = new Size(image.width, image.height);

        const slot = new Node('Photo');
        slot.layer = Layers.Enum.UI_2D;
        slot.parent = row;
        slot.addComponent(UITransform).setContentSize(SLOT_WIDTH, SLOT_HEIGHT);
        FeedbackPanel.photos.set(slot, { frame, texture });

        const clip = new Node('Image');
        clip.layer = Layers.Enum.UI_2D;
        clip.parent = slot;
        clip.addComponent(UITransform).setContentSize(SLOT_WIDTH, SLOT_HEIGHT);
        const mask = clip.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;

        const picture = new Node('Picture');
        picture.layer = Layers.Enum.UI_2D;
        picture.parent = clip;
        const pictureTransform = picture.addComponent(UITransform);
        const cover = Math.max(SLOT_WIDTH / image.width, SLOT_HEIGHT / image.height);
        pictureTransform.setContentSize(image.width * cover, image.height * cover);
        const sprite = picture.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;

        const remove = new Node('Remove');
        remove.layer = Layers.Enum.UI_2D;
        remove.parent = slot;
        remove.setPosition(SLOT_WIDTH / 2 - 8, SLOT_HEIGHT / 2 - 8, 0);
        remove.addComponent(UITransform).setContentSize(36, 36);
        FeedbackPanel.addSprite(remove, 'ui/feedback/icon_remove/spriteFrame', 28, 28);
        const button = remove.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.08;
        remove.on(Button.EventType.CLICK, () => {
            FeedbackPanel.releasePhoto(slot);
            slot.destroy();
            FeedbackPanel.layoutPhotos(panel);
        });
        FeedbackPanel.layoutPhotos(panel);
    }

    private static releasePhoto(slot: Node): void {
        const owned = FeedbackPanel.photos.get(slot);
        FeedbackPanel.photos.delete(slot);
        owned?.frame.destroy();
        owned?.texture.destroy();
    }

    private static photoCount(panel: Node): number {
        const row = panel.getChildByName('Card')?.getChildByName('PhotoRow');
        if (!row) return 0;
        return row.children.filter(child => child.name === 'Photo').length;
    }

    private static layoutPhotos(panel: Node): void {
        const row = panel.getChildByName('Card')?.getChildByName('PhotoRow');
        const add = row?.getChildByName('AddPhoto');
        if (!row || !add) return;
        const photos = row.children.filter(child => child.name === 'Photo');
        add.active = photos.length < MAX_PHOTOS;
        const items = add.active ? [add, ...photos] : photos;
        const gap = 14;
        const total = items.length * SLOT_WIDTH + Math.max(0, items.length - 1) * gap;
        let x = -total / 2 + SLOT_WIDTH / 2;
        for (const item of items) {
            item.setPosition(x, 0, 0);
            x += SLOT_WIDTH + gap;
        }
    }

    private static showTip(panel: Node, text: string): void {
        const tip = panel.getChildByName('Tip');
        const label = tip?.getComponent(Label);
        if (!tip || !label) return;
        Tween.stopAllByTarget(tip);
        label.string = text;
        if (!text) return;
        tween(tip)
            .delay(1.4)
            .call(() => {
                if (label.isValid && !FeedbackPanel.submitted.has(panel)) label.string = '';
            })
            .start();
    }

    private static addSprite(parent: Node, path: string, width: number, height: number): Sprite {
        const sprite = parent.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame || !parent.isValid) {
                if (error) console.error(`[Feedback] 加载 ${path} 失败`, error);
                return;
            }
            sprite.spriteFrame = frame;
        });
        parent.getComponent(UITransform)?.setContentSize(width, height);
        return sprite;
    }

    private static addLabel(
        parent: Node,
        text: string,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        align: Label['horizontalAlign'],
        bold: boolean
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
        label.isBold = bold;
        label.color = color;
        label.horizontalAlign = align;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }
}
