import {createContext, FunctionComponent, PropsWithChildren} from 'react';

export const DisableGlobalKeyboardHandlerContextObject = createContext((_: boolean) => {});

interface DisableGlobalKeyboardHandlerProviderProps extends PropsWithChildren {
    value: (disable: boolean) => void;
}

const DisableGlobalKeyboardHandlerProvider: FunctionComponent<DisableGlobalKeyboardHandlerProviderProps> = ({value, children}) => {
    return (
        <DisableGlobalKeyboardHandlerContextObject.Provider value={value}>
            {children}
        </DisableGlobalKeyboardHandlerContextObject.Provider>
    )
}

export default DisableGlobalKeyboardHandlerProvider;