import THREE from 'three';
import {FunctionComponent, useCallback, useContext, useEffect, useState} from 'react';
import {useDispatch, useStore} from 'react-redux';
import {omit} from 'lodash';

import {DriveMetadata} from '../util/googleDriveUtils';
import {TextureLoaderContextObject} from '../context/fileAPIContextBridge';
import TextureService from '../service/textureService';
import {isVideoTexture} from '../util/threeUtils';
import {getTabletopFromStore} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';

interface TextureContainerProps {
    metadata: DriveMetadata;
    setTexture: (texture: THREE.Texture | THREE.VideoTexture) => void;
}

const TextureContainer: FunctionComponent<TextureContainerProps> = ({metadata, setTexture}) => {
    const textureLoader = useContext(TextureLoaderContextObject);
    const dispatch = useDispatch();
    const store = useStore();
    const [stateTexture, setStateTexture] = useState<THREE.Texture | THREE.VideoTexture | undefined>();
    useEffect(() => {
        (async () => {
            const texture = await TextureService.getTexture(metadata, textureLoader);
            setTexture(texture);
            setStateTexture(texture);
        })();
        return () => {
            (async () => {
                const lastUse = await TextureService.releaseTexture(metadata);
                setStateTexture(undefined);
                if (lastUse) {
                    const {videoMuted} = getTabletopFromStore(store.getState());
                    if (videoMuted[metadata.id] !== undefined) {
                        dispatch(updateTabletopAction({videoMuted: omit(videoMuted, metadata.id)}));
                    }
                }
            })();
        }
    }, [metadata, textureLoader, setTexture, dispatch, store]);
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

export default TextureContainer;