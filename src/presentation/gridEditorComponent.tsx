import * as React from 'react';
import * as PropTypes from 'prop-types';
import ReactResizeDetector from 'react-resize-detector';
import {clamp} from 'lodash';
import classNames from 'classnames';

import GestureControls from '../container/gestureControls';
import {GridType, MapProperties} from '../util/storage/storageContract';
import { isSizedEvent } from '../util/types';
import { INV_SQRT3, SQRT3 } from '../util/constants';
import { ceilAwayFromZero } from '../util/mathsUtils';
import { getGridStride, ObjectVector2 } from '../util/scenarioUtils';
import KeyDownHandler from '../container/keyDownHandler';

import './gridEditorComponent.scss';

interface GridEditorComponentProps {
    setGrid: (width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridState: number, gridHeight?: number) => void;
    properties: MapProperties;
    textureUrl: string;
    videoTexture: boolean;
}

interface CssPosition {
    top: number;
    left: number;
}

interface GridEditorComponentState {
    imageWidth: number;
    imageHeight: number;
    mapX: number;
    mapY: number;
    gridSize: number;
    gridHeight?: number;
    gridOffsetX: number;
    gridOffsetY: number;
    zoom: number;
    selected?: number;
    bump?: {x: number, y: number, index: number};
    pinned: (CssPosition | null)[];
    zoomOffX: number;
    zoomOffY: number;
    width: number;
    height: number;
}

export default class GridEditorComponent extends React.Component<GridEditorComponentProps, GridEditorComponentState> {

    static propTypes = {
        setGrid: PropTypes.func.isRequired,
        properties: PropTypes.object.isRequired,
        textureUrl: PropTypes.string.isRequired
    };

    constructor(props: GridEditorComponentProps) {
        super(props);
        this.onResize = this.onResize.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onTap = this.onTap.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.state = this.getStateFromProps(props);
    }

    onResize(width?: number, height?: number) {
        if (width !== undefined && height !== undefined) {
            this.setState({width, height});
        }
    }

    getStateFromProps(props: GridEditorComponentProps) {
        let result: GridEditorComponentState = {
            imageWidth: props.properties.width ? props.properties.width * props.properties.gridSize : 0,
            imageHeight: props.properties.height ? props.properties.height * props.properties.gridSize : 0,
            mapX: 0,
            mapY: 0,
            gridSize: props.properties.gridSize || 32,
            gridHeight: props.properties.gridHeight,
            gridOffsetX: props.properties.gridOffsetX || 32,
            gridOffsetY: props.properties.gridOffsetY || 32,
            zoom: 100,
            selected: undefined,
            bump: undefined,
            pinned: [null, null],
            zoomOffX: 5,
            zoomOffY: 3,
            width: props.properties.width ? props.properties.width * props.properties.gridSize : 0,
            height: props.properties.height ? props.properties.height * props.properties.gridSize : 0
        };
        // Need to reverse modifications of gridOffsetX/Y
        result.gridOffsetY /= this.getGridAspectRatio(result);
        const gridType = this.props.properties.gridType;
        if (gridType === GridType.HEX_HORZ || gridType === GridType.HEX_VERT) {
            if (gridType === GridType.HEX_HORZ) {
                result.gridOffsetY += 2 * this.getGridHeight(result);
            } else if (gridType === GridType.HEX_VERT) {
                result.gridOffsetX += 2 * result.gridSize * INV_SQRT3;
            }
            const {dX, dY, repeatWidth, repeatHeight} = this.keepCoordinatesOnScreen(result.gridOffsetX, result.gridOffsetY, 0, gridType, result);
            result.gridOffsetX += dX * repeatWidth;
            result.gridOffsetY += dY * repeatHeight;
        }
        if (props.properties && props.properties.gridSize && props.properties.gridType !== GridType.NONE) {
            result.pinned = [
                this.pushpinPosition(0, result),
                this.pushpinPosition(1, result)
            ];
        }
        return result;
    }

