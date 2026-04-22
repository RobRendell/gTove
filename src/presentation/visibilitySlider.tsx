import './visibilitySlider.scss';

import classNames from 'classnames';
import {CSSProperties, FunctionComponent, useMemo} from 'react';

import {MINI_VISIBILITY_OPTIONS} from '../util/scenarioUtils';
import {PieceVisibilityEnum} from '../util/storage/storageContract';

interface VisibilitySliderProps {
    visibility: PieceVisibilityEnum;
    onChange: (value: PieceVisibilityEnum) => void;
}

const VisibilitySlider: FunctionComponent<VisibilitySliderProps> = ({visibility, onChange}) => {
    const options = MINI_VISIBILITY_OPTIONS;
    const onClickFunctions = useMemo(() => (
        Object.fromEntries(
            options.map((option) => ([
                option.value,
                () => {onChange(option.value);}
            ]))
        )
    ), [onChange, options]);
    const toggleStyle = useMemo<CSSProperties>(() => {
        const selectedIndex = Math.max(0, options.findIndex((option) => (option.value === visibility)));
        return {
            width: `${100 / options.length}%`,
            transform: `translateX(${selectedIndex * 100}%)`
        };
    }, [options, visibility]);

    return (
        <div className='visibilitySlider'>
            {
                options.map((option) => (
                    <div key={option.value}
                         className={classNames('toggleOption', {selected: option.value === visibility})}
                         onClick={onClickFunctions[option.value]}
                    >{option.displayName}</div>
                ))
            }
            <div className='toggle' style={toggleStyle}>&nbsp;</div>
        </div>
    );
}

export default VisibilitySlider;