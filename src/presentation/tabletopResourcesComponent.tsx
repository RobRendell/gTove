import * as React from 'react';

import TabletopMiniComponent from './tabletopMiniComponent';

export default class TabletopResourcesComponent extends React.Component {

    renderResources() {
        const width = TabletopMiniComponent.MINI_WIDTH;
        const height = TabletopMiniComponent.MINI_HEIGHT;
        const radius = width/10;
        return (
            <resources>
                <shape resourceId='mini'>
                    <moveTo x={-width / 2} y={0}/>
                    <lineTo x={-width / 2} y={height - radius}/>
                    <quadraticCurveTo cpX={-width / 2} cpY={height} x={radius - width / 2} y={height}/>
                    <lineTo x={width / 2 - radius} y={height}/>
                    <quadraticCurveTo cpX={width / 2} cpY={height} x={width / 2} y={height - radius}/>
                    <lineTo x={width / 2} y={0}/>
                    <lineTo x={-width / 2} y={0}/>
                </shape>
                <shape resourceId='base'>
                    <absArc x={0} y={0} radius={width / 2} startAngle={0} endAngle={Math.PI * 2} clockwise={false}/>
                </shape>
            </resources>
        );
    }

    render() {
        return this.renderResources();
    }
}