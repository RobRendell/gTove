import * as React from 'react';
import onClickOutside, {InjectedOnClickOutProps} from 'react-onclickoutside';

interface OnClickOutsideWrapperProps {
    onClickOutside: () => void;
}

class OnClickOutsideWrapper extends React.Component<OnClickOutsideWrapperProps & InjectedOnClickOutProps> {
    public handleClickOutside() {
        this.props.onClickOutside();
    }

    render() {
        return React.Children.only(this.props.children);
    }
}

export default onClickOutside(OnClickOutsideWrapper);