import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {NetworkedAction} from '../util/types';

export enum LoggedInUserActionTypes {
    SET_LOGGED_IN_USER = 'set-logged-in-user'
}

export type LoggedInUserReducerType = DriveUser | null;

export interface SetLoggedInUserActionType extends NetworkedAction {
    type: LoggedInUserActionTypes.SET_LOGGED_IN_USER;
    user: LoggedInUserReducerType;
}