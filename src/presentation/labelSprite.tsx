import {FunctionComponent, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {Color} from 'three';

import {isColourDark} from '../util/threeUtils';

const LABEL_PX_HEIGHT = 48;
const ANCHOR = new THREE.Vector2(0.5, 0);

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
    const [labelWidth, setLabelWidth] = useState(0);
    const [numLines, setNumLines] = useState(0);

    const canvasRef = useRef(document.createElement('canvas'));
    const texture = useMemo(() => {
        const texture = new THREE.CanvasTexture(canvasRef.current);
        texture.encoding = THREE.LinearEncoding;
        return texture;
    }, []);

    const setLabelContext = useCallback((context: CanvasRenderingContext2D) => {
        context.font = font || `bold ${LABEL_PX_HEIGHT}px arial, sans-serif`;
        context.fillStyle = fillColour || 'rgba(255,255,255,1)';
        context.shadowBlur = 4;
        context.shadowColor = isColourDark(new Color(context.fillStyle)) ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)';
        context.lineWidth = 2;
        context.textBaseline = 'bottom';
        context.textAlign = 'center';
    }, [fillColour, font]);
    
    const splitTextIntoLines = useCallback((context: CanvasRenderingContext2D, text: string, maxWidth?: number): string[] => {
        const paragraphs = text.split('\n');
        if (maxWidth === undefined) {
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
    }, []);

    useEffect(() => {
        const context = canvasRef.current.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2d canvas context');
        }
        setLabelContext(context);
        const labelLines = splitTextIntoLines(context, label, maxWidth);
        const canvasWidth = Math.max(
            10, maxWidth ?? 10,
            ...labelLines.map((line) => (context.measureText(line).width))
        );

        // Convert world-space padding to canvas pixels
        const pxPerWorldUnit = LABEL_PX_HEIGHT / labelSize;
        const paddingPx = (paddingBottom ?? 0) * pxPerWorldUnit;
        const canvasHeight = labelLines.length * LABEL_PX_HEIGHT + paddingPx;

        canvasRef.current.width = THREE.MathUtils.ceilPowerOfTwo(canvasWidth);
        canvasRef.current.height = THREE.MathUtils.ceilPowerOfTwo(canvasHeight);
        // Reapply the context after resizing the canvas (which clears it)
        setLabelContext(context);
        const labelOffset = canvasRef.current.height - canvasHeight;
        labelLines.forEach((line, index) => {
            context.fillText(line, canvasWidth / 2, labelOffset + (index + 1) * LABEL_PX_HEIGHT);
        });
        texture.repeat.set(canvasWidth / canvasRef.current.width, canvasHeight / canvasRef.current.height);
        texture.needsUpdate = true;
        setLabelWidth(canvasWidth);
        setNumLines(labelLines.length);
    }, [label, labelSize, maxWidth, paddingBottom, setLabelContext, splitTextIntoLines, texture]);

    const scale = useMemo(() => {
        if (labelWidth) {
            const pxToWorld = labelSize / LABEL_PX_HEIGHT;
            const scaleX = inverseScale ? inverseScale.x : 1;
            const scaleY = inverseScale ? inverseScale.y : 1;
            return new THREE.Vector3(labelWidth * pxToWorld / scaleX, (numLines * labelSize + (paddingBottom ?? 0)) / scaleY, 1);
        } else {
            return undefined;
        }
    }, [inverseScale, labelSize, labelWidth, numLines, paddingBottom]);

    return (
        <sprite position={position} scale={scale} center={ANCHOR} renderOrder={renderOrder}>
            <spriteMaterial attach='material' map={texture} transparent={true} toneMapped={false}
                            depthTest={true} depthWrite={false} alphaTest={0.5}
            />
        </sprite>
    );
});

export default LabelSprite;