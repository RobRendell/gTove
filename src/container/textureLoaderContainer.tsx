import THREE from 'three';
import {PropsWithChildren, useCallback, useContext, useEffect, useState} from 'react';
import {useDispatch, useStore} from 'react-redux';
import {omit} from 'lodash';

import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import {TextureLoaderContextObject} from '../context/fileAPIContextBridge';
import TextureService from '../service/textureService';
import {isVideoTexture} from '../util/threeUtils';
import {getAllFilesFromStore, getTabletopFromStore} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {updateFileAction} from '../redux/fileIndexReducer';

interface TextureContainerProps<T> {
    metadata: FileMetadata;
    setTexture: (texture: THREE.Texture | THREE.VideoTexture) => void;
    calculateProperties: (properties: T, update?: Partial<T>) => T;
}

const TextureLoaderContainer = <T extends MapProperties | MiniProperties>({metadata, setTexture, calculateProperties}: PropsWithChildren<TextureContainerProps<T>>) => {
    const textureLoader = useContext(TextureLoaderContextObject);
    const dispatch = useDispatch();
    const store = useStore();
    const [stateTexture, setStateTexture] = useState<THREE.Texture | THREE.VideoTexture | undefined>();
    useEffect(() => {
        if (!metadata.mimeType) {
            // Wait for the mime type to be available, to prevent spurious loading and freeing of the texture.
            return;
        }
        (async () => {
            const {texture, width, height} = await TextureService.getTexture(metadata, textureLoader);
            setTexture(texture);
            setStateTexture(texture);
            // Verify width/height, for maps and pieces which have been added without properties
            const {fileMetadata: driveMetadata} = getAllFilesFromStore(store.getState());
            const myMetadata = driveMetadata[metadata.id] as FileMetadata<void, T>;
            if (!myMetadata?.properties?.width) {
                dispatch(updateFileAction({...myMetadata, properties: calculateProperties(
                    myMetadata?.properties!, {width, height} as Partial<T>
                )}));
            }
        })();
        return () => {
            (async () => {
                const lastUse = await TextureService.releaseTexture(metadata.id);
                if (lastUse) {
                    const {videoMuted} = getTabletopFromStore(store.getState());
                    if (videoMuted[metadata.id] !== undefined) {
                        dispatch(updateTabletopAction({videoMuted: omit(videoMuted, metadata.id)}));
                    }
                }
            })();
        }
    }, [metadata, textureLoader, setTexture, dispatch, store, calculateProperties]);
    const playUntilSuccess = useCallback(async () => {
        // Autoplay policies can prevent an un-muted video from playing until the user interacts with the page.  Keep
        // trying until it succeeds.
        if (isVideoTexture(stateTexture)) {
            try {
                await stateTexture.image.play();
            } catch (e) {
                setTimeout(playUntilSuccess, 500);
            }
        }
    }, [stateTexture]);
    const {videoMuted} = getTabletopFromStore(store.getState());
    const muted = videoMuted[metadata.id];
    useEffect(() => {
        if (isVideoTexture(stateTexture)) {
            if (muted === undefined) {
                // Add this new video texture to the set of textures which can be un/muted
                const {videoMuted} = getTabletopFromStore(store.getState());
                dispatch(updateTabletopAction({videoMuted: {...videoMuted, [metadata.id]: false}}));
            } else {
                stateTexture.image.muted = muted;
                if (stateTexture.image.paused) {
                    playUntilSuccess();
                }
            }
        }
    }, [stateTexture, playUntilSuccess, muted, store, dispatch, metadata]);
    return null;
};

export default TextureLoaderContainer;