import {
    _decorator, Component, JsonAsset, Sprite, SpriteFrame,
    UITransform, Node, Color, Layers, resources
} from 'cc';

const { ccclass, property } = _decorator;

type BeadInfo = {
    id: number;
    x: number; // 源图片像素坐标，从左到右
    y: number; // 源图片像素坐标，从上到下
    color: 'blue' | 'white';
    row: number;
    col: number;
};

type VaseLevel = {
    imageWidth: number;
    imageHeight: number;
    beads: BeadInfo[];
};

/**
 * 第一关视觉验证器。挂在现有 TargetPreview 节点上。
 * exactMode=true：显示原始高清瓷瓶图片，视觉效果与参考图一致。
 * exactMode=false：用 JSON 珠位批量绘制圆形，检查后续可交互数据的形状。
 * V1 不处理移动、托盘、通关；不会修改现有 BoardManager/GemCell。
 */
@ccclass('ArtifactVaseV1')
export class ArtifactVaseV1 extends Component {
    @property(SpriteFrame)
    artwork: SpriteFrame | null = null;

    @property(JsonAsset)
    levelData: JsonAsset | null = null;

    @property(SpriteFrame)
    blueGem: SpriteFrame | null = null;

    @property(SpriteFrame)
    whiteGem: SpriteFrame | null = null;

    @property
    exactMode = false;

    @property
    maxDisplayWidth = 580;

    @property
    maxDisplayHeight = 740;

    private mosaicNode: Node | null = null;

    start(): void {
        this.showVase();
    }

    public showVase(): void {
        if (!this.levelData) {
            console.error('[ArtifactVaseV1] 请绑定 levelData');
            return;
        }
        const data = this.levelData.json as VaseLevel;
        if (!data || !Array.isArray(data.beads) || !data.imageWidth || !data.imageHeight) {
            console.error('[ArtifactVaseV1] levelData 无效');
            return;
        }

        const scale = Math.min(
            this.maxDisplayWidth / data.imageWidth,
            this.maxDisplayHeight / data.imageHeight
        );
        const width = data.imageWidth * scale;
        const height = data.imageHeight * scale;
        const transform = this.getComponent(UITransform) || this.addComponent(UITransform);
        transform.setContentSize(width, height);

        const sprite = this.getComponent(Sprite);
        if (sprite) {
            sprite.enabled = this.exactMode && !!this.artwork;
            if (this.exactMode && this.artwork) {
                sprite.spriteFrame = this.artwork;
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }
        }

        this.hideOldOverlay();

        if (this.mosaicNode) {
            this.mosaicNode.destroy();
            this.mosaicNode = null;
        }
        if (!this.exactMode) {
            this.ensureGemFrames(() => {
                this.renderMosaic(data, scale, width, height);
            });
        }
        console.log(`[ArtifactVaseV1] ${this.exactMode ? '高清原图' : '珠位测试'}，${data.beads.length} 个目标珠位`);
    }

    private ensureGemFrames(done: () => void) {
        if (this.blueGem && this.whiteGem) {
            done();
            return;
        }

        let pending = 2;
        const finish = () => {
            pending -= 1;
            if (pending === 0) done();
        };

        this.loadGem('gems/gem_blue/spriteFrame', (frame) => {
            if (frame) this.blueGem = frame;
            finish();
        });
        this.loadGem('gems/gem_white/spriteFrame', (frame) => {
            if (frame) this.whiteGem = frame;
            finish();
        });
    }

    private loadGem(path: string, done: (frame: SpriteFrame | null) => void) {
        resources.load(path, SpriteFrame, (error, frame) => {
            if (error || !frame) {
                console.error(`[ArtifactVaseV1] 加载 ${path} 失败`, error);
                done(null);
                return;
            }
            done(frame);
        });
    }

    private hideOldOverlay() {
        const parent = this.node.parent;
        if (!parent) return;

        for (const name of ['CompletePanel', 'LevelLabel', 'BoardContainer', 'TrayContainer']) {
            const node = parent.getChildByName(name);
            if (node) node.active = false;
        }
    }

    private renderMosaic(data: VaseLevel, scale: number, width: number, height: number): void {
        if (!this.blueGem || !this.whiteGem) {
            console.error('[ArtifactVaseV1] 请绑定 Blue Gem 和 White Gem');
            return;
        }

        const node = new Node('VaseMosaicPreview');
        node.layer = Layers.Enum.UI_2D;
        node.parent = this.node;
        node.setPosition(0, 0, 0);
        node.addComponent(UITransform).setContentSize(width, height);

        const beadSize = Math.max(8, (width / 36) * 0.92);

        for (const bead of data.beads) {
            const frame = bead.color === 'blue' ? this.blueGem : this.whiteGem;
            const gem = new Node(`Bead_${bead.id}`);
            gem.layer = Layers.Enum.UI_2D;
            gem.parent = node;

            const ui = gem.addComponent(UITransform);
            const sprite = gem.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            sprite.color = Color.WHITE;
            ui.setContentSize(beadSize, beadSize);

            const x = (bead.x - data.imageWidth / 2) * scale;
            const y = (data.imageHeight / 2 - bead.y) * scale;
            gem.setPosition(x, y, 0);
        }

        this.mosaicNode = node;
    }
}