    clampMapXY(oldMapX: number, oldMapY: number, zoom: number) {
        const mapX = clamp(oldMapX, Math.min(0, this.state.width - this.state.imageWidth * zoom / 100), 0);
        const mapY = clamp(oldMapY, Math.min(0, this.state.height - this.state.imageHeight * zoom / 100), 0);
        return {mapX, mapY};
    }

    private getBaseGridHeight(gridType: GridType) {
        switch (gridType) {
            case GridType.HEX_HORZ:
                return INV_SQRT3;
            case GridType.HEX_VERT:
                return SQRT3 / 2;
            default:
                return 1;
        }
    }

    getGridHeight(state: GridEditorComponentState = this.state) {
        if (this.props.properties.gridHeight !== undefined && state.gridHeight !== undefined) {
            return state.gridHeight;
        }
        return state.gridSize * this.getBaseGridHeight(this.props.properties.gridType);
    }

    getGridAspectRatio(state: GridEditorComponentState = this.state) {
        const gridAspect = state.gridSize / this.getGridHeight(state);
        return gridAspect * this.getBaseGridHeight(this.props.properties.gridType);
    }

    keepCoordinatesOnScreen(left: number, top: number, side: number, gridType: GridType, state = this.state) {
        const {strideX, strideY} = getGridStride(gridType);
        const repeatWidth = strideX * state.gridSize;
        const repeatHeight = strideY * this.getGridHeight(state) / this.getBaseGridHeight(gridType);
        const scale = 100.0 / state.zoom;
        const screenX = left + state.mapX * scale;
        const screenY = top + state.mapY * scale;
        const portrait = (state.width < state.height);
        const halfWidth = state.width * scale / 2;
        const halfHeight = state.height * scale / 2;
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
    }

    keepPushpinsOnScreen() {
        if (!this.state.pinned[0] || !this.state.pinned[1]) {
            const pushpinIndex = (this.state.pinned[0]) ? 1 : 0;
            const {left, top} = this.pushpinPosition(pushpinIndex);
            const gridType = this.props.properties.gridType;
            const {dX, dY, repeatWidth, repeatHeight} = this.keepCoordinatesOnScreen(left, top, pushpinIndex, gridType);
            if (pushpinIndex === 0) {
                let {gridOffsetX, gridOffsetY} = this.state;
                gridOffsetX += repeatWidth * dX;
                gridOffsetY += repeatHeight * dY;
                this.setState({gridOffsetX, gridOffsetY});
            } else {
                let {zoomOffX, zoomOffY} = this.state;
                zoomOffX += dX;
                zoomOffY += dY;
                if (zoomOffX !== 0 || zoomOffY !== 0) {
                    this.setState({zoomOffX, zoomOffY});
                }
            }
        }
    }

    panPushpin(delta: ObjectVector2, selected: number) {
        const scale = 100.0 / this.state.zoom;
        const dx = delta.x * scale;
        const dy = delta.y * scale;
        if (selected === 1) {
            const gridOffsetX = this.state.gridOffsetX + dx;
            const gridOffsetY = this.state.gridOffsetY + dy;
            this.setState({gridOffsetX, gridOffsetY});
        } else {
            const {strideX, strideY} = getGridStride(this.props.properties.gridType);
            const gridDX = this.state.zoomOffX === 0 ? 0 : dx / this.state.zoomOffX / strideX;
            const gridDY = this.state.zoomOffY === 0 ? 0 : dy / this.state.zoomOffY / strideY * this.getBaseGridHeight(this.props.properties.gridType);
            if (this.props.properties.gridHeight === undefined) {
                const delta = (Math.abs(this.state.zoomOffX) > Math.abs(+this.state.zoomOffY)) ? gridDX : gridDY;
                const gridSize = Math.max(4, this.state.gridSize + delta);
                this.setState({gridSize, gridHeight: undefined});
            } else {
                const gridSize = Math.max(4, this.state.gridSize + gridDX);
                const gridHeight = Math.max(4, this.getGridHeight() + gridDY);
                this.setState({gridSize, gridHeight});
            }
        }
    }

