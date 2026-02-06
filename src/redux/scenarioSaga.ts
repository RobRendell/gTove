import {put, select, takeEvery} from 'typed-redux-saga';
import {AnyAction} from 'redux';

import {FileIndexActionTypes, RemoveFileActionType, ReplaceFileAction, UpdateFileActionType} from './fileIndexReducer';
import {getScenarioFromStore} from './mainReducer';
import {MapType, MiniType} from '../util/scenarioUtils';
import {removeMapAction, removeMiniAction, updateMapMetadataAction, updateMiniMetadataAction} from './scenarioReducer';
import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import {GToveThunk} from '../util/types';

function findMatchingMetadata(state: {[key: string]: (MapType | MiniType)}, metadataId: string): string[] {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state)
        .filter((id) => (state[id].metadata?.id === metadataId));
}

function putThunk<T extends GToveThunk<any>>(action: T) {
    return put(action as unknown as AnyAction);
}

function* handleUpdateFileAction(action: UpdateFileActionType) {
    const scenario = yield* select(getScenarioFromStore);
    const mapIds = findMatchingMetadata(scenario.maps, action.metadata.id);
    for (const mapId of mapIds) {
        yield putThunk(updateMapMetadataAction(mapId, action.metadata as FileMetadata<void, MapProperties>));
    }
    const miniIds = findMatchingMetadata(scenario.minis, action.metadata.id);
    for (const miniId of miniIds) {
        yield putThunk(updateMiniMetadataAction(miniId, action.metadata as FileMetadata<void, MiniProperties>));
    }
}

function* handleReplaceFileAction(action: ReplaceFileAction) {
    const scenario = yield* select(getScenarioFromStore);
    const mapIds = findMatchingMetadata(scenario.maps, action.metadata.id);
    for (const mapId of mapIds) {
        yield putThunk(updateMapMetadataAction(mapId, action.newMetadata as FileMetadata<void, MapProperties>));
    }
    const miniIds = findMatchingMetadata(scenario.minis, action.metadata.id);
    for (const miniId of miniIds) {
        yield putThunk(updateMiniMetadataAction(miniId, action.newMetadata as FileMetadata<void, MiniProperties>));
    }
}

function* handleRemoveFileAction(action: RemoveFileActionType) {
    const scenario = yield* select(getScenarioFromStore);
    const mapIds = findMatchingMetadata(scenario.maps, action.fileId);
    for (const mapId of mapIds) {
        yield putThunk(removeMapAction(mapId));
    }
    const miniIds = findMatchingMetadata(scenario.minis, action.fileId);
    for (const miniId of miniIds) {
        yield putThunk(removeMiniAction(miniId));
    }
}

export default function* scenarioSaga() {
    yield* takeEvery(FileIndexActionTypes.UPDATE_FILE_ACTION, handleUpdateFileAction);
    yield* takeEvery(FileIndexActionTypes.REPLACE_FILE_ACTION, handleReplaceFileAction);
    yield* takeEvery(FileIndexActionTypes.REMOVE_FILE_ACTION, handleRemoveFileAction);
}