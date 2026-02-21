import {FunctionComponent, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {Color} from 'three';

import {isColourDark} from '../util/threeUtils';

const LABEL_PX_HEIGHT = 48;
const DROP_SHADOW_PADDING = 8; // Add some padding around the edges of the text for the drop shadow

interface LabelSpriteProps {
    label: string;
    labelSize: number;
    renderOrder: number;
    position?: THREE.Vector3;
    inverseScale?: THREE.Vector3;
    maxWidth?: number;
    font?: string;
    fillColour?: string;
    paddingBottom?: number;
}

const LabelSprite: FunctionComponent<LabelSpriteProps> = memo(({
                                                                   label,
                                                                   labelSize,
                                                                   renderOrder,
                                                                   position,
                                                                   inverseScale,
                                                                   maxWidth,
                                                                   font,
                                                                   fillColour,
                                                                   paddingBottom
                                                               }) => {
    const canvasRef = useRef(document.createElement('canvas'));
    const [texture, setTexture] = useState<THREE.CanvasTexture>(new THREE.CanvasTexture(canvasRef.current));

    const getLabelContext = useCallback(() => {
        const context = canvasRef.current.getContext('2d');
        if (context) {
            context.font = font || `bold ${LABEL_PX_HEIGHT}px arial, sans-serif`;
            context.fillStyle = fillColour || 'rgba(255,255,255,1)';
            context.shadowBlur = 4;
            context.shadowColor = isColourDark(new Color(context.fillStyle)) ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)';
            context.lineWidth = 2;
            context.textBaseline = 'bottom';
            context.textAlign = 'center';
        }
        return context;
    }, [fillColour, font]);

    const labelLines = useMemo(() => {
        const paragraphs = label.split('\n');
        const context = getLabelContext();
        if (!maxWidth || !context) {
            return paragraphs;
        }
        const lines: string[] = [];
        for (const text of paragraphs) {
            let words = text.split(' ');
            let currentLine = words[0];

            for (let index = 1; index < words.length; index++) {
                let word = words[index];
                const width = context.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
        }
        return lines;
    }, [getLabelContext, label, maxWidth]);

    const {canvasWidth, canvasHeight} = useMemo(() => {
        const context = getLabelContext();
        if (!context) {
            return {canvasWidth: 1, canvasHeight: 1};
        }
        return {
            canvasWidth: Math.max(10,
                ...labelLines.map((line) => (context.measureText(line).width + DROP_SHADOW_PADDING))
            ),
            canvasHeight: labelLines.length * LABEL_PX_HEIGHT + DROP_SHADOW_PADDING
        };
    }, [getLabelContext, labelLines])

    useEffect(() => {
        let context = getLabelContext();
        if (!context) {
            return;
        }

        canvasRef.current.width = canvasWidth;
        canvasRef.current.height = canvasHeight;

        // Resizing the canvas clears the context, reapply.
        context = getLabelContext()!;
        labelLines.forEach((line, index) => {
            context.fillText(line, canvasWidth / 2, (index + 1) * LABEL_PX_HEIGHT);
        });

        const newTexture = new THREE.CanvasTexture(canvasRef.current);
        newTexture.encoding = THREE.LinearEncoding;
        newTexture.repeat.set(1, 1);
        newTexture.needsUpdate = true;
        setTexture((previous) => {
            previous?.dispose();
            return newTexture;
        });
    }, [canvasHeight, canvasWidth, getLabelContext, labelLines]);

    const scale = useMemo(() => {
        if (canvasWidth) {
            const pxToWorld = labelSize / LABEL_PX_HEIGHT;
            const scaleX = inverseScale ? inverseScale.x : 1;
            const scaleY = inverseScale ? inverseScale.y : 1;
            return new THREE.Vector3(canvasWidth * pxToWorld / scaleX, canvasHeight * pxToWorld / scaleY, 1);
        } else {
            return undefined;
        }
    }, [canvasHeight, canvasWidth, inverseScale, labelSize]);

    const anchor = useMemo(() => {
        // Convert world-space padding to canvas pixels
        const pxPerWorldUnit = LABEL_PX_HEIGHT / labelSize;
        const paddingPx = (paddingBottom ?? 0) * pxPerWorldUnit;
        return new THREE.Vector2(0.5, -paddingPx / canvasHeight);
    }, [canvasHeight, labelSize, paddingBottom]);

    return (
        <sprite position={position} scale={scale} center={anchor} renderOrder={renderOrder} frustumCulled={false}>
            <spriteMaterial attach='material' map={texture} transparent={true} toneMapped={false}
                            depthTest={true} depthWrite={false} alphaTest={0.1}
            />
        </sprite>
    );
});

export default LabelSprite;