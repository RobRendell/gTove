import * as React from 'react';
import * as PropTypes from 'prop-types';
import sizeMe, {ReactSizeMeProps} from 'react-sizeme';

interface SizeAwareContainerProps extends ReactSizeMeProps {
    onSizeChanged: (width: number, height: number) => void;
}

class SizeAwareContainer extends React.Component<SizeAwareContainerProps> {

    static propTypes = {
        onSizeChanged: PropTypes.func.isRequired
    };

    componentDidMount() {
        this.props.onSizeChanged(this.props.size.width, this.props.size.height);
    }

    componentWillReceiveProps(newProps: SizeAwareContainerProps) {
        if (newProps.size.width !== this.props.size.width || newProps.size.height !== this.props.size.height) {
            newProps.onSizeChanged(newProps.size.width, newProps.size.height);
        }
    }

    render() {
        return React.Children.only(this.props.children);
    }
}

export default sizeMe({monitorWidth: true, monitorHeight: true})(SizeAwareContainer);
