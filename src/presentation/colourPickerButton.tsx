import './colourPickerButton.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useState} from 'react';

import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import {getColourHexString} from '../util/scenarioUtils';
import ColourPicker, {ColourPickerProps} from './colourPicker';

interface ColourPickerButtonProps extends ColourPickerProps {
    className?: string;
}

const ColourPickerButton: FunctionComponent<ColourPickerButtonProps> = ({
                                                                            initialColour,
                                                                            disableAlpha,
                                                                            initialAlpha,
                                                                            onColourChange,
                                                                            initialSwatches,
                                                                            onSwatchChange,
                                                                            className
                                                                        }) => {
    const [showColourPicker, setShowColourPicker] = useState(false);
    const toggleShowColourPicker = useCallback(() => {
        setShowColourPicker((prev) => (!prev));
    }, []);

    return (
        <div className={classNames('colourPickerButton', className)}>
            {
                showColourPicker ? (
                    <OnClickOutsideWrapper onClickOutside={toggleShowColourPicker}>
                        <ColourPicker
                            initialColour={initialColour}
                            disableAlpha={disableAlpha}
                            initialAlpha={initialAlpha}
                            onColourChange={onColourChange}
                            initialSwatches={initialSwatches}
                            onSwatchChange={onSwatchChange}
                        />
                    </OnClickOutsideWrapper>
                ) : (
                    <div className='colourSwatch' onClick={toggleShowColourPicker}>
                        <div style={{backgroundColor: getColourHexString(initialColour)}}/>
                    </div>
                )
            }
        </div>
    )
}

export default ColourPickerButton;