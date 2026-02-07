import * as PropTypes from 'prop-types';
import * as React from 'react';

import {MovableWindowContext} from '../presentation/movableWindow';

export default class MovableWindowRemountChild extends React.Component {

    static contextTypes = {
        windowPoppedOut: PropTypes.bool
    };

    context: MovableWindowContext;

    render() {
        return (
            <React.Fragment key={this.context.windowPoppedOut ? 'inPoppedOutWindow' : 'inApp'}>
                {this.props.children}
            </React.Fragment>
        );
    }
}