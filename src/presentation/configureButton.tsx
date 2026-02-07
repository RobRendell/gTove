import './configureButton.scss';

import {FunctionComponent} from 'react';

interface ConfigureButtonProps {
    onClick: () => void;
}

const ConfigureButton: FunctionComponent<ConfigureButtonProps> = ({onClick}) => {
    return (
        <div className='configControl'>
            <span className='material-icons' onClick={onClick}>settings</span>
        </div>
    );
};

export default ConfigureButton;