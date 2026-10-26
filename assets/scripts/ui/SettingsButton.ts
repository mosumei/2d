import { _decorator, Component } from 'cc';
import { SettingsPanel } from './SettingsPanel';

const { ccclass, property } = _decorator;

@ccclass('SettingsButton')
export class SettingsButton extends Component {

    @property(SettingsPanel)
    settingsPanel: SettingsPanel | null = null;

    /**
     * 打开设置面板
     */
    public openSettings() {
        if (!this.settingsPanel) {
            console.warn('[SettingsButton] settingsPanel 未绑定');
            return;
        }

        this.settingsPanel.openPanel();
    }
}
