import * as React from 'react';
import Modal from 'react-modal';
import classNames from 'classnames';

import InputButton from './inputButton';

import './modalDialog.scss';

export interface ModalDialogOption {
    label: string;
    value: any;
}

function isModalDialogOption(value: any): value is ModalDialogOption {
    return value && value.label;
}

export interface ModalDialogProps {
    isOpen?: boolean;
    children?: React.ReactNode;
    heading?: string;
    options?: (string | ModalDialogOption | undefined)[];
    className?: string;
    onRequestClose?: () => void;
    setResult: (value?: any) => void;
}

export default class ModalDialog extends React.Component<ModalDialogProps> {

    constructor(props: ModalDialogProps) {
        super(props);
        Modal.setAppElement('#root'); // Overridden by parentSelector prop.
    }

    render() {
        const options = this.props.options || ['OK'];
        return (
            <Modal
                isOpen={this.props.isOpen === undefined ? true : this.props.isOpen}
                onRequestClose={this.props.onRequestClose}
                className={classNames('modalDialog', this.props.className)}
                overlayClassName='overlay'
                parentSelector={() => {
                    const fullScreen = document.getElementsByClassName('fullscreen');
                    return (fullScreen && fullScreen.length > 0) ? (fullScreen[0] as HTMLElement) : document.body;
                }}
            >
                {
                    !this.props.heading ? null : (
                        <div className='heading'>
                            {this.props.heading}
                        </div>
                    )
                }
                <div>
                    {this.props.children}
                </div>
                <div className='modalButtonDiv'>
                    {
                        options.map((option) => {
                            if (!option) {
                                return null;
                            }
                            const label = isModalDialogOption(option) ? option.label : option;
                            const value = isModalDialogOption(option) ? option.value : option;
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