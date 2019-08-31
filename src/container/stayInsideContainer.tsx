import * as React from 'react';
import ReactResizeDetector, {withResizeDetector} from 'react-resize-detector';

interface StayInsideContainerProps {
    top: number;
    left: number;
    className: string;
    width: number;
    height: number;
}

interface StayInsideContainerState {
    insideWidth: number;
    insideHeight: number;
}

class StayInsideContainer extends React.Component<StayInsideContainerProps, StayInsideContainerState> {

    constructor(props: StayInsideContainerProps) {
        super(props);
        this.state = {
            insideWidth: 0,
            insideHeight: 0
        }
    }

    render() {
        const top = (this.props.top + this.state.insideHeight >= this.props.height) ? this.props.height - this.state.insideHeight - 1 : this.props.top;
        const left = (this.props.left + this.state.insideWidth >= this.props.width) ? this.props.width - this.state.insideWidth - 1 : this.props.left;
        return (
            <div className={this.props.className} style={{top, left}}>
                <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={(insideWidth, insideHeight) => {this.setState({insideWidth, insideHeight})}}/>
                {this.props.children}
            </div>
        );
    }
}

export default withResizeDetector(StayInsideContainer);