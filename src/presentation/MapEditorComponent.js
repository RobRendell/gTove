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
        textureUrl: PropTypes.string.isRequired,
        gridColour: PropTypes.string
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
            gridSize: props.appProperties.gridSize || 50,
            gridX: props.appProperties.gridX || 0,
            gridY: props.appProperties.gridY || 0,
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

    onPan(delta) {
        if (this.state.selected && !this.state.pinned[this.state.selected - 1]) {
            const dx = delta.x * 100 / this.state.zoom;
            const dy = delta.y * 100 / this.state.zoom;
            if (this.state.selected === 1) {
                const gridX = this.state.gridX + dx;
                const gridY = this.state.gridY + dy;
                this.setState({gridX, gridY});
            } else {
                const delta = (Math.abs(dx) > Math.abs(dy)) ? dx / this.state.zoomOffX : dy / this.state.zoomOffY;
                const gridSize = this.state.gridSize + delta;
                const gridX = this.state.gridX - delta;
                const gridY = this.state.gridY - delta;
                this.setState({gridSize, gridX, gridY});
            }
        } else {
            const mapX = clamp(this.state.mapX + delta.x, -this.state.imageWidth + this.props.size.width, 0);
            const mapY = clamp(this.state.mapY + delta.y, -this.state.imageHeight + this.props.size.height, 0);
            this.setState({mapX, mapY});
        }
    }

    onZoom(delta) {
        const zoom = clamp(this.state.zoom - delta.y, 90, 300);
        this.setState({zoom});
    }

    onTap() {
        if (this.state.selected) {
            const index = this.state.selected - 1;
            const pinned = [...this.state.pinned];
            if (pinned[index]) {
                pinned[index] = null;
            } else {
                pinned[index] = this.pushpinStyle(index);
                if (this.state.selected === 2) {
                    const width = this.state.imageWidth / this.state.gridSize;
                    const height = this.state.imageHeight / this.state.gridSize;
                    this.props.setGrid(width, height, this.state.gridSize, this.state.gridX, this.state.gridY);
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
            const left = x * gridSize + state.gridX;
            const top = y * gridSize + state.gridY;
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
            >📌</span>
        );
    }

    render() {
        const gridGradient = `transparent, transparent ${this.state.gridSize - 2}px, ${this.props.gridColour} ${this.state.gridSize}px`;
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
                    <div className='grid' style={{
                        backgroundImage: `repeating-linear-gradient(0deg, ${gridGradient}), repeating-linear-gradient(-90deg, ${gridGradient})`,
                        backgroundSize: `${this.state.gridSize}px ${this.state.gridSize}px`,
                        backgroundPosition: `${this.state.gridX}px ${this.state.gridY}px`
                    }}/>
                    {this.renderPushPin(0)}
                    {this.renderPushPin(1)}
                </div>
            </GestureControls>
        );
    }
}

export default sizeMe({monitorHeight: true})(MapEditorComponent);