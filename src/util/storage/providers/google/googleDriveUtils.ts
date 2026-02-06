import {FileSystemUser} from '../../storageContract';

export interface DriveFileOwner {
    kind: 'drive#user';
    displayName: string;
    photoLink: string;
    me: boolean;
    permissionId: string;
    emailAddress: string;
}

export interface DriveUser {
    displayName: string;
    emailAddress: string;
    permissionId: string;
    photoLink?: string;
    icon?: string;
}


export function driveUserToFileSystemUser(driveUser: DriveUser): FileSystemUser {
    return {
        displayName: driveUser.displayName,
        emailAddress: driveUser.emailAddress,
        permissionId: driveUser.permissionId,
        photoLink: driveUser.photoLink,
        icon: driveUser.icon,
        offline: false
    };
}