    onPan(delta: ObjectVector2) {
        if (this.state.selected && !this.state.pinned[this.state.selected - 1]) {
            this.panPushpin(delta, this.state.selected);
        } else {
            this.setState(this.clampMapXY(this.state.mapX + delta.x, this.state.mapY + delta.y, this.state.zoom), () => {
                this.keepPushpinsOnScreen();
            });
        }
    }

    onBump(x: number, y: number, index?: number) {
        if (index !== undefined) {
            this.panPushpin({x, y}, index + 1);
        }
    }

    onZoom(delta: ObjectVector2) {
        const zoom = clamp(this.state.zoom - delta.y, 20, 1000);
        const midX = this.state.width / 2;
        const midY = this.state.height / 2;
        const mapX = (this.state.mapX - midX) / this.state.zoom * zoom + midX;
        const mapY = (this.state.mapY - midY) / this.state.zoom * zoom + midY;
        this.setState({zoom, ...this.clampMapXY(mapX, mapY, zoom)}, () => {
            this.keepPushpinsOnScreen();
        });
    }

    setGrid(width: number, height: number, gridState: number) {
        // Stretch map height and gridOffsetY to make the grid squares/regular hexagons.
        const gridAspectRatio = this.getGridAspectRatio();
        let gridOffsetX = this.state.gridOffsetX;
        let gridOffsetY = this.state.gridOffsetY * gridAspectRatio;
        // For hexagonal grids, modify gridOffsetX and gridOffsetY to indicate the centre of a hex.
        let centreOffsetX = 1, centreOffsetY = 1, strideX = 1, strideY = 1;
        switch (this.props.properties.gridType) {
            case GridType.HEX_HORZ:
                gridOffsetY = (gridOffsetY + this.getGridHeight() * gridAspectRatio) % (SQRT3 * this.state.gridSize);
                strideY = SQRT3 / 2;
                if (gridOffsetY > strideY * this.state.gridSize) {
                    gridOffsetX += this.state.gridSize / 2;
                    gridOffsetY -= strideY * this.state.gridSize;
                }
                gridOffsetX = gridOffsetX % this.state.gridSize;
                centreOffsetX = 1.5;
                centreOffsetY = 5 / 3;
                break;
            case GridType.HEX_VERT:
                gridOffsetX = (gridOffsetX + this.state.gridSize * INV_SQRT3) % (SQRT3 * this.state.gridSize);
                strideX = SQRT3 / 2;
                if (gridOffsetX > strideX * this.state.gridSize) {
                    gridOffsetX -= strideX * this.state.gridSize;
                    gridOffsetY += this.state.gridSize / 2;
                }
                gridOffsetY = gridOffsetY % this.state.gridSize;
                centreOffsetX = 5 / 3;
                centreOffsetY = 1 + (gridOffsetY > this.state.gridSize / 2 ? 1 : 0);
                break;
        }
        height *= gridAspectRatio;
        const dX = gridOffsetX / this.state.gridSize;
        const dY = gridOffsetY / this.state.gridSize;
        const fogWidth = Math.ceil((width - dX % strideX) / strideX + centreOffsetX);
        const fogHeight = Math.ceil((height - dY % strideY) / strideY + centreOffsetY);
        this.props.setGrid(width, height, this.state.gridSize, gridOffsetX, gridOffsetY, fogWidth, fogHeight, gridState, this.state.gridHeight);
    }

    onTap() {
        if (this.state.selected) {
            const index = this.state.selected - 1;
            const pinned = [...this.state.pinned];
            pinned[index] = (pinned[index]) ? null : this.pushpinPosition(index);
            if (index === 0) {
                pinned[1] = null;
            }
            this.setState({pinned, selected: undefined}, () => {
                this.keepPushpinsOnScreen();
            });
            const width = this.state.imageWidth / this.state.gridSize;
            const height = this.state.imageHeight / this.state.gridSize;
            this.setGrid(width, height, (pinned[0] ? 1 : 0) + (pinned[1] ? 1 : 0));
        } else if (this.state.bump) {
            this.onBump(this.state.bump.x, this.state.bump.y, this.state.bump.index);
            this.setState({bump: undefined});
        }
    }

