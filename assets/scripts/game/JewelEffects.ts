import {
    _decorator,
    Component,
    Node,
    Prefab,
    instantiate,
    tween,
    Tween,
    Vec3,
    Color,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    Graphics,
    Layers
} from 'cc';

const { ccclass, property } = _decorator;

/**
 * 四套程序动画。光圈、星光和粒子预制体可以后补；
 * 没绑定时仍播放弹跳、闪烁、淡入和金色光晕。
 */
@ccclass('JewelEffects')
export class JewelEffects extends Component {

    @property(Prefab)
    glowPrefab: Prefab | null = null;

    @property(Prefab)
    sparkPrefab: Prefab | null = null;

    @property(Prefab)
    wandFlashPrefab: Prefab | null = null;

    @property(Prefab)
    victoryPrefab: Prefab | null = null;

    private wandRegion: Node | null = null;

    /**
     * 宝石刚正确归位时的弹跳、闪光和星点。
     */
    public playGemPlaced(gem: Node): void {
        if (!gem?.isValid) return;

        Tween.stopAllByTarget(gem);
        gem.setScale(1, 1, 1);
        tween(gem)
            .to(0.12, { scale: new Vec3(1.18, 1.18, 1) }, { easing: 'quadOut' })
            .to(0.1, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'sineInOut' })
            .to(0.12, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineOut' })
            .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' })
            .start();

        this.flashGemSprite(gem);
        this.spawnGlow(gem);
        this.spawnSparks(gem);
    }

    /**
     * 魔法棒施法。闪光和目标闪烁结束后调用 done，再执行原来的归位。
     */
    public playWand(origin: Node, partner: Node, done: () => void): void {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            done();
        };

        if (!origin?.isValid || !partner?.isValid) {
            finish();
            return;
        }

