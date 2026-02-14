/// <reference path="../../../../@types/file-system-access.d.ts" />

import {v4} from 'uuid';
import {without} from 'lodash';

import * as constants from '../../../constants';
import {FileSystemUser, FileMetadata, WebLinkProperties, AnyProperties} from '../../storageContract';
import {FileAPI, OnProgressParams} from '../../storageContract';

const IDB_NAME = 'gTove-LocalStorage';
const IDB_STORE = 'directoryHandles';
const IDB_KEY = 'rootDirectoryHandle';

async function openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
    });
}

async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const request = store.put(handle, IDB_KEY);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        tx.oncomplete = () => db.close();
    });
}

async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openIndexedDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const request = store.get(IDB_KEY);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
            tx.oncomplete = () => db.close();
        });
    } catch {
        return null;
    }
}

async function clearDirectoryHandle(): Promise<void> {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const request = store.delete(IDB_KEY);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        tx.oncomplete = () => db.close();
    });
}

// ============================================================================
// Index file management - tracks all files and their metadata
// ============================================================================

const INDEX_FILE_NAME = '.gtove-index.json';

interface FileIndex {
    version: 1;
    files: {[id: string]: StoredFileMetadata};
    directories: {[id: string]: string[]}; // parentId -> childIds
}

interface StoredFileMetadata extends Omit<FileMetadata, 'owners'> {
    relativePath: string; // Path relative to root directory
    lastModified: number;
}

function createEmptyIndex(): FileIndex {
    return {
        version: 1,
        files: {},
        directories: {}
    };
}

// ============================================================================
// Local File System API State
// ============================================================================

let rootDirectoryHandle: FileSystemDirectoryHandle | null = null;
let fileIndex: FileIndex = createEmptyIndex();
let signInHandler: ((signedIn: boolean) => void) | null = null;
let errorHandler: ((error: Error) => void) | null = null;

// Cache of blob URLs keyed by file ID, so we don't re-read from disk
// or leak blob URLs by creating duplicates. These are used to populate
// the `thumbnailLink` field (named after the Google Drive API convention),
// but they actually point to the full-resolution file content.
const blobUrlCache: {[fileId: string]: string} = {};

const loggedInUserInfo: FileSystemUser = {
    displayName: 'Local User',
    emailAddress: 'local@localhost',
    permissionId: 'local-user',
    offline: true,
    me: true
};

// ============================================================================
// Helper functions
// ============================================================================

async function saveIndex(): Promise<void> {
    if (!rootDirectoryHandle) return;
    
    const indexContent = JSON.stringify(fileIndex, null, 2);
    const indexFileHandle = await rootDirectoryHandle.getFileHandle(INDEX_FILE_NAME, {create: true});
    const writable = await indexFileHandle.createWritable();
    await writable.write(indexContent);
    await writable.close();
}

async function loadIndex(): Promise<void> {
    if (!rootDirectoryHandle) return;
    
    try {
        const indexFileHandle = await rootDirectoryHandle.getFileHandle(INDEX_FILE_NAME);
        const file = await indexFileHandle.getFile();
        const content = await file.text();
        fileIndex = JSON.parse(content);
    } catch (error: any) {
        if (error.name === 'NotFoundError') {
            // Index doesn't exist yet, create empty one
            fileIndex = createEmptyIndex();
            await saveIndex();
        } else {
            throw error;
        }
    }
}

async function getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle> {
    if (!rootDirectoryHandle) {
        throw new Error('Root directory not initialized');
    }
    
    if (!path || path === '/') {
        return rootDirectoryHandle;
    }
    
    const parts = path.split('/').filter(p => p.length > 0);
    let current = rootDirectoryHandle;
    
    for (const part of parts) {
        current = await current.getDirectoryHandle(part, {create: true});
    }
    
    return current;
}

