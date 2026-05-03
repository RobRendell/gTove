import {createContext, FunctionComponent, PropsWithChildren, useCallback, useRef} from 'react';

import PromiseModalDialog, {PromiseModalDialogType} from '../container/promiseModalDialog';

export const PromiseModalContextObject = createContext<PromiseModalDialogType | undefined>(undefined);

const PromiseModalProvider: FunctionComponent<PropsWithChildren> = ({children}) => {
    const promiseModalRef = useRef<PromiseModalDialogType | undefined>();
    const setPromiseModal = useCallback((modal: PromiseModalDialogType) => {
        promiseModalRef.current = modal;
    }, []);

    return (
        <PromiseModalContextObject.Provider value={promiseModalRef.current}>
            {children}
            <PromiseModalDialog setPromiseComponent={setPromiseModal}/>
        </PromiseModalContextObject.Provider>
    );
}

export default PromiseModalProvider;