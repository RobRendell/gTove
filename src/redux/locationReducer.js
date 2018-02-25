const CHANGE_WORKSPACE_ID = 'change-workspace-id';

export const routesMap = {
    [CHANGE_WORKSPACE_ID]: '/:workspaceId?'
};

export function changeWorkspaceIdAction(workspaceId) {
    return {type: CHANGE_WORKSPACE_ID, payload: {workspaceId}};
}

export function getWorkspaceIdFromStore(store) {
    return store.location.payload.workspaceId;
}