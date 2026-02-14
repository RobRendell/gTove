import {Component, Fragment, PropsWithChildren} from 'react';

import {MovableWindowContextObject} from '../presentation/movableWindow';

export default class MovableWindowRemountChild extends Component<PropsWithChildren> {

    static contextType = MovableWindowContextObject;
    declare context: React.ContextType<typeof MovableWindowContextObject>;

    render() {
        return (
            <Fragment key={this.context ? 'inPoppedOutWindow' : 'inApp'}>
                {this.props.children}
            </Fragment>
        );
    }
}