const CACHE_TEXTURE = 'cache_texture';

const textureReducer = (state = {}, action) => {
    switch (action.type) {
        case CACHE_TEXTURE:
            return {...state, [action.textureId]: action.texture};
        default:
            return state;
    }
};

export default textureReducer;

export function cacheTextureAction(textureId, texture) {
    return {type: CACHE_TEXTURE, textureId, texture};
}

export function getAllTexturesFromStore(store) {
    return store.texture;
}