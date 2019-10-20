import * as React from 'react';
import Modal from 'react-modal';
import classNames from 'classnames';

import {promiseHOC, PromiseHOC} from '../container/promiseHOC';
import InputButton from './inputButton';

import './promiseModalDialog.css';

// Bind modal to appElement (http://reactcommunity.org/react-modal/accessibility/)
Modal.setAppElement('#root');

export interface PromiseModalDialogOption {
    label: string;
    value: any;
}

function isPromiseModalDialogOption(value: any): value is PromiseModalDialogOption {
    return value && value.label;
}

export interface PromiseModalDialogProps extends PromiseHOC {
    children?: React.ReactNode;
    contentLabel?: string;
    options?: (string | PromiseModalDialogOption)[];
    className?: string;
}

class PromiseModalDialog extends React.Component<PromiseModalDialogProps> {
    render() {
        const options = this.props.options || ['OK'];
        return (
            <Modal
                isOpen={true}
                onRequestClose={() => {this.props.setResult()}}
                contentLabel={this.props.contentLabel}
                className={classNames('modalDialog', this.props.className)}
                overlayClassName='overlay'
                parentSelector={() => (document.getElementsByClassName('fullscreen')[0] as HTMLElement)}
            >
                <div>
                    {this.props.children}
                </div>
                <div className='modalButtonDiv'>
                    {
                        options.map((option) => {
                            const label = isPromiseModalDialogOption(option) ? option.label : option;
                            const value = isPromiseModalDialogOption(option) ? option.value : option;
                            return (
                                <InputButton type='button' key={label} onChange={() => {this.props.setResult(value)}}>{label}</InputButton>
                            )
                        })
                    }
                </div>
            </Modal>
        )
    }
}

export default promiseHOC(PromiseModalDialog);