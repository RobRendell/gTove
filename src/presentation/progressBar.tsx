import './progressBar.scss';

import * as PropTypes from 'prop-types';
import {Component} from 'react';

interface ProgressBarProps {
    progress: number;
}

class ProgressBar extends Component<ProgressBarProps> {

    static propTypes = {
        progress: PropTypes.number.isRequired
    };

    render() {
        return (
            <div className='progressBarBack'>
                <div className='progressBar' style={{width: `${100 * this.props.progress}%`}} />
            </div>
        );
    }
}

export default ProgressBar;