    onGestureEnd() {
        this.setState({selected: undefined});
        this.keepPushpinsOnScreen();
    }

    pushpinPosition(index: number, state: GridEditorComponentState = this.state): CssPosition {
        if (state.pinned[index]) {
            return state.pinned[index]!;
        } else {
            const {strideX, strideY} = getGridStride(this.props.properties.gridType);
            const left = index * state.zoomOffX * strideX * state.gridSize + state.gridOffsetX;
            const top = index * state.zoomOffY * strideY
                * this.getGridHeight(state) / this.getBaseGridHeight(this.props.properties.gridType)
                + state.gridOffsetY;
            return {top, left};
        }
    }

    private getCurrentIndex() {
        return !this.state.pinned[0] ? 0 : !this.state.pinned[1] ? 1 : undefined;
    }

    renderBumper(direction: string, style: any, x: number, y: number, index: number) {
        return (
            <div key={direction} className={classNames('bump', direction)} style={style}
                 onTouchStart={() => {this.setState({bump: {x, y, index}})}}
                 onMouseDown={() => {this.setState({bump: {x, y, index}})}}
             />
        );
    }

    renderPushPin(index: number) {
        const gridColour = this.props.properties.gridColour;
        const xDominant = Math.abs(this.state.zoomOffX) > Math.abs(+this.state.zoomOffY);
        const renderXBumpers = index === 0 || ((this.props.properties.gridHeight !== undefined || xDominant) && this.state.zoomOffX !== 0);
        const renderYBumpers = index === 0 || ((this.props.properties.gridHeight !== undefined || !xDominant) && this.state.zoomOffY !== 0);
        return (this.props.properties.gridType === GridType.NONE || (index === 1 && !this.state.pinned[0])) ? null : (
            <div
                className={classNames('pushpinContainer', {pinned: !!this.state.pinned[index]})}
                style={{...this.pushpinPosition(index), transform: `scale(${100 / this.state.zoom})`}}
            >
                <span
                    role='img'
                    aria-label='pushpin'
                    className='pushpin'
                    onMouseDown={() => {this.setState({selected: 1 + index})}}
                    onTouchStart={() => {this.setState({selected: 1 + index})}}
                >📌</span>
                {renderXBumpers ? this.renderBumper('right', {borderLeftColor: gridColour}, 1, 0, index) : null}
                {renderXBumpers ? this.renderBumper('left', {borderRightColor: gridColour}, -1, 0, index) : null}
                {renderYBumpers ? this.renderBumper('up', {borderBottomColor: gridColour}, 0, -1, index) : null}
                {renderYBumpers ? this.renderBumper('down', {borderTopColor: gridColour}, 0, 1, index) : null}
            </div>
        );
    }

