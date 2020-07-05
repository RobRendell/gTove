import * as React from 'react';

import ModalDialog, {ModalDialogProps} from '../presentation/modalDialog';
import {promiseHOC, PromiseHOC} from './promiseHOC';

export interface PromiseModalDialogProps extends PromiseHOC, ModalDialogProps {
}

class PromiseModalDialog extends React.Component<PromiseModalDialogProps> {

    render() {
        return (
            <ModalDialog options={this.props.options}
                         className={this.props.className}
                         heading={this.props.heading}
                         onRequestClose={() => this.props.setResult()}
                         setResult={this.props.setResult}
            >
                {this.props.children}
            </ModalDialog>
        )
    }
}

export default promiseHOC(PromiseModalDialog);