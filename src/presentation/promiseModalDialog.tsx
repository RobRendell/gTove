import * as React from 'react';
import * as Modal from 'react-modal';

import {promiseHOC, PromiseHOC} from '../container/promiseHOC';

import './promiseModalDialog.css';

// Bind modal to appElement (http://reactcommunity.org/react-modal/accessibility/)
Modal.setAppElement('#root');

export interface PromiseModalDialogProps {
    children: React.ReactNode;
    contentLabel?: string;
    options?: string[];
}

class PromiseModalDialog extends React.Component<PromiseModalDialogProps & PromiseHOC> {
    render() {
        const options = this.props.options || ['Ok'];
        return (
            <Modal
                isOpen={true}
                onRequestClose={() => {this.props.setResult()}}
                contentLabel={this.props.contentLabel}
                className='modalDialog'
                overlayClassName='overlay'
            >
                <div>
                    {this.props.children}
                </div>
                <div className='modalButtonDiv'>
                    {
                        options.map((option) => (
                            <button key={option} onClick={() => {this.props.setResult(option)}}>{option}</button>
                        ))
                    }
                </div>
            </Modal>
        )
    }
}

export default promiseHOC(PromiseModalDialog);