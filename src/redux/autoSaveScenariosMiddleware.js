import {throttle} from 'lodash';

import {getScenarioFromStore, scenarioToJson, SET_SCENARIO_ACTION} from './scenarioReducer';
import {getWorkspaceIdFromStore} from './locationReducer';
import {uploadJsonToDriveFile} from '../util/googleAPIUtils';

const updateScenario = throttle((driveMetadata, scenarioState) => {
    const scenario = scenarioToJson(scenarioState);
    return uploadJsonToDriveFile(driveMetadata, scenario);
}, 5000);

const autoSaveScenariosMiddleware = store => next => action => {
    const previousScenarioState = getScenarioFromStore(store.getState());
    const result = next(action);
    const scenarioState = getScenarioFromStore(store.getState());
    if (action.type !== SET_SCENARIO_ACTION && scenarioState !== previousScenarioState) {
        const driveMetadata = {id: getWorkspaceIdFromStore(store.getState())};
        updateScenario(driveMetadata, scenarioState);
    }
    return result;
};

export default autoSaveScenariosMiddleware;