    renderGrid() {
        const {gridOffsetX, gridOffsetY, gridSize} = this.state;
        const gridHeight = this.getGridHeight();
        let pattern;
        switch (this.props.properties.gridType) {
            case GridType.NONE:
                return null;
            case GridType.SQUARE:
                pattern = (
                    <pattern id='grid' x={gridOffsetX} y={gridOffsetY} width={gridSize} height={gridHeight} patternUnits='userSpaceOnUse'>
                        <path d={`M ${gridSize} 0 L 0 0 0 ${gridHeight}`} fill='none' stroke={this.props.properties.gridColour} strokeWidth='1'/>
                    </pattern>
                );
                break;
            case GridType.HEX_VERT:
                // Since the horizontal distance of "gridSize" pixels is used to define a distance of 1.0 in the tabletop
                // 3D space, and a vertical hex grid should have a horizontal distance of SQRT3 / 2 between the centres
                // of adjacent hexes, we need to scale up the grid pattern.
                const hexH = gridSize * INV_SQRT3;
                const hexV = gridHeight * INV_SQRT3;
                pattern = (
                    <pattern id='grid' x={gridOffsetX} y={gridOffsetY} width={3 * hexH} height={2 * hexV} patternUnits='userSpaceOnUse'>
                        <path d={`M 0 0 l ${hexH / 2} ${hexV} ${hexH} 0 ${hexH / 2} ${-hexV} ` +
                        `${hexH} 0 M ${hexH / 2} ${hexV} L 0 ${2 * hexV} M ${3 * hexH / 2} ${hexV} ` +
                        `L ${2 * hexH} ${2 * hexV}`} fill='none' stroke={this.props.properties.gridColour} strokeWidth='1'/>
                    </pattern>
                );
                break;
            case GridType.HEX_HORZ:
                pattern = (
                    <pattern id='grid' x={gridOffsetX} y={gridOffsetY} width={gridSize} height={3 * gridHeight} patternUnits='userSpaceOnUse'>
                        <path d={`M 0 0 l ${gridSize/2} ${gridHeight/2} 0 ${gridHeight} ${-gridSize/2} ${gridHeight/2} ` +
                        `0 ${gridHeight} M ${gridSize/2} ${gridHeight/2} L ${gridSize} 0 M ${gridSize/2} ${3*gridHeight/2} ` +
                        `L ${gridSize} ${2*gridHeight}`} fill='none' stroke={this.props.properties.gridColour} strokeWidth='1'/>
                    </pattern>
                );
                break;
        }
        return (
            <div className='grid' key={`x:${gridOffsetX},y:${gridOffsetY}`}>
                <svg width="500%" height="500%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        {pattern}
                    </defs>
                    <rect width="500%" height="500%" fill="url(#grid)" />
                </svg>
            </div>
        );
    }

    onTextureLoad(rawWidth: number, rawHeight: number) {
        this.setState({
            imageWidth: rawWidth,
            imageHeight: rawHeight
        });
        const width = rawWidth / this.state.gridSize;
        const height = rawHeight / this.state.gridSize;
        this.setGrid(width, height, (this.state.pinned[0] ? 1 : 0) + (this.state.pinned[1] ? 1 : 0));
        window.URL.revokeObjectURL(this.props.textureUrl);
    }

    renderMap() {
        return this.props.videoTexture ? (
            <video loop={true} autoPlay={true} src={this.props.textureUrl} onLoadedMetadata={(evt: React.SyntheticEvent<HTMLVideoElement>) => {
                this.onTextureLoad(evt.currentTarget.videoWidth, evt.currentTarget.videoHeight);
            }}>
                Your browser doesn't support embedded videos.
            </video>
        ) : (
            <img src={this.props.textureUrl} alt='map' onLoad={(evt) => {
                if (isSizedEvent(evt)) {
                    this.onTextureLoad(evt.target.width, evt.target.height);
                }
            }}/>
        )
    }

    render() {
        return (
            <GestureControls
                className='gridEditorComponent'
                onPan={this.onPan}
                onZoom={this.onZoom}
                onTap={this.onTap}
                onGestureEnd={this.onGestureEnd}
            >
                <KeyDownHandler keyMap={{
                    ArrowLeft: {callback: () => {this.onBump(-1, 0, this.getCurrentIndex())}},
                    ArrowRight: {callback: () => {this.onBump(1, 0, this.getCurrentIndex())}},
                    ArrowUp: {callback: () => {this.onBump(0, -1, this.getCurrentIndex())}},
                    ArrowDown: {callback: () => {this.onBump(0, 1, this.getCurrentIndex())}}
                }} />
                <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={this.onResize}/>
                <div className='editMapPanel' style={{
                    marginLeft: this.state.mapX,
                    marginTop: this.state.mapY,
                    transform: `scale(${this.state.zoom / 100})`
                }}>
                    {this.renderMap()}
                    {this.renderGrid()}
                    {this.renderPushPin(0)}
                    {this.renderPushPin(1)}
                </div>
            </GestureControls>
        );
    }
}