async function writeFile(relativePath: string, content: Blob | string): Promise<void> {
    const parts = relativePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    
    const dirHandle = await getDirectoryHandle(dirPath);
    const fileHandle = await dirHandle.getFileHandle(fileName, {create: true});
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

async function readFile(relativePath: string): Promise<File> {
    const parts = relativePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    
    const dirHandle = await getDirectoryHandle(dirPath);
    const fileHandle = await dirHandle.getFileHandle(fileName);
    return await fileHandle.getFile();
}

async function deleteFileFromDisk(relativePath: string): Promise<void> {
    const parts = relativePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    
    const dirHandle = await getDirectoryHandle(dirPath);
    await dirHandle.removeEntry(fileName);
}

function storedMetadataToFileMetadata(stored: StoredFileMetadata): FileMetadata {
    return {
        ...stored,
        owners: [loggedInUserInfo],
        // Restore cached blob URL if one exists for this file
        thumbnailLink: blobUrlCache[stored.id] || stored.thumbnailLink
    };
}

/**
 * For an image file, return a blob URL pointing to its content on disk.
 * Uses a cache so repeated calls for the same file reuse the same blob URL.
 * Returns undefined for non-image files or if the file can't be read.
 */
async function fetchFileAndGetBlobUrl(stored: StoredFileMetadata): Promise<string | undefined> {
    if (!stored.relativePath || !stored.mimeType || !stored.mimeType.startsWith('image/')) {
        return undefined;
    }
    if (blobUrlCache[stored.id]) {
        return blobUrlCache[stored.id];
    }
    try {
        const file = await readFile(stored.relativePath);
        const url = URL.createObjectURL(file);
        blobUrlCache[stored.id] = url;
        return url;
    } catch {
        return undefined;
    }
}

function generateRelativePath(parentPath: string, name: string, mimeType?: string): string {
    const safeName = name.replace(/[<>:"/\\|?*]/g, '_');
    const basePath = parentPath ? `${parentPath}/${safeName}` : safeName;
    
    // Don't add extension for folders
    if (mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
        return basePath;
    }
    
    return basePath;
}

// ============================================================================
// FileAPI Implementation
// ============================================================================

const localFileSystemAPI: FileAPI = {

    initialiseFileAPI: async (callback, onError) => {
        signInHandler = callback;
        errorHandler = onError;
        
        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            onError(new Error('File System Access API is not supported in this browser. Please use Chrome or Edge.'));
            return;
        }
        
        // Try to restore previously saved directory handle
        const savedHandle = await loadDirectoryHandle();
        if (savedHandle) {
            try {
                // Verify we still have permission
                const permission = await savedHandle.queryPermission({mode: 'readwrite'});
                if (permission === 'granted') {
                    rootDirectoryHandle = savedHandle;
                    await loadIndex();
                    await ensureDefaultFolderStructure();
                    callback(true);
                    return;
                }
                
                // Try to request permission again
                const newPermission = await savedHandle.requestPermission({mode: 'readwrite'});
                if (newPermission === 'granted') {
                    rootDirectoryHandle = savedHandle;
                    await loadIndex();
                    await ensureDefaultFolderStructure();
                    callback(true);
                    return;
                }
            } catch (error) {
                // Handle was invalid or permission denied, clear it
                await clearDirectoryHandle();
            }
        }
        
        // No valid saved handle, user needs to sign in
        callback(false);
    },

    signInToFileAPI: async () => {
        try {
            // Prompt user to select a directory
            const handle = await (window as any).showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });
            
            rootDirectoryHandle = handle;
            
            // Save handle for future sessions
            await saveDirectoryHandle(handle);
            
            // Load or create index
            await loadIndex();
            
            // Create default folder structure if this is a new directory
            await ensureDefaultFolderStructure();
            
            signInHandler?.(true);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // User cancelled the picker
                return;
            }
            errorHandler?.(error);
        }
    },

    signOutFromFileAPI: async () => {
        rootDirectoryHandle = null;
        fileIndex = createEmptyIndex();
        // Revoke all cached blob URLs to free memory
        for (const id of Object.keys(blobUrlCache)) {
            URL.revokeObjectURL(blobUrlCache[id]);
            delete blobUrlCache[id];
        }
        await clearDirectoryHandle();
        signInHandler?.(false);
    },

    getLoggedInUserInfo: (): Promise<FileSystemUser> => {
        return Promise.resolve(loggedInUserInfo);
    },

    loadRootFiles: async (addFilesCallback): Promise<void> => {
        // Find the root folder entry
        const rootFolderId = Object.keys(fileIndex.files).find(id => {
            const file = fileIndex.files[id];
            return file.name === constants.FOLDER_ROOT && 
                   file.mimeType === constants.MIME_TYPE_DRIVE_FOLDER &&
                   (!file.parents || file.parents.length === 0);
        });
        
        if (rootFolderId) {
            const rootFolder = fileIndex.files[rootFolderId];
            addFilesCallback([storedMetadataToFileMetadata(rootFolder)]);
            await localFileSystemAPI.loadFilesInFolder(rootFolderId, addFilesCallback);
        }
    },

    loadFilesInFolder: async (id: string, addFilesCallback): Promise<void> => {
        const childIds = fileIndex.directories[id] || [];
        const storedFiles = childIds
            .map(childId => fileIndex.files[childId])
            .filter(Boolean);

        const children: FileMetadata[] = [];
        for (const stored of storedFiles) {
            const metadata = storedMetadataToFileMetadata(stored);
            metadata.thumbnailLink = await fetchFileAndGetBlobUrl(stored);
            children.push(metadata);
        }
        
        if (children.length > 0) {
            addFilesCallback(children);
        }
    },

    getFullMetadata: async (id: string): Promise<FileMetadata> => {
        const stored = fileIndex.files[id];
        if (!stored) {
            throw new Error(`File not found: ${id}`);
        }
        const metadata = storedMetadataToFileMetadata(stored);
        metadata.thumbnailLink = await fetchFileAndGetBlobUrl(stored);
        return metadata;
    },

    getFileModifiedTime: async (id: string): Promise<number> => {
        const stored = fileIndex.files[id];
        if (!stored) {
            throw new Error(`File not found: ${id}`);
        }
        
        // Try to get actual file modification time
        try {
            const file = await readFile(stored.relativePath);
            return file.lastModified;
        } catch {
            return stored.lastModified || Date.now();
        }
    },

    createFolder: async (folderName: string, metadata?: Partial<FileMetadata>): Promise<FileMetadata> => {
        const id = metadata?.id || v4();
        const parentId = metadata?.parents?.[0];
        const parentPath = parentId ? fileIndex.files[parentId]?.relativePath || '' : '';
        const relativePath = generateRelativePath(parentPath, folderName, constants.MIME_TYPE_DRIVE_FOLDER);
        
        // Create the actual directory
        await getDirectoryHandle(relativePath);
        
        const stored: StoredFileMetadata = {
            id,
            name: folderName,
            trashed: false,
            parents: metadata?.parents || [],
            mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
            relativePath,
            lastModified: Date.now(),
            appProperties: metadata?.appProperties,
            properties: metadata?.properties
        };
        
        fileIndex.files[id] = stored;
        
        // Update parent's children list
        if (parentId) {
            fileIndex.directories[parentId] = fileIndex.directories[parentId] || [];
            if (!fileIndex.directories[parentId].includes(id)) {
                fileIndex.directories[parentId].push(id);
            }
        }
        
        await saveIndex();
        
        return storedMetadataToFileMetadata(stored);
    },

    uploadFile: async (
        fileSystemMetadata: Partial<FileMetadata>,
        file: Blob,
        onProgress?: (progress: OnProgressParams) => void
    ): Promise<FileMetadata> => {
        const id = fileSystemMetadata.id || v4();
        const parentId = fileSystemMetadata.parents?.[0];
        const parentPath = parentId ? fileIndex.files[parentId]?.relativePath || '' : '';
        const name = fileSystemMetadata.name || `file-${id}`;
        const relativePath = generateRelativePath(parentPath, name, file.type);
        
        // Write the file to disk
        await writeFile(relativePath, file);
        
        const stored: StoredFileMetadata = {
            id,
            name,
            trashed: false,
            parents: fileSystemMetadata.parents || [],
            mimeType: file.type || fileSystemMetadata.mimeType,
            relativePath,
            lastModified: Date.now(),
            appProperties: fileSystemMetadata.appProperties,
            properties: fileSystemMetadata.properties as AnyProperties
        };
        
        fileIndex.files[id] = stored;
        
        // Update parent's children list
        if (parentId) {
            fileIndex.directories[parentId] = fileIndex.directories[parentId] || [];
            if (!fileIndex.directories[parentId].includes(id)) {
                fileIndex.directories[parentId].push(id);
            }
        }
        
        await saveIndex();
        
        onProgress?.({loaded: file.size, total: file.size});
        
        return storedMetadataToFileMetadata(stored);
    },

    saveJsonToFile: async (idOrMetadata: string | Partial<FileMetadata>, json: object): Promise<FileMetadata> => {
        const metadata = typeof idOrMetadata === 'string' ? {id: idOrMetadata} : idOrMetadata;
        const id = metadata.id || v4();
        
        // If updating existing file, use its path
        const existing = fileIndex.files[id];
        let relativePath: string;
        
        if (existing) {
            relativePath = existing.relativePath;
        } else {
            const parentId = metadata.parents?.[0];
            const parentPath = parentId ? fileIndex.files[parentId]?.relativePath || '' : '';
            const name = metadata.name || `${id}.json`;
            relativePath = generateRelativePath(parentPath, name, constants.MIME_TYPE_JSON);
            if (!relativePath.endsWith('.json')) {
                relativePath += '.json';
            }
        }
        
        // Write JSON to disk
        const content = JSON.stringify(json, null, 2);
        await writeFile(relativePath, content);
        
        const stored: StoredFileMetadata = {
            ...existing,
            id,
            name: metadata.name || existing?.name || `${id}.json`,
            trashed: false,
            parents: metadata.parents || existing?.parents || [],
            mimeType: constants.MIME_TYPE_JSON,
            relativePath,
            lastModified: Date.now(),
            appProperties: metadata.appProperties || existing?.appProperties,
            properties: (metadata.properties || existing?.properties) as AnyProperties
        };
        
        fileIndex.files[id] = stored;
        
        // Update parent's children list for new files
        const parentId = stored.parents[0];
        if (parentId && !existing) {
            fileIndex.directories[parentId] = fileIndex.directories[parentId] || [];
            if (!fileIndex.directories[parentId].includes(id)) {
                fileIndex.directories[parentId].push(id);
            }
        }
        
        await saveIndex();
        
        return storedMetadataToFileMetadata(stored);
    },

    uploadFileMetadata: async (
        fileSystemMetadata: Partial<FileMetadata>,
        addParents?: string[],
        removeParents?: string[]
    ): Promise<FileMetadata> => {
        const id = fileSystemMetadata.id || v4();
        const existing = fileIndex.files[id];
        
        let parents = fileSystemMetadata.parents || existing?.parents || [];
        
        if (addParents) {
            parents = [...parents, ...addParents];
        }
        if (removeParents) {
            parents = without(parents, ...removeParents);
        }
        
        const stored: StoredFileMetadata = {
            ...existing,
            id,
            name: fileSystemMetadata.name || existing?.name || '',
            trashed: fileSystemMetadata.trashed ?? existing?.trashed ?? false,
            parents,
            mimeType: fileSystemMetadata.mimeType || existing?.mimeType,
            relativePath: existing?.relativePath || '',
            lastModified: Date.now(),
            appProperties: fileSystemMetadata.appProperties || existing?.appProperties,
            properties: (fileSystemMetadata.properties || existing?.properties) as AnyProperties
        };
        
        fileIndex.files[id] = stored;
        
        // Update directory listings
        if (removeParents) {
            for (const parentId of removeParents) {
                if (fileIndex.directories[parentId]) {
                    fileIndex.directories[parentId] = fileIndex.directories[parentId].filter(childId => childId !== id);
                }
            }
        }
        if (addParents) {
            for (const parentId of addParents) {
                fileIndex.directories[parentId] = fileIndex.directories[parentId] || [];
                if (!fileIndex.directories[parentId].includes(id)) {
                    fileIndex.directories[parentId].push(id);
                }
            }
        }
        
        await saveIndex();
        
        return storedMetadataToFileMetadata(stored);
    },

    createShortcut: async (
        originalFile: Partial<FileMetadata> & {id: string},
        newParents: string[]
    ): Promise<FileMetadata> => {
        // For local storage, we just add the file to additional parents (virtual shortcut)
        const existing = fileIndex.files[originalFile.id];
        if (!existing) {
            throw new Error(`Original file not found: ${originalFile.id}`);
        }
        
        const updatedParents = [...(existing.parents || []), ...newParents];
        
        const stored: StoredFileMetadata = {
            ...existing,
            parents: updatedParents
        };
        
        fileIndex.files[originalFile.id] = stored;
        
        // Update directory listings
        for (const parentId of newParents) {
            fileIndex.directories[parentId] = fileIndex.directories[parentId] || [];
            if (!fileIndex.directories[parentId].includes(originalFile.id)) {
                fileIndex.directories[parentId].push(originalFile.id);
            }
        }
        
        await saveIndex();
        
        return storedMetadataToFileMetadata(stored);
    },

    getFileContents: async (fileSystemMetadata: Partial<FileMetadata>): Promise<Blob> => {
        if (!fileSystemMetadata.id) {
            throw new Error('Cannot get file contents without metadata ID');
        }
        
        // Check for web link (external resource)
        const webLink = (fileSystemMetadata.properties as WebLinkProperties)?.webLink;
        if (webLink) {
            const response = await fetch(webLink);
            return await response.blob();
        }
        
        const stored = fileIndex.files[fileSystemMetadata.id];
        if (!stored) {
            throw new Error(`File not found: ${fileSystemMetadata.id}`);
        }
        
        const file = await readFile(stored.relativePath);
        return file;
    },

    getJsonFileContents: async (fileSystemMetadata: Partial<FileMetadata>): Promise<any> => {
        if (!fileSystemMetadata.id) {
            throw new Error('Cannot get JSON without metadata ID');
        }
        
        const stored = fileIndex.files[fileSystemMetadata.id];
        if (!stored) {
            throw new Error(`File not found: ${fileSystemMetadata.id}`);
        }
        
        const file = await readFile(stored.relativePath);
        const text = await file.text();
        return JSON.parse(text);
    },

    makeFileReadableToAll: (): Promise<void> => {
        // No-op for local storage - files are already accessible
        return Promise.resolve();
    },

    findFilesWithAppProperty: (key: string, value: string): Promise<FileMetadata[]> => {
        const results = Object.values(fileIndex.files)
            .filter(file => file.appProperties && (file.appProperties as any)[key] === value)
            .map(storedMetadataToFileMetadata);
        return Promise.resolve(results);
    },

    findFilesWithProperty: (key: string, value: string): Promise<FileMetadata[]> => {
        const results = Object.values(fileIndex.files)
            .filter(file => {
                return file.properties && (file.properties as any)[key] === value;
            })
            .map(storedMetadataToFileMetadata);
        return Promise.resolve(results);
    },

    findFilesContainingNameWithProperty: (name: string, key: string, value: string): Promise<FileMetadata[]> => {
        const lowerName = name.toLowerCase();
        const results = Object.values(fileIndex.files)
            .filter(file => {
                return file.name.toLowerCase().includes(lowerName) &&
                       file.properties && (file.properties as any)[key] === value;
            })
            .map(storedMetadataToFileMetadata);
        return Promise.resolve(results);
    },

    deleteFile: async (fileSystemMetadata: Partial<FileMetadata>): Promise<void> => {
        if (!fileSystemMetadata.id) {
            return;
        }
        
        const stored = fileIndex.files[fileSystemMetadata.id];
        if (!stored) {
            return;
        }
        
        // Try to delete the actual file
        try {
            if (stored.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
                // For folders, we'd need to recursively delete - for now just remove from index
            } else {
                await deleteFileFromDisk(stored.relativePath);
            }
        } catch (error) {
            console.warn('Could not delete file from disk:', error);
        }
        
        // Revoke and remove cached blob URL
        if (blobUrlCache[fileSystemMetadata.id]) {
            URL.revokeObjectURL(blobUrlCache[fileSystemMetadata.id]);
            delete blobUrlCache[fileSystemMetadata.id];
        }
        
        // Remove from index
        delete fileIndex.files[fileSystemMetadata.id];
        
        // Remove from parent directories
        for (const parentId of stored.parents || []) {
            if (fileIndex.directories[parentId]) {
                fileIndex.directories[parentId] = fileIndex.directories[parentId]
                    .filter(id => id !== fileSystemMetadata.id);
            }
        }
        
        // Remove directory listing
        delete fileIndex.directories[fileSystemMetadata.id];
        
        await saveIndex();
    }
};

// ============================================================================
// Helper to set up default folder structure
// ============================================================================

async function ensureDefaultFolderStructure(): Promise<void> {
    // Check if root folder exists
    const existingRoot = Object.values(fileIndex.files).find(
        f => f.name === constants.FOLDER_ROOT && 
             f.mimeType === constants.MIME_TYPE_DRIVE_FOLDER &&
             (!f.parents || f.parents.length === 0)
    );
    
    if (existingRoot) {
        return; // Already set up
    }
    
    // Create root folder
    const rootFolder = await localFileSystemAPI.createFolder(constants.FOLDER_ROOT, {
        appProperties: {
            rootFolder: 'true',
            dataVersion: '1'
        } as any
    });
    
    // Create top-level subfolders
    for (const folderName of constants.topLevelFolders) {
        await localFileSystemAPI.createFolder(folderName, {
            parents: [rootFolder.id]
        });
    }
}

export default localFileSystemAPI;
