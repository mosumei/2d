
import { director } from 'cc';

import { LevelSession } from './LevelSession';

export class SceneRouter {

    static goHome() {
        director.loadScene('MainMenu');
    }

    static startGame() {
        LevelSession.allowGameEntry();
        director.loadScene('Game');
    }

    static showResult() {
        director.loadScene('Result');
    }

    static restartGame() {
        LevelSession.allowGameEntry();
        director.loadScene('Game');
    }

}
