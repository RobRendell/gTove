import {useCallback, useContext} from 'react';
import {useStore} from 'react-redux';

import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {getScenarioFromStore} from '../redux/mainReducer';
import {joinAnd} from '../util/stringUtils';

export function useConfirmLargeFogOfWarAction() {
    const store = useStore();
    const promiseModal = useContext(PromiseModalContextObject);
    return useCallback(async (mapIds: string[]) => {
        const scenario = getScenarioFromStore(store.getState());
        const complexFogMapIds = mapIds.filter((mapId) => {
            const {fogOfWar} = scenario.maps[mapId] ?? {};
            return fogOfWar && fogOfWar.some((bitmask) => (!!bitmask && bitmask !== -1));
        });
        if (complexFogMapIds.length > 0 && promiseModal?.isAvailable()) {
            const mapNames = complexFogMapIds.length === 1
                ? 'Map "' + scenario.maps[complexFogMapIds[0]].name + '" has'
                : 'Maps "' + joinAnd(complexFogMapIds.map((mapId) => (scenario.maps[mapId].name)), '", "', '" and "') + '" have';
            const proceed = 'Proceed';
            const response = await promiseModal({
                children: `${mapNames} detailed fog-of-war coverage.  Are you sure you want to discard it?`,
                options: [proceed, 'Cancel']
            });
            return response === proceed;
        }
        return true;
    }, [promiseModal, store]);
}