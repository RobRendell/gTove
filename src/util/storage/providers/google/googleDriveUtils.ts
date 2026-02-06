import { AnyAppProperties, AnyProperties, FileMetadata, FileSystemUser } from "../../storageContract";

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
    offline?: boolean;
}


export function driveUserToFileSystemUser(driveUser: DriveUser): FileSystemUser {
    return {
        displayName: driveUser.displayName,
        emailAddress: driveUser.emailAddress,
        permissionId: driveUser.permissionId,
        photoLink: driveUser.photoLink,
        icon: driveUser.icon,
        offline: driveUser.offline
    };
}

export function fileSystemUserToDriveUser(fileSystemUser: FileSystemUser): DriveUser {
    return {
        displayName: fileSystemUser.displayName,
        emailAddress: fileSystemUser.emailAddress,
        permissionId: fileSystemUser.permissionId,
        photoLink: fileSystemUser.photoLink,
        icon: fileSystemUser.icon,
        offline: fileSystemUser.offline
    };
}

export function driveMetadataToFileSystemMetadata<T = AnyAppProperties, U = AnyProperties>(
    driveMetadata: Partial<FileMetadata<T, U>>
): Partial<FileMetadata> {
    return {
        id: driveMetadata.id,
        name: driveMetadata.name,
        trashed: driveMetadata.trashed,
        parents: driveMetadata.parents,
        mimeType: driveMetadata.mimeType,
        thumbnailLink: driveMetadata.thumbnailLink,
        owners: driveMetadata.owners?.map(driveUserToFileSystemUser),

        // Map Google Drive specific properties to abstracted ones
        appData: driveMetadata.appProperties ?
            (typeof driveMetadata.appProperties === 'object' ? driveMetadata.appProperties : undefined) :
            undefined,
        customProperties: driveMetadata.properties ?
            (typeof driveMetadata.properties === 'object' ? driveMetadata.properties : undefined) :
            undefined,

        // Store Google Drive specific fields for round-trip conversion
        _driveResourceKey: driveMetadata.resourceKey
    } as FileMetadata & {_driveResourceKey?: string};
}