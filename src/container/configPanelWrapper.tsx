import {FunctionComponent, PropsWithChildren, ReactNode} from 'react';

import InputButton from '../presentation/inputButton';

interface ConfigPanelWrapperProps extends PropsWithChildren {
    onClose: () => void;
    onSave: () => Promise<void>;
    disableSave?: boolean;
    className?: string;
    controls?: ReactNode[];
    hideControls?: boolean;
}

const ConfigPanelWrapper: FunctionComponent<ConfigPanelWrapperProps> = ({onClose, onSave, disableSave, className, controls, hideControls, children}) => {
    return (
        <div className={className}>
            {
                hideControls ? null : (
                    <div className='controls'>
                        <InputButton type='button' onChange={onClose}>Cancel</InputButton>
                        <InputButton type='button' disabled={disableSave} onChange={onSave}>Save</InputButton>
                        {controls}
                    </div>
                )
            }
            {children}
        </div>
    );
}

export default ConfigPanelWrapper;