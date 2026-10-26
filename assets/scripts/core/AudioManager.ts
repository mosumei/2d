
import {
    _decorator,
    Component,
    AudioSource,
    AudioClip,
    sys
} from 'cc';

import { GameSettings } from './GameSettings';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {

    @property(AudioSource)
    sfxSource: AudioSource | null = null;

    @property(AudioSource)
    bgmSource: AudioSource | null = null;

    @property(AudioClip)
    gemSelect: AudioClip | null = null;

    @property(AudioClip)
    gemMove: AudioClip | null = null;

    @property(AudioClip)
    gemMatch: AudioClip | null = null;

    @property(AudioClip)
    gemTray: AudioClip | null = null;

    @property(AudioClip)
    uiClick: AudioClip | null = null;

    @property(AudioClip)
    levelComplete: AudioClip | null = null;

    @property(AudioClip)
    bgmGame: AudioClip | null = null;

    @property
    sfxVolume = 0.65;

    @property
    bgmVolume = 0.2;

    private soundEnabled = true;
    private musicEnabled = true;

    onLoad() {
        // 首次升级时，迁移旧版音效设置
        this.migrateLegacySettings();

        const settings = GameSettings.load();

        this.soundEnabled = settings.soundEnabled;
        this.musicEnabled = settings.musicEnabled;
    }

    private migrateLegacySettings() {
        const newKey = 'jewel_crush_settings_v1';

        // 已保存新版设置，不需要迁移
        if (sys.localStorage.getItem(newKey) !== null) {
            return;
        }

        const oldSound = sys.localStorage.getItem(
            'jewel_sound_enabled'
        );

        const oldMusic = sys.localStorage.getItem(
            'jewel_music_enabled'
        );

        if (oldSound === null && oldMusic === null) {
            return;
        }

        GameSettings.update({
            soundEnabled: oldSound !== 'false',
            musicEnabled: oldMusic !== 'false'
        });
    }

    private playSFX(clip: AudioClip | null) {
        if (!this.soundEnabled || !clip || !this.sfxSource) {
            return;
        }

        this.sfxSource.playOneShot(clip, this.sfxVolume);
    }

    public playSelect() {
        this.playSFX(this.gemSelect);
    }

    public playMove() {
        this.playSFX(this.gemMove);
    }

    public playMatch() {
        this.playSFX(this.gemMatch);
    }

    public playTray() {
        this.playSFX(this.gemTray);
    }

    public playClick() {
        this.playSFX(this.uiClick);
    }

    public playComplete() {
        this.playSFX(this.levelComplete);
    }

    public playBGM() {
        if (
            !this.musicEnabled ||
            !this.bgmSource ||
            !this.bgmGame
        ) return;

        this.bgmSource.stop();
        this.bgmSource.clip = this.bgmGame;
        this.bgmSource.loop = true;
        this.bgmSource.volume = this.bgmVolume;
        this.bgmSource.play();
    }

    public stopBGM() {
        this.bgmSource?.stop();
    }

    public setSoundEnabled(enabled: boolean) {
        this.soundEnabled = enabled;

        GameSettings.update({
            soundEnabled: enabled
        });
    }

    public setMusicEnabled(enabled: boolean) {
        if (this.musicEnabled === enabled) {
            return;
        }

        this.musicEnabled = enabled;

        GameSettings.update({
            musicEnabled: enabled
        });

        if (enabled) {
            this.playBGM();
        } else {
            this.stopBGM();
        }
    }

    public isSoundEnabled(): boolean {
        return this.soundEnabled;
    }

    public isMusicEnabled(): boolean {
        return this.musicEnabled;
    }
}
