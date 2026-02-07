import {Component} from 'react';

import ModalDialog, {ModalDialogProps} from '../presentation/modalDialog';
import {PromiseComponentFunc, PromiseHOC, promiseHOC} from './promiseHOC';

export interface PromiseModalDialogProps extends PromiseHOC, ModalDialogProps {
}

export type PromiseModalDialogType = PromiseComponentFunc<PromiseModalDialogProps>;

class PromiseModalDialog extends Component<PromiseModalDialogProps> {

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