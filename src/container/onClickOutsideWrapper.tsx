import {Children, Component, PropsWithChildren} from 'react';
import onClickOutside, {InjectedOnClickOutProps} from 'react-onclickoutside';

interface OnClickOutsideWrapperProps extends PropsWithChildren {
    onClickOutside: () => void;
}

class OnClickOutsideWrapper extends Component<OnClickOutsideWrapperProps & InjectedOnClickOutProps> {
    public handleClickOutside() {
        this.props.onClickOutside();
    }

    render() {
        return Children.only(this.props.children);
    }
}

export default onClickOutside(OnClickOutsideWrapper);