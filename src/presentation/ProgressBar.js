import React, {Component} from 'react';
import * as PropTypes from 'prop-types';

import './ProgressBar.css';

class ProgressBar extends Component {

    static propTypes = {
        progress: PropTypes.number.isRequired
    };

    render() {
        return (
            <div className='progressBarBack'>
                <div className='progressBar' style={{width: (100 * this.props.progress)}} />
            </div>
        );
    }
}

export default ProgressBar;