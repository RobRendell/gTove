import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';

interface LabelSpriteProps {
    label: string;
    labelSize: number;
    position?: THREE.Vector3;
    rotation?: THREE.Euler;
    inverseScale?: THREE.Vector3;
}

interface LabelSpriteState {
    labelWidth: number;
}

export default class LabelSprite extends React.Component<LabelSpriteProps, LabelSpriteState> {

    static LABEL_PX_HEIGHT = 48;

    static propTypes = {
        label: PropTypes.string.isRequired,
        labelSize: PropTypes.number.isRequired,
        position: PropTypes.object,
        rotation: PropTypes.object,
        inverseScale: PropTypes.object
    };

    private labelSpriteMaterial: any;
    private label: string;
    private canvas: HTMLCanvasElement;

    constructor(props: LabelSpriteProps) {
        super(props);
        this.state = {
            labelWidth: 0
        }
    }

    componentWillReceiveProps(props: LabelSpriteProps) {
        this.updateLabel(props.label);
    }

    private setLabelContext(context: CanvasRenderingContext2D) {
        context.font = `bold ${LabelSprite.LABEL_PX_HEIGHT}px arial, sans-serif`;
        context.fillStyle = 'rgba(255,255,255,1)';
        context.shadowBlur = 4;
        context.shadowColor = 'rgba(0,0,0,1)';
        context.lineWidth = 2;
        context.textBaseline = 'bottom';
    }

    updateLabel(label: string) {
        if (this.labelSpriteMaterial && label !== this.label) {
            this.label = label;
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
            }
            const context = this.canvas.getContext('2d');
            if (context) {
                this.setLabelContext(context);
                const textMetrics = context.measureText(label);
                const width = Math.max(10, textMetrics.width);
                this.canvas.width = width;
                this.canvas.height = LabelSprite.LABEL_PX_HEIGHT;
                // Unfortunately, setting the canvas width appears to clear the context.
                this.setLabelContext(context);
                context.textAlign = 'center';
                context.fillText(label, width / 2, LabelSprite.LABEL_PX_HEIGHT);
                const texture = new THREE.Texture(this.canvas);
                texture.needsUpdate = true;
                this.labelSpriteMaterial.map = texture;
                this.labelSpriteMaterial.useScreenCoordinates = false;
                this.setState({labelWidth: width});
            }
        }
    }

    private updateLabelSpriteMaterial(material: THREE.SpriteMaterial) {
        if (material && material !== this.labelSpriteMaterial) {
            this.labelSpriteMaterial = material;
            this.label = this.props.label + ' changed';
            this.updateLabel(this.props.label);
        }
    }

    render() {
        const pxToWorld = this.props.labelSize / LabelSprite.LABEL_PX_HEIGHT;
        const scaleX = (this.props.inverseScale) ? this.props.inverseScale.x : 1;
        const scaleY = (this.props.inverseScale) ? this.props.inverseScale.y : 1;
        const scale = this.state.labelWidth ? new THREE.Vector3(this.state.labelWidth * pxToWorld / scaleX, this.props.labelSize / scaleY, 1) : undefined;
        return (
            <sprite position={this.props.position} scale={scale}>
                <spriteMaterial ref={(material: THREE.SpriteMaterial) => {this.updateLabelSpriteMaterial(material)}}/>
            </sprite>
        );
    }
}