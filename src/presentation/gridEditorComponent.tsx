import './gridEditorComponent.scss';

import classNames from 'classnames';
import {useGranularEffect} from 'granular-hooks';
import clamp from 'lodash/clamp';
import {
    FunctionComponent,
    MutableRefObject,
    SyntheticEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import ReactResizeDetector from 'react-resize-detector';

import GestureControls, {GestureHandler} from '../container/gestureControls';
import KeyDownHandler from '../container/keyDownHandler';
import {INV_SQRT3, SQRT3} from '../util/constants';
import {ceilAwayFromZero} from '../util/mathsUtils';
import {getGridStride, ObjectVector2} from '../util/scenarioUtils';
import {GridType, MapProperties} from '../util/storage/storageContract';
import {isSizedEvent} from '../util/types';

interface CssPosition {
    top: number;
    left: number;
}

interface GridEditorComponentProps {
    onSetGrid: (width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridState: number, gridHeight?: number) => void;
    properties: MapProperties;
    textureUrl: string;
    videoTexture: boolean;
}

const GridEditorComponent: FunctionComponent<GridEditorComponentProps> = ({onSetGrid, properties, textureUrl, videoTexture}) => {

    const initialWidth = properties.width ? properties.width * properties.gridSize : 0;
    const initialHeight = properties.height ? properties.height * properties.gridSize : 0;
    const [imageSize, setImageSize] = useState({width: initialWidth, height: initialHeight})
    const [size, setSize] = useState({width: initialWidth, height: initialHeight});
    const [mapPos, setMapPos] = useState({x: 0, y: 0});
    const [gridSize, setGridSize] = useState(properties.gridSize || 32);
    const [gridHeight, setGridHeight] = useState(properties.gridHeight);
    const [zoom, setZoom] = useState(100);
    const [selected, setSelected] = useState<undefined | number>();
    const [pinned, setPinned] = useState<(CssPosition | null)[]>([null, null]);
    const [zoomOff, setZoomOff] = useState({x: 5, y: 3});

    const baseGridHeight = useMemo(() => {
        switch (properties.gridType) {
            case GridType.HEX_HORZ:
                return INV_SQRT3;
            case GridType.HEX_VERT:
                return SQRT3 / 2;
            default:
                return 1;
        }
    }, [properties.gridType]);

    const effectiveGridHeight = useMemo(() => (
        (properties.gridHeight !== undefined && gridHeight !== undefined) ? gridHeight : gridSize * baseGridHeight
    ), [baseGridHeight, gridHeight, gridSize, properties.gridHeight]);

    const gridAspectRatio = useMemo(() => (
        baseGridHeight * gridSize / effectiveGridHeight
    ), [baseGridHeight, effectiveGridHeight, gridSize]);

    const keepCoordinatesOnScreen = useCallback((left: number, top: number, side: number) => {
        const gridType = properties.gridType;
        const {strideX, strideY} = getGridStride(gridType);
        const repeatWidth = strideX * gridSize;
        const repeatHeight = strideY * effectiveGridHeight / baseGridHeight;
        const scale = 100.0 / zoom;
        const screenX = left + mapPos.x * scale;
        const screenY = top + mapPos.y * scale;
        const portrait = (size.width < size.height);
        const halfWidth = size.width * scale / 2;
        const halfHeight = size.height * scale / 2;
        const minX = portrait ? 0 : side * halfWidth;
        const minY = repeatHeight / 2 + (portrait ? side * halfHeight : 0);
        const maxX = Math.max(minX, (portrait ? 2 : (1 + side)) * halfWidth - repeatWidth / 2);
        const maxY = Math.max(minY, (portrait ? (1 + side) : 2) * halfHeight);
        let dX = (screenX < minX) ? minX - screenX : (screenX >= maxX) ? maxX - screenX : 0;
        let dY = (screenY < minY) ? minY - screenY : (screenY >= maxY) ? maxY - screenY : 0;
        dX = ceilAwayFromZero(dX / repeatWidth);
        dY = ceilAwayFromZero(dY / repeatHeight);
        if (gridType === GridType.HEX_VERT || gridType === GridType.HEX_HORZ) {
            dX = ceilAwayFromZero(dX / 2) * 2;
            dY = ceilAwayFromZero(dY / 2) * 2;
        }
        return {dX, dY, repeatWidth, repeatHeight};
    }, [baseGridHeight, effectiveGridHeight, gridSize, mapPos, properties.gridType, size, zoom]);

    const [gridOffset, setGridOffset] = useState(() => {
        let x = properties.gridOffsetX || 32;
        let y = (properties.gridOffsetY || 32) / gridAspectRatio; // reverse the aspect ratio effects of setGrid
        if (properties.gridType === GridType.HEX_HORZ || properties.gridType === GridType.HEX_VERT) {
            if (properties.gridType === GridType.HEX_HORZ) {
                y += 2 * effectiveGridHeight;
            } else {
                x += 2 * gridSize * INV_SQRT3;
            }
            const {dX, dY, repeatWidth, repeatHeight} = keepCoordinatesOnScreen(x, y, 0);
            x += dX * repeatWidth;
            y += dY * repeatHeight;
        }
        return {x, y};
    });

    const bumpRef = useRef<undefined | {x: number; y: number; index: number}>();

    const onResize = useCallback((width?: number, height?: number) => {
        if (width !== undefined && height !== undefined) {
            setSize({width, height});
        }
    }, []);

    const panPushpin = useCallback((delta: ObjectVector2, selected: number) => {
        const scale = 100.0 / zoom;
        const dx = delta.x * scale;
        const dy = delta.y * scale;
        if (selected === 1) {
            setGridOffset(({x, y}) => (
                {x: x + dx, y: y + dy}
            ));
        } else {
            const {strideX, strideY} = getGridStride(properties.gridType);
            const gridDX = zoomOff.x === 0 ? 0 : dx / zoomOff.x / strideX;
            const gridDY = zoomOff.y === 0 ? 0 : dy / zoomOff.y / strideY * baseGridHeight;
            if (properties.gridHeight === undefined) {
                const delta = (Math.abs(zoomOff.x) > Math.abs(+zoomOff.y)) ? gridDX : gridDY;
                setGridHeight(undefined);
                setGridSize((previous) => (Math.max(4, previous + delta)))
            } else {
                setGridHeight(Math.max(4, effectiveGridHeight + gridDY));
                setGridSize((previous) => (Math.max(4, previous + gridDX)));
            }
        }
    }, [baseGridHeight, effectiveGridHeight, properties.gridHeight, properties.gridType, zoom, zoomOff]);

    const clampMapPos = useCallback((oldMapX: number, oldMapY: number, zoom: number) => {
        const x = clamp(oldMapX, Math.min(0, size.width - imageSize.width * zoom / 100), 0);
        const y = clamp(oldMapY, Math.min(0, size.height - imageSize.height * zoom / 100), 0);
        return {x, y};
    }, [imageSize, size]);

    const onBump = useCallback((x: number, y: number, index?: number) => {
        if (index !== undefined) {
            panPushpin({x, y}, index + 1);
        }
    }, [panPushpin]);

    const setGrid = useCallback((width: number, height: number, gridState: number) => {
        // Stretch map height and gridOffsetY to make the grid squares/regular hexagons.
        let gridOffsetX = gridOffset.x;
        let gridOffsetY = gridOffset.y * gridAspectRatio;
        // For hexagonal grids, modify gridOffsetX and gridOffsetY to indicate the centre of a hex.
        let centreOffsetX = 1, centreOffsetY = 1, strideX = 1, strideY = 1;
        switch (properties.gridType) {
            case GridType.HEX_HORZ:
                gridOffsetY = (gridOffsetY + effectiveGridHeight * gridAspectRatio) % (SQRT3 * gridSize);
                strideY = SQRT3 / 2;
                if (gridOffsetY > strideY * gridSize) {
                    gridOffsetX += gridSize / 2;
                    gridOffsetY -= strideY * gridSize;
                }
                gridOffsetX = gridOffsetX % gridSize;
                centreOffsetX = 1.5;
                centreOffsetY = 5 / 3;
                break;
            case GridType.HEX_VERT:
                gridOffsetX = (gridOffsetX + gridSize * INV_SQRT3) % (SQRT3 * gridSize);
                strideX = SQRT3 / 2;
                if (gridOffsetX > strideX * gridSize) {
                    gridOffsetX -= strideX * gridSize;
                    gridOffsetY += gridSize / 2;
                }
                gridOffsetY = gridOffsetY % gridSize;
                centreOffsetX = 5 / 3;
                centreOffsetY = 1 + (gridOffsetY > gridSize / 2 ? 1 : 0);
                break;
        }
        height *= gridAspectRatio;
        const dX = gridOffsetX / gridSize;
        const dY = gridOffsetY / gridSize;
        const fogWidth = Math.ceil((width - dX % strideX) / strideX + centreOffsetX);
        const fogHeight = Math.ceil((height - dY % strideY) / strideY + centreOffsetY);
        onSetGrid(width, height, gridSize, gridOffsetX, gridOffsetY, fogWidth, fogHeight, gridState, gridHeight);
    }, [effectiveGridHeight, gridAspectRatio, gridHeight, gridOffset, gridSize, onSetGrid, properties.gridType]);

    const getPushpinPosition = useCallback((index: number, zoomOff: ObjectVector2): CssPosition => {
        const {strideX, strideY} = getGridStride(properties.gridType);
        const left = index * zoomOff.x * strideX * gridSize + gridOffset.x;
        const top = index * zoomOff.y * strideY * effectiveGridHeight / baseGridHeight + gridOffset.y;
        return {top, left};
    }, [baseGridHeight, effectiveGridHeight, gridOffset, gridSize, properties.gridType]);

    const onPan = useCallback((delta: ObjectVector2) => {
        if (selected && !pinned[selected - 1]) {
            panPushpin(delta, selected);
        } else {
            setMapPos(({x, y}) => (clampMapPos(x + delta.x, y + delta.y, zoom)))
        }
    }, [clampMapPos, panPushpin, pinned, selected, zoom]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        setZoom((prevZoom) => {
            const zoom = clamp(prevZoom - delta.y, 20, 1000);
            const scale = zoom / prevZoom;
            const midX = size.width / 2;
            const midY = size.height / 2;
            setMapPos(({x, y}) => (clampMapPos((x - midX) * scale + midX, (y - midY) * scale + midY, zoom)));
            return zoom;
        });
    }, [clampMapPos, size]);
    const onTap = useCallback(() => {
        if (selected) {
            const index = selected - 1;
            setPinned((previous) => {
                const pinned = [...previous];
                pinned[index] = (pinned[index]) ? null : getPushpinPosition(index, zoomOff);
                if (index === 0) {
                    pinned[1] = null;
                }
                setGrid(imageSize.width / gridSize, imageSize.height / gridSize, (pinned[0] ? 1 : 0) + (pinned[1] ? 1 : 0));
                return pinned;
            });
            setSelected(undefined);
        } else if (bumpRef.current) {
            onBump(bumpRef.current.x, bumpRef.current.y, bumpRef.current.index);
            bumpRef.current = undefined;
        }
    }, [getPushpinPosition, gridSize, imageSize.height, imageSize.width, onBump, selected, setGrid, zoomOff]);
    const onGestureEnd = useCallback(() => {
        setSelected(undefined);
    }, []);
    const gestureHandler = useMemo<GestureHandler>(() => ({
        id: 'gridEditor',
        onPan,
        onZoom,
        onTap,
        onGestureEnd
    }), [onGestureEnd, onPan, onTap, onZoom]);

    const currentIndex = useMemo(() => (
        !pinned[0] ? 0 : !pinned[1] ? 1 : undefined
    ), [pinned]);

    useGranularEffect(() => {
        if (properties.gridSize && properties.gridType !== GridType.NONE) {
            setPinned((pinned) => (
                [pinned[0] ?? getPushpinPosition(0, zoomOff), pinned[1] ?? getPushpinPosition(1, zoomOff)]
            ));
        }
    }, [], [getPushpinPosition, properties.gridSize, properties.gridType, zoomOff]);

    useEffect(() => {
        if (!pinned[0] || !pinned[1]) {
            const pushpinIndex = (pinned[0]) ? 1 : 0;
            const {left, top} = getPushpinPosition(pushpinIndex, zoomOff);
            const {dX, dY, repeatWidth, repeatHeight} = keepCoordinatesOnScreen(left, top, pushpinIndex);
            if (dX || dY) {
                if (pushpinIndex === 0) {
                    setGridOffset(({x, y}) => {
                        x += repeatWidth * dX;
                        y += repeatHeight * dY;
                        return {x, y};
                    });
                } else {
                    setZoomOff((previous) => {
                        let {x, y} = previous;
                        x += dX;
                        y += dY;
                        return (x === 0 && y === 0) ? previous : {x, y};
                    })
                }
            }
        }
    }, [getPushpinPosition, keepCoordinatesOnScreen, pinned, zoomOff]);

    const onTextureLoad = useCallback((rawWidth: number, rawHeight: number) => {
        setImageSize({width: rawWidth, height: rawHeight});
        const width = rawWidth / gridSize;
        const height = rawHeight / gridSize;
        setGrid(width, height, (pinned[0] ? 1 : 0) + (pinned[1] ? 1 : 0));
        window.URL.revokeObjectURL(textureUrl);
    }, [gridSize, pinned, setGrid, textureUrl]);

    const keyMap = useMemo(() => ({
        ArrowLeft: {callback: () => {onBump(-1, 0, currentIndex)}},
        ArrowRight: {callback: () => {onBump(1, 0, currentIndex)}},
        ArrowUp: {callback: () => {onBump(0, -1, currentIndex)}},
        ArrowDown: {callback: () => {onBump(0, 1, currentIndex)}}
    }), [currentIndex, onBump]);

    const renderGrid = useCallback(() => {
        let pattern;
        switch (properties.gridType) {
            case GridType.NONE:
                return null;
            case GridType.SQUARE:
                pattern = (
                    <pattern id='grid' x={gridOffset.x} y={gridOffset.y} width={gridSize} height={effectiveGridHeight} patternUnits='userSpaceOnUse'>
                        <path d={`M ${gridSize} 0 L 0 0 0 ${effectiveGridHeight}`} fill='none' stroke={properties.gridColour} strokeWidth='1'/>
                    </pattern>
                );
                break;
            case GridType.HEX_VERT:
                // Since the horizontal distance of "gridSize" pixels is used to define a distance of 1.0 in the tabletop
                // 3D space, and a vertical hex grid should have a horizontal distance of SQRT3 / 2 between the centres
                // of adjacent hexes, we need to scale up the grid pattern.
                const hexH = gridSize * INV_SQRT3;
                const hexV = effectiveGridHeight * INV_SQRT3;
                pattern = (
                    <pattern id='grid' x={gridOffset.x} y={gridOffset.y} width={3 * hexH} height={2 * hexV} patternUnits='userSpaceOnUse'>
                        <path d={`M 0 0 l ${hexH / 2} ${hexV} ${hexH} 0 ${hexH / 2} ${-hexV} ` +
                            `${hexH} 0 M ${hexH / 2} ${hexV} L 0 ${2 * hexV} M ${3 * hexH / 2} ${hexV} ` +
                            `L ${2 * hexH} ${2 * hexV}`} fill='none' stroke={properties.gridColour} strokeWidth='1'/>
                    </pattern>
                );
                break;
            case GridType.HEX_HORZ:
                pattern = (
                    <pattern id='grid' x={gridOffset.x} y={gridOffset.y} width={gridSize} height={3 * effectiveGridHeight} patternUnits='userSpaceOnUse'>
                        <path d={`M 0 0 l ${gridSize/2} ${effectiveGridHeight/2} 0 ${effectiveGridHeight} ${-gridSize/2} ${effectiveGridHeight/2} ` +
                            `0 ${effectiveGridHeight} M ${gridSize/2} ${effectiveGridHeight/2} L ${gridSize} 0 M ${gridSize/2} ${3*effectiveGridHeight/2} ` +
                            `L ${gridSize} ${2*effectiveGridHeight}`} fill='none' stroke={properties.gridColour} strokeWidth='1'/>
                    </pattern>
                );
                break;
        }
        return (
            <div className='grid' key={`x:${gridOffset.x},y:${gridOffset.y}`}>
                <svg width="500%" height="500%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        {pattern}
                    </defs>
                    <rect width="500%" height="500%" fill="url(#grid)" />
                </svg>
            </div>
        );
    }, [effectiveGridHeight, gridOffset, gridSize, properties.gridColour, properties.gridType]);

    const renderPushPin = useCallback((index: number) => {
        const gridColour = properties.gridColour;
        const xDominant = Math.abs(zoomOff.x) > Math.abs(+zoomOff.y);
        const renderXBumpers = index === 0 || ((properties.gridHeight !== undefined || xDominant) && zoomOff.x !== 0);
        const renderYBumpers = index === 0 || ((properties.gridHeight !== undefined || !xDominant) && zoomOff.y !== 0);
        return (properties.gridType === GridType.NONE || (index === 1 && !pinned[0])) ? null : (
            <div
                className={classNames('pushpinContainer', {pinned: !!pinned[index]})}
                style={{...getPushpinPosition(index, zoomOff), transform: `scale(${100 / zoom})`}}
            >
                <span
                    role='img'
                    aria-label='pushpin'
                    className='pushpin'
                    onMouseDown={() => {setSelected(1 + index)}}
                    onTouchStart={() => {setSelected(1 + index)}}
                >📌</span>
                {!renderXBumpers ? null : <Bumper direction='right' border='borderLeftColor' colour={gridColour} x={1} y={0} index={index} bumpRef={bumpRef} />}
                {!renderXBumpers ? null : <Bumper direction='left' border='borderRightColor' colour={gridColour} x={-1} y={0} index={index} bumpRef={bumpRef} />}
                {!renderYBumpers ? null : <Bumper direction='up' border='borderBottomColor' colour={gridColour} x={0} y={-1} index={index} bumpRef={bumpRef} />}
                {!renderYBumpers ? null : <Bumper direction='down' border='borderTopColor' colour={gridColour} x={0} y={1} index={index} bumpRef={bumpRef} />}
            </div>
        );
    }, [getPushpinPosition, pinned, properties.gridColour, properties.gridHeight, properties.gridType, zoom, zoomOff]);

    const onVideoLoaded = useCallback((evt: SyntheticEvent<HTMLVideoElement>) => {
        onTextureLoad(evt.currentTarget.videoWidth, evt.currentTarget.videoHeight);
    }, [onTextureLoad]);

    const onImgLoaded = useCallback((evt: SyntheticEvent<HTMLImageElement>) => {
        if (isSizedEvent(evt)) {
            onTextureLoad(evt.target.width, evt.target.height);
        }
    }, [onTextureLoad]);

    return (
        <GestureControls className='gridEditorComponent' defaultHandler={gestureHandler}>
            <KeyDownHandler keyMap={keyMap} />
            <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={onResize}/>
            <div className='editMapPanel' style={{
                marginLeft: mapPos.x,
                marginTop: mapPos.y,
                transform: `scale(${zoom / 100})`
            }}>
                {
                    videoTexture ? (
                        <video loop={true} autoPlay={true} src={textureUrl} onLoadedMetadata={onVideoLoaded}>
                            Your browser doesn't support embedded videos.
                        </video>
                    ) : (
                        <img src={textureUrl} alt='map' onLoad={onImgLoaded}/>
                    )
                }
                {renderGrid()}
                {renderPushPin(0)}
                {renderPushPin(1)}
            </div>
        </GestureControls>
    );
}

function Bumper({direction, border, colour, x, y, index, bumpRef}: {direction: string; border: string; colour: string; x: number; y: number; index: number; bumpRef: MutableRefObject<undefined | {x: number; y: number; index: number}>}) {
    const setBump = useCallback(() => {
        bumpRef.current = {x, y, index};
    }, [bumpRef, index, x, y]);
    const style = useMemo(() => ({[border]: colour}), [border, colour]);
    return (
        <div className={classNames('bump', direction)} style={style}
             onTouchStart={setBump} onMouseDown={setBump}
        />
    )
}

export default GridEditorComponent;