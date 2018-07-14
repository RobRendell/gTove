import * as React from 'react';
import * as Modal from 'react-modal';
import * as classNames from 'classnames';

import {promiseHOC, PromiseHOC} from '../container/promiseHOC';

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

export interface PromiseModalDialogProps {
    children: React.ReactNode;
    contentLabel?: string;
    options?: (string | PromiseModalDialogOption)[];
    className?: string;
}

class PromiseModalDialog extends React.Component<PromiseModalDialogProps & PromiseHOC> {
    render() {
        const options = this.props.options || ['Ok'];
        return (
            <Modal
                isOpen={true}
                onRequestClose={() => {this.props.setResult()}}
                contentLabel={this.props.contentLabel}
                className={classNames('modalDialog', this.props.className)}
                overlayClassName='overlay'
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
                                <button key={label} onClick={() => {this.props.setResult(value)}}>{label}</button>
                            )
                        })
                    }
                </div>
            </Modal>
        )
    }
}

export default promiseHOC(PromiseModalDialog);