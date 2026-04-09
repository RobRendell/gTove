import {useContext} from 'react';

import {ToastContextObject} from '../context/toastProvider';

export function useToast() {
    const toast = useContext(ToastContextObject);
    if (!toast) {
        throw new Error('useToast must be used inside a ToastProvider');
    }
    return toast;
}