import {FunctionComponent, useContext} from 'react';
import {Canvas, Props as CanvasProps} from '@react-three/fiber';
import {Provider, useStore} from 'react-redux';

import {FileAPIContextObject, TextureLoaderContextObject} from './fileAPIContextBridge';
import {PromiseModalContextObject} from './promiseModalContextBridge';

const CanvasContextBridge: FunctionComponent<CanvasProps> = ({children, ...otherProps}) => {
    // The canvas loses all context - manually pass things through :(
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const textureLoader = useContext(TextureLoaderContextObject);
    const promiseModal = useContext(PromiseModalContextObject);
    return (
        <Canvas {...otherProps}>
            <Provider store={store}>
                <FileAPIContextObject.Provider value={fileAPI}>
                    <TextureLoaderContextObject.Provider value={textureLoader}>
                        <PromiseModalContextObject.Provider value={promiseModal}>
                            {children}
                        </PromiseModalContextObject.Provider>
                    </TextureLoaderContextObject.Provider>
                </FileAPIContextObject.Provider>
            </Provider>
        </Canvas>
    );
};

export default CanvasContextBridge;