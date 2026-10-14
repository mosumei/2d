import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HelloWorld')
export class HelloWorld extends Component {
    start() {
        console.log("启动游戏  ");
 

    }

    update(deltaTime: number) {

    }
}

