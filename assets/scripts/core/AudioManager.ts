
import {
    _decorator,
    Component,
    AudioSource,
    AudioClip,
    sys
} from 'cc';

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

    private readonly soundKey = 'jewel_sound_enabled';
    private readonly musicKey = 'jewel_music_enabled';

    onLoad() {
        this.soundEnabled =
            sys.localStorage.getItem(this.soundKey) !== 'false';

        this.musicEnabled =
            sys.localStorage.getItem(this.musicKey) !== 'false';
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
        sys.localStorage.setItem(
            this.soundKey,
            String(enabled)
        );
    }

    public setMusicEnabled(enabled: boolean) {
        this.musicEnabled = enabled;
        sys.localStorage.setItem(
            this.musicKey,
            String(enabled)
        );

        if (enabled) {
            this.playBGM();
        } else {
            this.stopBGM();
        }
    }
}
