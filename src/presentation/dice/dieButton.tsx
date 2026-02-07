import {FunctionComponent, useCallback, useMemo} from 'react';

import InputButton from '../inputButton';
import DieImage from './dieImage';
import {DiceBagReducerType} from '../../redux/diceBagReducerTypes';

interface DieButtonProps {
    dieType: string;
    busy: boolean;
    dicePoolMode: boolean;
    diceBag: DiceBagReducerType;
    onSelectDie: (dieType: string) => void;
}

export const DieButton: FunctionComponent<DieButtonProps> = ({
                                                                 dieType,
                                                                 busy,
                                                                 dicePoolMode,
                                                                 diceBag,
                                                                 onSelectDie,
                                                             }) => {
    const {poolName} = diceBag.dieType[dieType];
    const onClick = useCallback(() => {
        onSelectDie(dieType);
    }, [onSelectDie, dieType]);
    const toolTip = useMemo(() => (
        !dicePoolMode ? `Roll${poolName ? '' : ' a'} ${dieType}`
        : poolName ? `Include ${dieType} in the pool (only once)`
            : `Add 1${dieType} to pool`
    ), [dicePoolMode, dieType, poolName])
    return (poolName !== undefined && dieType !== poolName) ? null : (
        <InputButton key={'dieButton-' + dieType} type='button' disabled={busy} onChange={onClick}
                     tooltip={toolTip}
        >
            <DieImage dieType={dieType} diceBag={diceBag} />
        </InputButton>
    );
};