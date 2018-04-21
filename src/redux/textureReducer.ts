import * as THREE from 'three';
import {Reducer} from 'redux';

// =========================== Action types and generators

enum TextureReducerActionTypes {
    CACHE_TEXTURE = 'cache_texture'
}

interface CacheTextureActionType {
    type: TextureReducerActionTypes.CACHE_TEXTURE;
    textureId: string;
    texture: THREE.Texture;
}

export function cacheTextureAction(textureId: string, texture: THREE.Texture): CacheTextureActionType {
    return {type: TextureReducerActionTypes.CACHE_TEXTURE, textureId, texture};
}

// =========================== Reducers

export interface TextureReducerType {
    [key: string]: THREE.Texture;
}

const textureReducer: Reducer<TextureReducerType> = (state = {}, action) => {
    switch (action.type) {
        case TextureReducerActionTypes.CACHE_TEXTURE:
            return {...state, [action.textureId]: action.texture};
        default:
            return state;
    }
};

export default textureReducer;

