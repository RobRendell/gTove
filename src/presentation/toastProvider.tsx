import './toastProvider.scss';

import {createContext, FunctionComponent, PropsWithChildren, useCallback, useContext, useRef} from 'react';
import {toast, ToastContainer} from 'react-toastify';


export const ToastContextObject = createContext<undefined | ((message: string, enable?: boolean) => void)>(undefined);

const ToastProvider: FunctionComponent<PropsWithChildren> = ({children}) => {

    const toastIdsRef = useRef<{[message: string]: string | number}>({});

    const displayToast = useCallback((message: string, enable?: boolean) => {
        if (enable || enable === undefined) {
            if (!toastIdsRef.current[message]) {
                toastIdsRef.current[message] = toast(message, {
                    autoClose: enable ? false : undefined,
                    onClose: () => {
                        delete toastIdsRef.current[message];
                    }
                });
            }
        } else if (toastIdsRef.current[message]) {
            toast.dismiss(toastIdsRef.current[message]);
            delete toastIdsRef.current[message];
        }
    }, []);

    return (
        <ToastContextObject.Provider value={displayToast}>
            <ToastContainer className='toastContainer' position='bottom-center' hideProgressBar={true}/>
            {children}
        </ToastContextObject.Provider>
    );
}

export default ToastProvider;

export function useToast() {
    const toast = useContext(ToastContextObject);
    if (!toast) {
        throw new Error('useToast must be used inside a ToastProvider');
    }
    return toast;
}