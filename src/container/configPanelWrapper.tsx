import {Component, PropsWithChildren} from 'react';

import InputButton from '../presentation/inputButton';

interface ConfigPanelWrapperProps extends PropsWithChildren {
    onClose: () => void;
    onSave: () => Promise<void>;
    disableSave?: boolean;
    className?: string;
    controls?: React.ReactNode[];
    hideControls?: boolean;
}

export default class ConfigPanelWrapper extends Component<ConfigPanelWrapperProps> {
    render() {
        return (
            <div className={this.props.className}>
                {
                    this.props.hideControls ? null : (
                        <div className='controls'>
                            <InputButton type='button' onChange={this.props.onClose}>Cancel</InputButton>
                            <InputButton type='button' disabled={this.props.disableSave} onChange={this.props.onSave}>Save</InputButton>
                            {
                                (this.props.controls || null)
                            }
                        </div>
                    )
                }
                {this.props.children}
            </div>
        );
    }
}