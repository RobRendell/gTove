import {FunctionComponent, useCallback} from 'react';

import {DiceBagReducerType} from '../../redux/diceBagReducer';
import InputButton from '../inputButton';
import DieImage from './dieImage';

interface DieButtonProps {
    dieType: string;
    busy: boolean;
    dicePoolMode: boolean;
    diceBag: DiceBagReducerType;
    onSelectDie: (dieType: string, poolName?: string) => void;
}

export const DieButton: FunctionComponent<DieButtonProps> = ({
                                                                 dieType,
                                                                 busy,
                                                                 dicePoolMode,
                                                                 diceBag,
                                                                 onSelectDie
                                                             }) => {
    const {poolName} = diceBag.dieType[dieType];
    const onClick = useCallback(() => {
        onSelectDie(dieType, poolName);
    }, [onSelectDie, dieType, poolName]);
    const disabled = dicePoolMode ?  (poolName !== undefined) : busy;
    return (poolName !== undefined && dieType !== poolName) ? null : (
        <InputButton key={'dieButton-' + dieType} type='button' disabled={disabled} onChange={onClick}>
            <DieImage dieType={dieType} diceBag={diceBag} />
        </InputButton>
    );
};