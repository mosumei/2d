
import { director } from 'cc';

export class SceneRouter {

    static goHome() {
        director.loadScene('MainMenu');
    }

    static startGame() {
        director.loadScene('Game');
    }

    static showResult() {
        director.loadScene('Result');
    }

    static restartGame() {
        director.loadScene('Game');
    }

}
