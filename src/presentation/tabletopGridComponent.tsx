import React from 'react';
import * as THREE from 'three';

import {GridType} from '../util/storage/storageContract';
import {getGridStride} from '../util/scenarioUtils';

interface TabletopGridComponentProps {
    width: number;
    height: number;
    dx: number;
    dy: number;
    gridType: GridType;
    colour: string;
    renderOrder: number;
}

export default class TabletopGridComponent extends React.Component<TabletopGridComponentProps> {

    private gridMaterial: THREE.MeshBasicMaterial;

    private getTextureSize() {
        const stride = getGridStride(this.props.gridType, false);
        return {textureWidth: stride.strideX, textureHeight: stride.strideY};
    }

    private generateCanvas() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return null;
        }
        const canvasScale = 64;
        const {textureWidth, textureHeight} = this.getTextureSize();
        canvas.width = textureWidth * canvasScale;
        canvas.height = textureHeight * canvasScale;
        context.lineWidth = 1 / canvasScale;
        context.strokeStyle = this.props.colour;
        context.scale(canvasScale, canvasScale);
        let hexX, hexY;
        switch (this.props.gridType) {
            case GridType.SQUARE:
                context.moveTo(0, 0);
                context.lineTo(0, textureHeight);
                context.stroke();
                context.moveTo(0, 0);
                context.lineTo(textureWidth, 0);
                context.stroke();
                break;
            case GridType.HEX_HORZ:
                hexX = textureWidth / 2;
                hexY = textureHeight / 6;
                context.moveTo(hexX, 0);
                context.lineTo(hexX, hexY);
                context.lineTo(0, 2 * hexY);
                context.lineTo(0, 4 * hexY);
                context.lineTo(hexX, 5 * hexY);
                context.lineTo(hexX, textureHeight);
                context.moveTo(hexX, hexY);
                context.lineTo(textureWidth, 2 * hexY);
                context.moveTo(textureWidth, 4 * hexY);
                context.lineTo(hexX, 5 * hexY);
                context.stroke();
                break;
            case GridType.HEX_VERT:
                hexX = textureWidth / 6;
                hexY = textureHeight / 2;
                context.moveTo(0, hexY);
                context.lineTo(hexX, hexY);
                context.lineTo(2 * hexX, 0);
                context.lineTo(4 * hexX, 0);
                context.lineTo(5 * hexX, hexY);
                context.lineTo(textureWidth, hexY);
                context.moveTo(hexX, hexY);
                context.lineTo(2 * hexX, textureHeight);
                context.moveTo(4 * hexX, textureHeight);
                context.lineTo(5 * hexX, hexY);
                context.stroke();
                break;
        }
        return canvas;
    }

    private setGridMaterial(material: THREE.MeshBasicMaterial) {
        if (material && material !== this.gridMaterial) {
            const canvas = this.generateCanvas();
            if (canvas) {
                this.gridMaterial = material;
                const texture = new THREE.Texture(canvas);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                const {textureWidth, textureHeight} = this.getTextureSize();
                texture.repeat.set(this.props.width / textureWidth, this.props.height / textureHeight);
                // Offset for texture is down and left from the bottom-left corner, but (this.props.dx,this.props.dy) is
                // down and right from the top-left corner.
                const dx = 1 - this.props.dx / textureWidth;
                const dy = (1 - (this.props.height - this.props.dy) / textureHeight % 1);
                texture.offset.set(dx, dy);
                texture.needsUpdate = true;
                this.gridMaterial.map = texture;
            }
        }
    }

    render() {
        return (
            <mesh key={`grid_${this.props.width}_${this.props.height}_${this.props.dx}_${this.props.dy}_${this.props.gridType}_${this.props.colour}`}
                  renderOrder={this.props.renderOrder}
            >
                <boxGeometry attach='geometry' args={[this.props.width, 0.00000001, this.props.height]}/>
                <meshBasicMaterial attach='material'
                    ref={(material: THREE.MeshBasicMaterial) => this.setGridMaterial(material)}
                    transparent={true}
                />
            </mesh>
        );
    }

}