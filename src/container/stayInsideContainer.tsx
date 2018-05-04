import * as React from 'react';
import * as PropTypes from 'prop-types';
import sizeMe, {ReactSizeMeProps} from 'react-sizeme';

interface StayInsideContainerProps extends ReactSizeMeProps {
    containedHeight: number;
    containedWidth: number;
    top: number;
    left: number;
    className: string;
}

class StayInsideContainer extends React.Component<StayInsideContainerProps> {

    static propTypes = {
        containedHeight: PropTypes.number.isRequired,
        containedWidth: PropTypes.number.isRequired,
        top: PropTypes.number.isRequired,
        left: PropTypes.number.isRequired,
        className: PropTypes.string
    };

    render() {
        const top = (this.props.top + this.props.size.height >= this.props.containedHeight) ? this.props.containedHeight - this.props.size.height - 1 : this.props.top;
        const left = (this.props.left + this.props.size.width >= this.props.containedWidth) ? this.props.containedWidth - this.props.size.width - 1 : this.props.left;
        return (
            <div className={this.props.className} style={{top, left}}>
                {this.props.children}
            </div>
        );
    }
}

export default sizeMe({monitorWidth: true, monitorHeight: true})(StayInsideContainer);