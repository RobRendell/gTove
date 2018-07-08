import * as React from 'react';
import * as PropTypes from 'prop-types';
import sizeMe, {ReactSizeMeProps} from 'react-sizeme';
import {clamp} from 'lodash';
import * as classNames from 'classnames';

import GestureControls, {ObjectVector2} from '../container/gestureControls';
import * as constants from '../util/constants';
import {MapAppProperties} from '../util/googleDriveUtils';
import {isSizedEvent} from '../util/types';

import './gridEditorComponent.css';

interface GridEditorComponentProps extends ReactSizeMeProps {
    setGrid: (width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridComplete: boolean) => void;
    appProperties: MapAppProperties;
    textureUrl: string;
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
    gridOffsetX: number;
    gridOffsetY: number;
    zoom: number;
    selected?: number;
    bump?: {x: number, y: number, index: number};
    pinned: (CssPosition | null)[];
    zoomOffX: number;
    zoomOffY: number;
}

class GridEditorComponent extends React.Component<GridEditorComponentProps, GridEditorComponentState> {

    static propTypes = {
        setGrid: PropTypes.func.isRequired,
        appProperties: PropTypes.object.isRequired,
        textureUrl: PropTypes.string.isRequired
    };

    constructor(props: GridEditorComponentProps) {
        super(props);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onTap = this.onTap.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.state = this.getStateFromProps(props);
    }

    getStateFromProps(props: GridEditorComponentProps) {
        let result: GridEditorComponentState = {
            imageWidth: 0,
            imageHeight: 0,
            mapX: 0,
            mapY: 0,
            gridSize: Number(props.appProperties.gridSize) || 32,
            gridOffsetX: Number(props.appProperties.gridOffsetX) || 32,
            gridOffsetY: Number(props.appProperties.gridOffsetY) || 32,
            zoom: 100,
            selected: undefined,
            bump: undefined,
            pinned: [null, null],
            zoomOffX: 5,
            zoomOffY: 3
        };
        if (props.appProperties && props.appProperties.gridSize && props.appProperties.gridColour !== constants.GRID_NONE) {
            result.pinned = [
                this.pushpinPosition(0, result),
                this.pushpinPosition(1, result)
            ];
        }
        return result;
    }

    clampMapXY(oldMapX: number, oldMapY: number, zoom: number) {
        const mapX = clamp(oldMapX, Math.min(0, this.props.size.width - this.state.imageWidth * zoom / 100), 0);
        const mapY = clamp(oldMapY, Math.min(0, this.props.size.height - this.state.imageHeight * zoom / 100), 0);
        return {mapX, mapY};
    }

