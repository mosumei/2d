
import {
    _decorator,
    Component,
    Node,
    Label,
    AudioSource
} from 'cc';

import { GameSettings } from '../core/GameSettings';
import { AudioManager } from '../core/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('SettingsPanel')
export class SettingsPanel extends Component {

    @property(AudioManager)
    audioManager: AudioManager | null = null;

    // 音效开关
    @property(Node)
    soundToggle: Node | null = null;

    // 音乐开关
    @property(Node)
    musicToggle: Node | null = null;

    // 振动开关
    @property(Node)
    vibrationToggle: Node | null = null;

    // 状态文字
    @property(Label)
    soundLabel: Label | null = null;

    @property(Label)
    musicLabel: Label | null = null;

    @property(Label)
    vibrationLabel: Label | null = null;

    onEnable() {
        this.refreshUI();
    }

    /**
     * 打开设置面板
     */
    public openPanel() {
        this.node.active = true;
        this.refreshUI();
    }

    /**
     * 关闭设置面板
     */
    public closePanel() {
        this.audioManager?.playClick();
        this.node.active = false;
    }

    /**
     * 切换音效
     */
    public toggleSound() {
        const enabled = !GameSettings.isSoundEnabled();

        if (this.audioManager) {
            this.audioManager.setSoundEnabled(enabled);
        } else {
            GameSettings.setSoundEnabled(enabled);
        }

        this.refreshUI();
        this.audioManager?.playClick();
    }

    /**
     * 切换背景音乐
     */
    public toggleMusic() {
        const enabled = !GameSettings.isMusicEnabled();

        if (this.audioManager) {
            this.audioManager.setMusicEnabled(enabled);
        } else {
            GameSettings.setMusicEnabled(enabled);
        }

        this.refreshUI();
        this.audioManager?.playClick();
    }

    /**
     * 切换振动设置
     */
    public toggleVibration() {
        const enabled = !GameSettings.isVibrationEnabled();

        GameSettings.setVibrationEnabled(enabled);

        this.refreshUI();
        this.audioManager?.playClick();
    }

    /**
     * 根据保存的设置刷新开/关
     */
    public refreshUI() {
        const settings = GameSettings.load();

        if (this.soundLabel) {
            this.soundLabel.string =
                settings.soundEnabled ? '开' : '关';
        }

        if (this.musicLabel) {
            this.musicLabel.string =
                settings.musicEnabled ? '开' : '关';
        }

        if (this.vibrationLabel) {
            this.vibrationLabel.string =
                settings.vibrationEnabled ? '开' : '关';
        }
    }

}