        this.flashCast(origin);
        this.pulseNode(origin);
        this.blinkNode(partner, finish);
        this.scheduleOnce(finish, 0.7);
    }

    /**
     * 棋盘淡出，同级的完整文物淡入。文物不能是棋盘的子节点。
     */
    public playRestoration(board: Node, artifact: Node, done: () => void): void {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            done();
        };

        if (!board?.isValid || !artifact?.isValid) {
            finish();
            return;
        }

        if (this.containsNode(board, artifact)) {
            console.warn('[JewelEffects] 文物节点不能放在棋盘节点下面');
            finish();
            return;
        }

        this.ensureArtifactGlow(artifact);

        const boardOpacity = this.ensureOpacity(board);
        const artifactOpacity = this.ensureOpacity(artifact);
        Tween.stopAllByTarget(boardOpacity);
        Tween.stopAllByTarget(artifactOpacity);
        boardOpacity.opacity = 255;
        artifactOpacity.opacity = 0;
        artifact.active = true;

        let remaining = 2;
        const step = () => {
            remaining -= 1;
            if (remaining <= 0) finish();
        };

        tween(boardOpacity)
            .to(0.55, { opacity: 0 }, { easing: 'sineIn' })
            .call(step)
            .start();
        tween(artifactOpacity)
            .delay(0.15)
            .to(0.7, { opacity: 255 }, { easing: 'sineOut' })
            .call(step)
            .start();
        this.scheduleOnce(finish, 1.15);
    }

    /**
     * 通关面板后面的金色光晕和星星。不改弹窗自身的缩放。
     */
    public playVictory(panel: Node): void {
        if (!panel?.isValid) return;

        this.clearNamed(panel, 'VictoryGlow');
        this.clearNamed(panel, 'VictoryStars');

        if (this.victoryPrefab) {
            const fx = this.attachPrefab(this.victoryPrefab, panel, 'VictoryGlow', 1.8);
            fx?.setSiblingIndex(1);
            return;
        }

        this.spawnVictoryGlow(panel);
        this.spawnVictoryStars(panel);
    }

    /**
     * 进入下一关前恢复棋盘，并藏起文物。
     */
    public resetBoardVisual(board: Node, artifact: Node | null): void {
        this.hideWandRegion();
        const boardOpacity = board.getComponent(UIOpacity);
        if (boardOpacity) {
            Tween.stopAllByTarget(boardOpacity);
            boardOpacity.opacity = 255;
        }

        if (!artifact?.isValid) return;

        const artifactOpacity = artifact.getComponent(UIOpacity);
        if (artifactOpacity) {
            Tween.stopAllByTarget(artifactOpacity);
            artifactOpacity.opacity = 0;
        }
        artifact.active = false;
    }

    /**
     * 在棋盘上框出一块区域，半透明显示每格的正确插槽和正确棋子。
     */
    public showWandRegion(
        board: Node,
        cells: {
            x: number;
            y: number;
            size: number;
            socket: SpriteFrame | null;
            gem: SpriteFrame | null;
        }[],
        wandIcon: SpriteFrame | null
    ): void {
        this.hideWandRegion();
        if (!board?.isValid || cells.length === 0) return;

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const cell of cells) {
            const half = cell.size / 2;
            minX = Math.min(minX, cell.x - half);
            minY = Math.min(minY, cell.y - half);
            maxX = Math.max(maxX, cell.x + half);
            maxY = Math.max(maxY, cell.y + half);
        }

        const pad = 8;
        const left = minX - pad;
        const bottom = minY - pad;
        const width = maxX - minX + pad * 2;
        const height = maxY - minY + pad * 2;

        const root = new Node('WandRegion');
        this.wandRegion = root;
        root.layer = Layers.Enum.UI_2D;
        root.parent = board;
        root.setSiblingIndex(board.children.length - 1);
        root.addComponent(UITransform).setContentSize(width, height);
        const opacity = root.addComponent(UIOpacity);
        opacity.opacity = 0;

        for (const cell of cells) {
            const tile = new Node('CorrectTile');
            tile.layer = Layers.Enum.UI_2D;
            tile.parent = root;
            tile.setPosition(cell.x, cell.y, 0);
            tile.addComponent(UITransform).setContentSize(cell.size, cell.size);

            const socketNode = new Node('Socket');
            socketNode.layer = Layers.Enum.UI_2D;
            socketNode.parent = tile;
            socketNode.addComponent(UITransform).setContentSize(cell.size, cell.size);
            const socket = socketNode.addComponent(Sprite);
            socket.sizeMode = Sprite.SizeMode.CUSTOM;
            socket.spriteFrame = cell.socket;
            socket.color = Color.WHITE;

            if (cell.gem) {
                const gemNode = new Node('Gem');
                gemNode.layer = Layers.Enum.UI_2D;
                gemNode.parent = tile;
                const gemSize = cell.size * 0.5;
                gemNode.addComponent(UITransform).setContentSize(gemSize, gemSize);
                const gem = gemNode.addComponent(Sprite);
                gem.sizeMode = Sprite.SizeMode.CUSTOM;
                gem.spriteFrame = cell.gem;
                gem.color = Color.WHITE;
            }
        }

        const strokes: { color: Color; width: number; inset: number }[] = [
            { color: new Color(255, 90, 190, 255), width: 7, inset: 0 },
            { color: new Color(255, 214, 70, 255), width: 4, inset: 3 },
            { color: new Color(70, 220, 230, 255), width: 3, inset: 6 }
        ];
        for (const stroke of strokes) {
            const frame = new Node('Frame');
            frame.layer = Layers.Enum.UI_2D;
            frame.parent = root;
            frame.addComponent(UITransform).setContentSize(width, height);
            const graphics = frame.addComponent(Graphics);
            graphics.lineWidth = stroke.width;
            graphics.strokeColor = stroke.color;
            graphics.roundRect(
                left + stroke.inset,
                bottom + stroke.inset,
                width - stroke.inset * 2,
                height - stroke.inset * 2,
                16
            );
            graphics.stroke();
        }

        if (wandIcon) {
            const icon = new Node('WandIcon');
            icon.layer = Layers.Enum.UI_2D;
            icon.parent = root;
            icon.setPosition(maxX + 6, minY - 6, 0);
            icon.addComponent(UITransform).setContentSize(42, 42);
            const sprite = icon.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = wandIcon;
        }

        tween(opacity)
            .to(0.18, { opacity: 220 }, { easing: 'sineOut' })
            .start();
    }

    public hideWandRegion(): void {
        if (this.wandRegion?.isValid) this.wandRegion.destroy();
        this.wandRegion = null;
    }

    private flashGemSprite(gem: Node): void {
        const sprite = gem.getChildByName('GemSprite')?.getComponent(Sprite);
        if (!sprite) return;

        Tween.stopAllByTarget(sprite);
        tween(sprite)
            .to(0.1, { color: new Color(255, 244, 180, 255) })
            .to(0.24, { color: new Color(255, 255, 255, 255) })
            .start();
    }

    private spawnGlow(gem: Node): void {
        if (this.glowPrefab) {
            this.attachPrefab(this.glowPrefab, gem, 'PlaceGlow', 0.4);
            return;
        }

        gem.getChildByName('PlaceGlow')?.destroy();
        const size = gem.getComponent(UITransform)?.contentSize.width ?? 60;
        const ring = new Node('PlaceGlow');
        ring.layer = gem.layer;
        ring.parent = gem;
        ring.addComponent(UITransform).setContentSize(size, size);

        const graphics = ring.addComponent(Graphics);
        graphics.lineWidth = Math.max(2, size * 0.06);
        graphics.strokeColor = new Color(255, 214, 96, 230);
        graphics.circle(0, 0, size * 0.38);
        graphics.stroke();

        const opacity = ring.addComponent(UIOpacity);
        opacity.opacity = 230;
        ring.setScale(0.55, 0.55, 1);
        tween(ring)
            .to(0.32, { scale: new Vec3(1.4, 1.4, 1) }, { easing: 'sineOut' })
            .start();
        tween(opacity)
            .to(0.32, { opacity: 0 })
            .call(() => {
                if (ring.isValid) ring.destroy();
            })
            .start();
    }

    private spawnSparks(gem: Node): void {
        if (this.sparkPrefab) {
            this.attachPrefab(this.sparkPrefab, gem, 'PlaceSparks', 0.45);
            return;
        }

        gem.getChildByName('PlaceSparks')?.destroy();
        const root = new Node('PlaceSparks');
        root.layer = gem.layer;
        root.parent = gem;

        const count = 6;
        for (let i = 0; i < count; i++) {
            const dot = new Node(`Spark_${i}`);
            dot.layer = gem.layer;
            dot.parent = root;
            dot.addComponent(UITransform).setContentSize(8, 8);

            const graphics = dot.addComponent(Graphics);
            graphics.fillColor = new Color(255, 236, 170, 255);
            graphics.circle(0, 0, 3);
            graphics.fill();

            const angle = (Math.PI * 2 * i) / count;
            const opacity = dot.addComponent(UIOpacity);
            tween(dot)
                .to(0.28, {
                    position: new Vec3(Math.cos(angle) * 28, Math.sin(angle) * 28, 0)
                }, { easing: 'quadOut' })
                .start();
            tween(opacity).to(0.28, { opacity: 0 }).start();
        }

        tween(root)
            .delay(0.32)
            .call(() => {
                if (root.isValid) root.destroy();
            })
            .start();
    }

    private flashCast(origin: Node): void {
        if (this.wandFlashPrefab) {
            this.attachPrefab(this.wandFlashPrefab, origin, 'WandFlash', 0.45);
            return;
        }

        origin.getChildByName('WandFlash')?.destroy();
        const size = origin.getComponent(UITransform)?.contentSize.width ?? 60;
        const flash = new Node('WandFlash');
        flash.layer = origin.layer;
        flash.parent = origin;
        flash.addComponent(UITransform).setContentSize(size, size);

        const graphics = flash.addComponent(Graphics);
        graphics.fillColor = new Color(255, 244, 190, 150);
        graphics.circle(0, 0, size * 0.46);
        graphics.fill();
        graphics.strokeColor = new Color(255, 255, 240, 230);
        graphics.lineWidth = 3;
        graphics.circle(0, 0, size * 0.28);
        graphics.stroke();

        const opacity = flash.addComponent(UIOpacity);
        flash.setScale(0.4, 0.4, 1);
        tween(flash)
            .to(0.22, { scale: new Vec3(1.5, 1.5, 1) }, { easing: 'quadOut' })
            .start();
        tween(opacity)
            .to(0.28, { opacity: 0 })
            .call(() => {
                if (flash.isValid) flash.destroy();
            })
            .start();
    }

    private pulseNode(node: Node): void {
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        tween(node)
            .to(0.1, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'quadOut' })
            .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' })
            .start();
    }

    private blinkNode(node: Node, done: () => void): void {
        const opacity = this.ensureOpacity(node);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        tween(opacity)
            .to(0.07, { opacity: 50 })
            .to(0.07, { opacity: 255 })
            .to(0.07, { opacity: 50 })
            .to(0.07, { opacity: 255 })
            .to(0.07, { opacity: 80 })
            .to(0.1, { opacity: 255 })
            .call(() => {
                if (opacity.isValid) opacity.opacity = 255;
                done();
            })
            .start();
    }

    private ensureArtifactGlow(artifact: Node): void {
        if (artifact.getChildByName('ArtifactGlow')) return;

        const size = artifact.getComponent(UITransform)?.contentSize;
        const width = size?.width ?? 500;
        const height = size?.height ?? 550;
        const glow = new Node('ArtifactGlow');
        glow.layer = artifact.layer;
        glow.parent = artifact;
        glow.setSiblingIndex(0);
        glow.addComponent(UITransform).setContentSize(width, height);

        const graphics = glow.addComponent(Graphics);
        const radius = Math.min(width, height) * 0.46;
        graphics.fillColor = new Color(255, 214, 120, 80);
        graphics.circle(0, 0, radius);
        graphics.fill();
        graphics.fillColor = new Color(255, 236, 180, 45);
        graphics.circle(0, 0, radius * 1.25);
        graphics.fill();
    }

    private spawnVictoryGlow(panel: Node): void {
        const glow = new Node('VictoryGlow');
        glow.layer = panel.layer;
        glow.parent = panel;
        glow.setSiblingIndex(1);
        glow.addComponent(UITransform).setContentSize(900, 900);

        const graphics = glow.addComponent(Graphics);
        graphics.fillColor = new Color(255, 196, 70, 55);
        graphics.circle(0, 80, 460);
        graphics.fill();
        graphics.fillColor = new Color(255, 230, 150, 40);
        graphics.circle(0, 80, 320);
        graphics.fill();

        const opacity = glow.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity)
            .to(0.35, { opacity: 255 }, { easing: 'sineOut' })
            .start();
    }

    private spawnVictoryStars(panel: Node): void {
        const root = new Node('VictoryStars');
        root.layer = panel.layer;
        root.parent = panel;
        root.setSiblingIndex(1);

        const spots = [
            [-240, 430],
            [-120, 470],
            [0, 500],
            [120, 470],
            [240, 430],
            [-340, 80],
            [340, 80]
        ];

        for (let i = 0; i < spots.length; i++) {
            const spot = spots[i];
            const star = new Node(`VictoryStar_${i}`);
            star.layer = panel.layer;
            star.parent = root;
            star.setPosition(spot[0], spot[1], 0);
            star.addComponent(UITransform).setContentSize(36, 36);

            const graphics = star.addComponent(Graphics);
            graphics.fillColor = new Color(255, 220, 110, 255);
            this.fillStar(graphics, 14, 6);
            star.setScale(0, 0, 1);
            tween(star)
                .delay(i * 0.06)
                .to(0.24, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }
    }

    private fillStar(graphics: Graphics, outer: number, inner: number): void {
        const spikes = 5;
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outer : inner;
            const angle = -Math.PI / 2 + i * Math.PI / spikes;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }
        graphics.close();
        graphics.fill();
    }

    private attachPrefab(
        prefab: Prefab,
        parent: Node,
        name: string,
        life: number
    ): Node | null {
        if (!parent.isValid) return null;

        parent.getChildByName(name)?.destroy();
        const node = instantiate(prefab);
        node.name = name;
        node.layer = parent.layer;
        node.parent = parent;
        tween(node)
            .delay(life)
            .call(() => {
                if (node.isValid) node.destroy();
            })
            .start();
        return node;
    }

    private ensureOpacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    }

    private containsNode(parent: Node, child: Node): boolean {
        let current: Node | null = child;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    private clearNamed(parent: Node, name: string): void {
        const node = parent.getChildByName(name);
        if (!node) return;

        Tween.stopAllByTarget(node);
        for (const child of node.children) {
            Tween.stopAllByTarget(child);
        }
        node.destroy();
    }
}
