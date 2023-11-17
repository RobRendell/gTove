import {FunctionComponent} from 'react';

import './dieImage.scss'

import d4 from '../images/d4.png';
import d6 from '../images/d6.png';
import d8 from '../images/d8.png';
import d10 from '../images/d10.png';
import d12 from '../images/d12.png';
import d20 from '../images/d20.png';
import blankD4 from '../images/blank_d4.png';
import blankD6 from '../images/blank_d6.png';
import blankD8 from '../images/blank_d8.png';
import blankD10 from '../images/blank_d10.png';
import blankD12 from '../images/blank_d12.png';
import blankD20 from '../images/blank_d20.png';

import {DiceBagReducerType} from '../../redux/diceBagReducer';
import {DieShapeEnum} from '../../util/dieObjectUtils';

const shapeToImage = {
    [DieShapeEnum.d4]: [d4, blankD4],
    [DieShapeEnum.d6]: [d6, blankD6],
    [DieShapeEnum.d8]: [d8, blankD8],
    [DieShapeEnum.d10]: [d10, blankD10],
    [DieShapeEnum.d12]: [d12, blankD12],
    [DieShapeEnum.d20]: [d20, blankD20]
}

type DieImageProps = {
    dieType: string;
    diceBag: DiceBagReducerType;
};

const DieImage: FunctionComponent<DieImageProps> = ({dieType, diceBag}) => {
    const {shape, buttonLabel, buttonUseBlank, labelX, labelY} = diceBag.dieType[dieType];
    const index = buttonUseBlank ? 1 : 0;
    const src = shapeToImage[shape][index];
    return (
        <div className='dieImage'>
            <img src={src} alt={dieType}/>
            {
                buttonLabel === undefined ? null : (
                    <span className='dieButtonLabel' style={{
                        left: (labelX === undefined ? 50 : labelX) + '%',
                        top: (labelY === undefined ? 50 : labelY) + '%'
                    }}>{buttonLabel}</span>
                )
            }
        </div>
    );
}

export default DieImage;