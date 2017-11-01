
export const ADD_FILES_ACTION = 'add_files_action';

export default function fileIndexReducer(state = {}, action) {
    switch (action.type) {
        case ADD_FILES_ACTION:
            return {...state, ...action.files};
        default:
            return state;
    }
}

export function addFilesAction(files) {
    return {type: ADD_FILES_ACTION, files};
}

export function getAllFilesFromStore(store) {
    return store.fileIndex;
}