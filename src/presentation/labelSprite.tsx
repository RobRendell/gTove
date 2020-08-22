import * as React from 'react';
import * as THREE from 'three';
import {Sprite, SpriteMaterial} from 'react-three-fiber/components';
import memoizeOne from 'memoize-one';

interface LabelSpriteProps {
    label: string;
    labelSize: number;
    renderOrder: number;
    position?: THREE.Vector3;
    rotation?: THREE.Euler;
    inverseScale?: THREE.Vector3;
    maxWidth?: number;
    onLineHeightChange?: (height: number) => void;
    font?: string;
    fillColour?: string;
}

interface LabelSpriteState {
    labelWidth: number;
    numLines: number;
}

export default class LabelSprite extends React.Component<LabelSpriteProps, LabelSpriteState> {

    static LABEL_PX_HEIGHT = 48;
    static ANCHOR = new THREE.Vector2(0.5, 0);

    private labelSpriteMaterial: THREE.SpriteMaterial;

    constructor(props: LabelSpriteProps) {
        super(props);
        this.setSpriteMaterialRef = this.setSpriteMaterialRef.bind(this);
        this.getCanvasContextTexture = memoizeOne(this.getCanvasContextTexture.bind(this));
        this.splitTextIntoLines = memoizeOne(this.splitTextIntoLines.bind(this));
        this.updateLabel = memoizeOne(this.updateLabel.bind(this));
        this.getScale = memoizeOne(this.getScale.bind(this));
        this.state = {
            labelWidth: 0,
            numLines: 0
        };
    }

    getCanvasContextTexture() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2d canvas context');
        }
        const texture = new THREE.Texture(canvas);
        return {canvas, context, texture};
    }

    private splitTextIntoLines(context: CanvasRenderingContext2D, text: string, maxWidth?: number): string[] {
        if (maxWidth === undefined) {
            return [text];
        }
        let words = text.split(" ");
        let lines = [];
        let currentLine = words[0];

        for (let index = 1; index < words.length; index++) {
            let word = words[index];
            const width = context.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        this.props.onLineHeightChange && this.props.onLineHeightChange(lines.length);
        return lines;
    }

    private setLabelContext(context: CanvasRenderingContext2D) {
        context.font = this.props.font || `bold ${LabelSprite.LABEL_PX_HEIGHT}px arial, sans-serif`;
        context.fillStyle = this.props.fillColour || 'rgba(255,255,255,1)';
        context.shadowBlur = 4;
        context.shadowColor = 'rgba(0,0,0,1)';
        context.lineWidth = 2;
        context.textBaseline = 'bottom';
        context.textAlign = 'center';
    }

    private updateLabel(label: string, labelSpriteMaterial?: THREE.SpriteMaterial): void {
        if (!labelSpriteMaterial) {
            return;
        }
        const {canvas, context, texture} = this.getCanvasContextTexture();
        this.setLabelContext(context);
        const labelLines = this.splitTextIntoLines(context, label, this.props.maxWidth);
        const textWidth = context.measureText(label).width;
        const labelWidth = Math.max(10, this.props.maxWidth ? Math.min(this.props.maxWidth, textWidth) : textWidth);
        canvas.width = THREE.MathUtils.ceilPowerOfTwo(labelWidth);
        const labelHeight = LabelSprite.LABEL_PX_HEIGHT * labelLines.length;
        canvas.height = THREE.MathUtils.ceilPowerOfTwo(labelHeight);
        const labelOffset = canvas.height - labelHeight;
        // Unfortunately, setting the canvas width appears to clear the context.
        this.setLabelContext(context);
        labelLines.forEach((line, index) => {
            context.fillText(line, labelWidth / 2, labelOffset + (index + 1) * LabelSprite.LABEL_PX_HEIGHT);
        });
        texture.repeat.set(labelWidth / canvas.width, labelHeight / canvas.height);
        texture.needsUpdate = true;
        labelSpriteMaterial.map = texture;
        this.setState({labelWidth, numLines: labelLines.length});
    }

    private setSpriteMaterialRef(material: THREE.SpriteMaterial) {
        if (material) {
            this.labelSpriteMaterial = material;
            this.updateLabel(this.props.label, material);
        }
    }

    private getScale(labelSize: number, labelWidth: number, numLines: number, inverseScale?: THREE.Vector3) {
        if (labelWidth) {
            const pxToWorld = labelSize / LabelSprite.LABEL_PX_HEIGHT;
            const scaleX = inverseScale ? inverseScale.x : 1;
            const scaleY = inverseScale ? inverseScale.y : 1;
            return new THREE.Vector3(labelWidth * pxToWorld / scaleX, numLines * labelSize / scaleY, 1);
        } else {
            return undefined;
        }
    }

    render() {
        this.updateLabel(this.props.label, this.labelSpriteMaterial);
        const scale = this.getScale(this.props.labelSize, this.state.labelWidth, this.state.numLines, this.props.inverseScale);
        return (
            <Sprite position={this.props.position} scale={scale} center={LabelSprite.ANCHOR} renderOrder={this.props.renderOrder}>
                <SpriteMaterial attach='material' ref={this.setSpriteMaterialRef}/>
            </Sprite>
        );
    }
}