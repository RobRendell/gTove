import * as React from 'react';
import * as PropTypes from 'prop-types';

import './progressBar.css';

interface ProgressBarProps {
    progress: number;
}

class ProgressBar extends React.Component<ProgressBarProps> {

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