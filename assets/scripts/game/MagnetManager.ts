import {
    _decorator,
    Component,
} from 'cc';

const { ccclass, property } = _decorator;

/**
 * 磁铁控制器。按顺序最多执行 3 次归位，不直接改棋盘数据。
 */
@ccclass('MagnetManager')
export class MagnetManager extends Component {

    @property
    maxFixCount = 3;

    private running = false;

    /**
     * 启动磁铁。
     * @param findMove 寻找下一步合法归位操作
     * @param executeMove 使用现有棋盘移动流程执行
     */
    public async activate<T>(
        findMove: () => T | null,
        executeMove: (move: T) => Promise<boolean>
    ): Promise<number> {

        if (this.running) return 0;

        this.running = true;
        let fixedCount = 0;

        try {
            for (let i = 0; i < this.maxFixCount; i++) {

                const move = findMove();

                if (!move) break;

                const succeeded = await executeMove(move);

                if (!succeeded) break;

                fixedCount++;
            }

            return fixedCount;

        } finally {
            this.running = false;
        }
    }
}
