import * as React from 'react';

import TabletopMiniComponent from './tabletopMiniComponent';

export default class TabletopResourcesComponent extends React.Component {

    renderResources() {
        const width = TabletopMiniComponent.MINI_WIDTH;
        const height = TabletopMiniComponent.MINI_HEIGHT;
        const cornerRadius = width * TabletopMiniComponent.MINI_CORNER_RADIUS_PERCENT / 100;
        const thickness = TabletopMiniComponent.MINI_THICKNESS;
        return (
            <resources>
                <shape resourceId='mini'>
                    <moveTo x={-width / 2} y={0}/>
                    <lineTo x={-width / 2} y={height - cornerRadius}/>
                    <quadraticCurveTo cpX={-width / 2} cpY={height} x={cornerRadius - width / 2} y={height}/>
                    <lineTo x={width / 2 - cornerRadius} y={height}/>
                    <quadraticCurveTo cpX={width / 2} cpY={height} x={width / 2} y={height - cornerRadius}/>
                    <lineTo x={width / 2} y={0}/>
                    <lineTo x={-width / 2} y={0}/>
                </shape>
                <cylinderGeometry resourceId='miniBase' radiusTop={0.5} radiusBottom={0.5} radialSegments={32} height={thickness}/>
            </resources>
        );
    }

    render() {
        return this.renderResources();
    }
}