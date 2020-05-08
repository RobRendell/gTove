import * as React from 'react';
import Modal from 'react-modal';
import classNames from 'classnames';

import {promiseHOC, PromiseHOC} from '../container/promiseHOC';
import InputButton from './inputButton';

import './promiseModalDialog.scss';

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
    options?: (string | PromiseModalDialogOption | undefined)[];
    className?: string;
}

class PromiseModalDialog extends React.Component<PromiseModalDialogProps> {

    constructor(props: PromiseModalDialogProps) {
        super(props);
        Modal.setAppElement('#root'); // Overridden by parentSelector prop.
    }


    render() {
        const options = this.props.options || ['OK'];
        return (
            <Modal
                isOpen={true}
                onRequestClose={() => {this.props.setResult()}}
                contentLabel={this.props.contentLabel}
                className={classNames('modalDialog', this.props.className)}
                overlayClassName='overlay'
                parentSelector={() => {
                    const fullScreen = document.getElementsByClassName('fullscreen');
                    return (fullScreen && fullScreen.length > 0) ? (fullScreen[0] as HTMLElement) : document.body;
                }}
            >
                <div>
                    {this.props.children}
                </div>
                <div className='modalButtonDiv'>
                    {
                        options.map((option) => {
                            if (!option) {
                                return null;
                            }
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