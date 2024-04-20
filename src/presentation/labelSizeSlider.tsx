import './labelSizeSlider.scss';

import {FunctionComponent} from 'react';
import classNames from 'classnames';

import InputField from './inputField';

interface LabelSizeSliderProps {
    labelSize: number;
    setLabelSize: (size: number) => void;
    className?: string;
}

const LabelSizeSlider: FunctionComponent<LabelSizeSliderProps> = ({labelSize, setLabelSize, className}) => {
    return (
        <div className={classNames('labelSizeControl', className)}>
            <span className='smaller'>A</span>
            <InputField className='labelSizeInput' type='range' tooltip='Label Size'
                        initialValue={labelSize} minValue={0.05} maxValue={0.6} step={0.05}
                        onChange={(value) => {
                            setLabelSize(Number(value));
                        }}
            />
            <span className='larger'>A</span>
        </div>
    );
}

export default LabelSizeSlider;