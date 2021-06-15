import {Component} from 'react';

import './spinner.scss';

interface SpinnerProps {
    size?: number;
}

export default class Spinner extends Component<SpinnerProps> {
    render() {
        const size = this.props.size || 20;
        return (
            <svg className='spinner' width={size + 'px'} height={size + 'px'} viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                <circle className='path' fill='none' strokeWidth='4' strokeLinecap='round' cx='12' cy='12' r='10'/>
            </svg>
        );
    }
}