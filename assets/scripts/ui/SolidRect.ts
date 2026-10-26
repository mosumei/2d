
import {
    _decorator,
    Component,
    Graphics,
    UITransform,
    Color,
} from 'cc';

const { ccclass, property, requireComponent, executeInEditMode } = _decorator;

@ccclass('SolidRect')
@requireComponent(Graphics)
@executeInEditMode(true)
export class SolidRect extends Component {

    @property(Color)
    fillColor: Color = new Color(139, 92, 225, 255);

    onLoad() {
        this.drawRect();
    }

    onEnable() {
        this.drawRect();
    }

    onValidate() {
        this.drawRect();
    }

    public drawRect() {
        const graphics = this.getComponent(Graphics);
        const ui = this.getComponent(UITransform);

        if (!graphics || !ui) return;

        const width = ui.width;
        const height = ui.height;

        graphics.clear();
        graphics.fillColor = this.fillColor;

        graphics.rect(
            -width * ui.anchorX,
            -height * ui.anchorY,
            width,
            height
        );

        graphics.fill();
    }
}
