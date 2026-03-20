import {useContextBridge} from '@react-three/drei';
import {Canvas, Props as CanvasProps} from '@react-three/fiber';
import {FunctionComponent} from 'react';
import {ReactReduxContext} from 'react-redux';

import {ToastContextObject} from '../presentation/toastProvider';
import {FileAPIContextObject, TextureLoaderContextObject} from './fileAPIContextBridge';
import {PromiseModalContextObject} from './promiseModalContextBridge';

/**
 * Context is lost inside the Canvas renderer: https://github.com/pmndrs/react-three-fiber/issues/43
 * The workaround is to explicitly forward things from the context, like the Redux store, which is what this component
 * does.
 */
const CanvasContextBridge: FunctionComponent<CanvasProps> = ({children, ...otherProps}) => {
    const ContextBridge = useContextBridge(
        ReactReduxContext,
        FileAPIContextObject,
        TextureLoaderContextObject,
        PromiseModalContextObject,
        ToastContextObject
    );
    return (
        <Canvas {...otherProps}>
            <ContextBridge>
                {children}
            </ContextBridge>
        </Canvas>
    );
};

export default CanvasContextBridge;