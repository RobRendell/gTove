import * as React from 'react';

import './rubberBand.scss';

export interface RubberBandProps {
    left: number;
    top: number;
    width: number;
    height: number;
}

export default class RubberBand extends React.Component<RubberBandProps> {
    render() {
        let {left, top, width, height} = this.props;
        if (width < 0) {
            left += width;
            width = -width;
        }
        if (height < 0) {
            top += height;
            height = -height;
        }
        return (
            <div className='rubberBand' style={{left, top, width, height}}/>
        )
    }
}