    keepPushpinsOnScreen() {
        if (!this.state.pinned[0] || !this.state.pinned[1]) {
            const gridSize = this.state.gridSize;
            const scale = 100.0 / this.state.zoom;
            const pushpinIndex = (this.state.pinned[0]) ? 1 : 0;
            const {left, top} = this.pushpinPosition(pushpinIndex);
            const screenX = left + this.state.mapX * scale;
            const screenY = top + this.state.mapY * scale;
            const portrait = (this.props.size.width < this.props.size.height);
            const halfWidth = this.props.size.width * scale / 2;
            const halfHeight = this.props.size.height * scale / 2;
            const minX = (portrait ? 0 : pushpinIndex * halfWidth);
            const minY = gridSize + (portrait ? pushpinIndex * halfHeight : 0);
            const maxX = (portrait ? 2 : (1 + pushpinIndex)) * halfWidth - 2 * gridSize;
            const maxY = (portrait ? (1 + pushpinIndex) : 2) * halfHeight - gridSize;
            const dX = (screenX < minX) ? minX - screenX : (screenX >= maxX) ? maxX - screenX : 0;
            const dY = (screenY < minY) ? minY - screenY : (screenY >= maxY) ? maxY - screenY : 0;
            if (pushpinIndex === 0) {
                let {gridOffsetX, gridOffsetY} = this.state;
                gridOffsetX += gridSize * Math.ceil(dX / gridSize);
                gridOffsetY += gridSize * Math.ceil(dY / gridSize);
                this.setState({gridOffsetX, gridOffsetY});
            } else {
                let {zoomOffX, zoomOffY} = this.state;
                zoomOffX += Math.ceil(dX / gridSize);
                zoomOffY += Math.ceil(dY / gridSize);
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
            const gridDX = this.state.zoomOffX === 0 ? 0 : dx / this.state.zoomOffX;
            const gridDY = this.state.zoomOffY === 0 ? 0 : dy / this.state.zoomOffY;
            const delta = (Math.abs(this.state.zoomOffX) > Math.abs(this.state.zoomOffY)) ? gridDX : gridDY;
            const gridSize = this.state.gridSize + delta;
            this.setState({gridSize});
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

    onBump(x: number, y: number, index: number) {
        const scale = 100.0 / this.state.zoom;
        this.panPushpin({x: x / scale, y: y / scale}, index + 1);
    }

    onZoom(delta: ObjectVector2) {
        const zoom = clamp(this.state.zoom - delta.y, 90, 1000);
        const midX = this.props.size.width / 2;
        const midY = this.props.size.height / 2;
        const mapX = (this.state.mapX - midX) / this.state.zoom * zoom + midX;
        const mapY = (this.state.mapY - midY) / this.state.zoom * zoom + midY;
        this.setState({zoom, ...this.clampMapXY(mapX, mapY, zoom)}, () => {
            this.keepPushpinsOnScreen();
        });
    }

    setGrid(width: number, height: number, gridComplete: boolean) {
        const dX = (1 + this.state.gridOffsetX / this.state.gridSize) % 1;
        const dY = (1 + this.state.gridOffsetY / this.state.gridSize) % 1;
        const fogWidth = Math.ceil(width + 1 - dX);
        const fogHeight = Math.ceil(height + 1 - dY);
        this.props.setGrid(width, height, this.state.gridSize, this.state.gridOffsetX, this.state.gridOffsetY, fogWidth, fogHeight, gridComplete);
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
            this.setGrid(width, height, !!(pinned[0] && pinned[1]));
        } else if (this.state.bump) {
            this.onBump(this.state.bump.x, this.state.bump.y, this.state.bump.index);
            this.setState({bump: undefined});
        }
    }

    onGestureEnd() {
        this.setState({selected: undefined});
    }

    pushpinPosition(index: number, state: GridEditorComponentState = this.state): CssPosition {
        if (state.pinned[index]) {
            return state.pinned[index]!;
        } else {
            const gridSize = state.gridSize;
            let x = index * state.zoomOffX;
            let y = index * state.zoomOffY;
            const left = x * gridSize + state.gridOffsetX;
            const top = y * gridSize + state.gridOffsetY;
            return {top, left};
        }
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
        const gridColour = this.props.appProperties.gridColour;
        return (gridColour === constants.GRID_NONE || (index === 1 && !this.state.pinned[0])) ? null : (
            <div
                className={classNames('pushpinContainer', {pinned: !!this.state.pinned[index]})}
                style={this.pushpinPosition(index)}
            >
                <span
                    role='img'
                    aria-label='pushpin'
                    className='pushpin'
                    onMouseDown={() => {this.setState({selected: 1 + index})}}
                    onTouchStart={() => {this.setState({selected: 1 + index})}}
                >📌</span>
                {this.renderBumper('right', {borderLeftColor: gridColour}, 1, 0, index)}
                {this.renderBumper('left', {borderRightColor: gridColour}, -1, 0, index)}
                {this.renderBumper('up', {borderBottomColor: gridColour}, 0, -1, index)}
                {this.renderBumper('down', {borderTopColor: gridColour}, 0, 1, index)}
            </div>
        );
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
                <div className='editMapPanel' style={{
                    marginLeft: this.state.mapX,
                    marginTop: this.state.mapY,
                    transform: `scale(${this.state.zoom / 100})`
                }}>
                    <img src={this.props.textureUrl} alt='map' onLoad={(evt: any) => {
                        if (isSizedEvent(evt)) {
                            window.URL.revokeObjectURL(this.props.textureUrl);
                            this.setState({
                                imageWidth: evt.target.width,
                                imageHeight: evt.target.height
                            });
                            const width = evt.target.width / this.state.gridSize;
                            const height = evt.target.height / this.state.gridSize;
                            this.setGrid(width, height, !!(this.state.pinned[0] && this.state.pinned[1]));
                        }
                    }}/>
                    <div className='grid'>
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id='grid' x={this.state.gridOffsetX} y={this.state.gridOffsetY} width={this.state.gridSize} height={this.state.gridSize} patternUnits='userSpaceOnUse'>
                                    <path d={`M ${this.state.gridSize} 0 L 0 0 0 ${this.state.gridSize}`} fill='none' stroke={this.props.appProperties.gridColour} strokeWidth='1'/>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>
                    {this.renderPushPin(0)}
                    {this.renderPushPin(1)}
                </div>
            </GestureControls>
        );
    }
}

export default sizeMe({monitorHeight: true})(GridEditorComponent);