import * as React from 'react';

import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';

import './helpButton.scss';

interface HelpButtonProps {
}

interface HelpButtonState {
    open: boolean;
}

export default class HelpButton extends React.Component<HelpButtonProps, HelpButtonState> {

    constructor(props: HelpButtonProps) {
        super(props);
        this.openHelp = this.openHelp.bind(this);
        this.closeHelp = this.closeHelp.bind(this);
        this.state = {
            open: false
        }
    }

    openHelp() {
        this.setState({open: true});
    }

    closeHelp() {
        this.setState({open: false});
    }

    render() {
        return (
            <span className='helpButton'>
                <span className='material-icons' onClick={this.openHelp} title='More details...'>help</span>
                {
                    !this.state.open ? null : (
                        <OnClickOutsideWrapper onClickOutside={this.closeHelp}>
                            <div className='helpText'>
                                {this.props.children}
                            </div>
                        </OnClickOutsideWrapper>
                    )
                }
            </span>

        );
    }
}