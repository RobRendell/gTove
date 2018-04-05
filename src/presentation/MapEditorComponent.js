import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {sizeMe} from 'react-sizeme';
import {clamp} from 'lodash';
import classNames from 'classnames';

import GestureControls from '../container/GestureControls';

import './MapEditorComponent.css';

class MapEditorComponent extends Component {

    static propTypes = {
        setGrid: PropTypes.func.isRequired,
        appProperties: PropTypes.object.isRequired,
        textureUrl: PropTypes.string.isRequired
    };

    constructor(props) {
        super(props);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onTap = this.onTap.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.state = this.getStateFromProps(props);
    }

    getStateFromProps(props) {
        let result = {
            imageWidth: 0,
            imageHeight: 0,
            mapX: 0,
            mapY: 0,
            gridSize: Number(props.appProperties.gridSize) || 50,
            gridOffsetX: Number(props.appProperties.gridOffsetX) || 0,
            gridOffsetY: Number(props.appProperties.gridOffsetY) || 0,
            zoom: 100,
            selected: null,
            pinned: [null, null],
            zoomOffX: 5,
            zoomOffY: 3
        };
        if (props.appProperties && props.appProperties.gridSize) {
            result.pinned = [
                this.pushpinStyle(0, result),
                this.pushpinStyle(1, result)
            ];
        }
        return result;
    }

    clampMapXY(oldMapX, oldMapY, zoom) {
        const mapX = clamp(oldMapX, Math.min(0, this.props.size.width - this.state.imageWidth * zoom / 100), 0);
        const mapY = clamp(oldMapY, Math.min(0, this.props.size.height - this.state.imageHeight * zoom / 100), 0);
        return {mapX, mapY};
    }

    onPan(delta) {
        if (this.state.selected && !this.state.pinned[this.state.selected - 1]) {
            const dx = delta.x * 100 / this.state.zoom;
            const dy = delta.y * 100 / this.state.zoom;
            if (this.state.selected === 1) {
                const gridOffsetX = this.state.gridOffsetX + dx;
                const gridOffsetY = this.state.gridOffsetY + dy;
                this.setState({gridOffsetX, gridOffsetY});
            } else {
                const delta = (Math.abs(dx) > Math.abs(dy)) ? dx / this.state.zoomOffX : dy / this.state.zoomOffY;
                const gridSize = this.state.gridSize + delta;
                const gridOffsetX = this.state.gridOffsetX - delta;
                const gridOffsetY = this.state.gridOffsetY - delta;
                this.setState({gridSize, gridOffsetX, gridOffsetY});
            }
        } else {
            this.setState(this.clampMapXY(this.state.mapX + delta.x, this.state.mapY + delta.y, this.state.zoom));
        }
    }

    onZoom(delta) {
        const zoom = clamp(this.state.zoom - delta.y, 90, 300);
        this.setState({zoom, ...this.clampMapXY(this.state.mapX, this.state.mapY, zoom)});
    }

    onTap() {
        if (this.state.selected) {
            const index = this.state.selected - 1;
            const pinned = [...this.state.pinned];
            if (pinned[index]) {
                pinned[index] = null;
                if (this.state.selected === 1) {
                    pinned[index + 1] = null;
                }
            } else {
                pinned[index] = this.pushpinStyle(index);
                if (this.state.selected === 2) {
                    const width = this.state.imageWidth / this.state.gridSize;
                    const height = this.state.imageHeight / this.state.gridSize;
                    this.props.setGrid(width, height, this.state.gridSize, this.state.gridOffsetX, this.state.gridOffsetY);
                }
            }
            this.setState({pinned, selected: null});
        }
    }

    onGestureEnd() {
        this.setState({selected: null});
    }

    pushpinStyle(index, state = this.state) {
        if (state.pinned[index]) {
            return state.pinned[index];
        } else {
            const gridSize = state.gridSize;
            // const leftEdge = Math.ceil(-state.mapX / gridSize * 100 / state.zoom);
            // const rightEdge = Math.floor((this.props.size.width - state.mapX) / gridSize * 100 / state.zoom);
            let x = 1 + index * state.zoomOffX;
            let y = 1 + index * state.zoomOffY;
            const left = x * gridSize + state.gridOffsetX;
            const top = y * gridSize + state.gridOffsetY;
            return {top, left};
        }
    }

    renderPushPin(index) {
        return (index === 1 && !this.state.pinned[0]) ? null : (
            <span
                role='img'
                aria-label='pushpin'
                className={classNames('pushpin', {pinned: this.state.pinned[index]})}
                style={this.pushpinStyle(index)}
                onMouseDown={() => {this.setState({selected: 1 + index})}}
                onTouchStart={() => {this.setState({selected: 1 + index})}}
            >📌</span>
        );
    }

    render() {
        return (
            <GestureControls
                className='mapEditorComponent'
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
                    <img src={this.props.textureUrl} alt='map' onLoad={(evt) => {
                        window.URL.revokeObjectURL(this.props.textureUrl);
                        this.setState({
                            imageWidth: evt.target.width,
                            imageHeight: evt.target.height
                        });
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

export default sizeMe({monitorHeight: true})(MapEditorComponent);