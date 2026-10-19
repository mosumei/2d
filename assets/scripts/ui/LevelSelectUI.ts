
import {
    _decorator,
    Component,
    Node,
    Button,
    Label,
    Sprite,
    Color,
    instantiate,
    director
} from 'cc';

import { LevelSession } from '../core/LevelSession';

const { ccclass, property } = _decorator;

@ccclass('LevelSelectUI')
export class LevelSelectUI extends Component {

    @property(Node)
    levelGrid: Node | null = null;

    @property(Node)
    levelButtonTemplate: Node | null = null;

    @property(Button)
    backButton: Button | null = null;

    // 当前实际制作的关卡数量
    @property
    totalLevels = 4;

    // 每行多少个按钮
    @property
    columns = 4;

    // 按钮之间的中心距离
    private readonly stepX = 150;
    private readonly stepY = 155;

    onLoad() {
        this.backButton?.node.on(
            Button.EventType.CLICK,
            this.goBack,
            this
        );
    }

    start() {
        this.createLevelButtons();
    }

    private createLevelButtons() {
        const grid = this.levelGrid;
        const template = this.levelButtonTemplate;

        if (!grid || !template) {
            console.error(
                '[LevelSelectUI] LevelGrid 或模板未绑定'
            );
            return;
        }

        const progress = LevelSession.getProgress();
        const highest = progress.highestUnlockedLevel;

        // 清理之前生成的关卡按钮
        for (const child of [...grid.children]) {
            if (child !== template) {
                child.destroy();
            }
        }

        const cols = Math.max(1, this.columns);
        const rows = Math.ceil(this.totalLevels / cols);

        const totalWidth = (cols - 1) * this.stepX;
        const totalHeight = (rows - 1) * this.stepY;

        for (
            let level = 1;
            level <= this.totalLevels;
            level++
        ) {
            const index = level - 1;
            const row = Math.floor(index / cols);
            const col = index % cols;

            // 复制一个模板按钮
            const node = instantiate(template);

            node.name = `LevelButton_${level}`;
            node.parent = grid;
            node.active = true;

            const x = col * this.stepX - totalWidth / 2;
            const y = totalHeight / 2 - row * this.stepY;

            node.setPosition(x, y, 0);
            node.setScale(1, 1, 1);

            const unlocked = level <= highest;
            const button = node.getComponent(Button);

            if (button) {
                button.interactable = unlocked;
                button.transition = Button.Transition.NONE;

                if (unlocked) {
                    const targetLevel = level;

                    node.on(
                        Button.EventType.CLICK,
                        () => this.openLevel(targetLevel),
                        this
                    );
                }
            }

            // 修改按钮文字
            const label = node
                .getChildByName('Label')
                ?.getComponent(Label);

            const record =
                progress.levelRecords?.[String(level)];

            if (label) {
                const stars = record?.bestStars ?? 0;

                label.string = unlocked
                    ? `${level}${stars > 0 ? '\n' + '★'.repeat(stars) : ''}`
                    : `${level}\nLOCK`;

                label.fontSize = 27;
                label.lineHeight = 34;

                label.color = unlocked
                    ? new Color(32, 102, 178, 255)
                    : new Color(110, 125, 145, 255);
            }

            // 未解锁按钮变灰色
            const sprite = node.getComponent(Sprite);

            if (sprite) {
                sprite.color = unlocked
                    ? Color.WHITE
                    : new Color(165, 180, 195, 255);
            }
        }

        // 只隐藏模板，不隐藏生成的实例
        template.active = false;

        console.log(
            `[LevelSelectUI] 总关卡 ${this.totalLevels}，最高解锁 ${highest}`
        );
    }

    private openLevel(level: number) {
        if (!LevelSession.selectLevel(level)) {
            console.warn(
                `[LevelSelectUI] LEVEL ${level} 不允许进入`
            );
            return;
        }

        console.log(
            `[LevelSelectUI] 选择 LEVEL ${level}`
        );

        director.loadScene('Game');
    }

    private goBack() {
        director.loadScene('MainMenu');
    }

    onDestroy() {
        this.backButton?.node?.off(
            Button.EventType.CLICK,
            this.goBack,
            this
        );
    }
}
