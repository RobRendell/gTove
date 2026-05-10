import {v4} from 'uuid';

import * as constants from '../../../constants';
import {
    AnyAppProperties,
    AnyProperties,
    FileAPI,
    FileMetadata,
    FileSystemUser,
    OnProgressParams,
    WebLinkProperties
} from '../../storageContract';

// ============================================================================
// Persisted directory handle (IndexedDB)
// ============================================================================

// Provide more explicit (locally-scoped) types for experimental features
interface FileSystemAccessWindow extends Window {
    showDirectoryPicker(options?: any): Promise<FileSystemAccessDirectoryHandle>;
}
interface FileSystemAccessDirectoryHandle extends FileSystemDirectoryHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}
interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
}

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

async function saveDirectoryHandle(handle: FileSystemAccessDirectoryHandle): Promise<void> {
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

async function loadDirectoryHandle(): Promise<FileSystemAccessDirectoryHandle | null> {
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
// Sidecar layout
// ============================================================================
//
// Every folder (including the root, which is the directory the user picked)
// contains a `_folder.data.json` describing its identity. Every binary asset
// (images, PDFs, video) sits next to a sibling `<filename>.data.json`. JSON
// assets (scenarios, tabletops, bundles, templates, web-links) embed their
// metadata under a `_gtoveMeta` key at the top of the file itself.
//
// On disk:
//   <picked dir>/
//     _folder.data.json                          (root identity)
//     Maps/
//       _folder.data.json                        (Maps folder identity)
//       castle.png
//       castle.png.data.json                     (sidecar for castle.png)
//       SomeSubfolder/
//         _folder.data.json
//         ...
//     Scenarios/
//       _folder.data.json
//       Battle of the Pass.json                  (envelope inside)
//     ...
//
// Folder sidecars are intentionally minimal: just the stable GUID and an
// optional `properties` payload (the only consumer today is bundle-extraction
// flows attaching `fromBundleId` to a folder). Everything else about a folder
// - its name, parent, children - is derived from the file system at scan
// time, and `appProperties` (e.g. Drive's `rootFolder`/`dataVersion` markers)
// are not needed locally because `rootDirectoryHandle` *is* the root.
//
// Asset sidecars and JSON envelopes carry richer data:
//   - id: stable GUID
//   - mimeType, appProperties, properties
//
// The directory and file names on disk are authoritative for navigation; the
// sidecar `name` field is descriptive only.
//
// Shortcuts ("virtual links" between files) are deliberately *not* supported
// by this provider - the `FileAPI.supportsShortcuts` capability flag is set
// to `false` and any caller invoking `createShortcut` will get a clear error.
// See `FileAPI.supportsShortcuts` in `storageContract.ts` for the rationale.

const FOLDER_SIDECAR_NAME = '_folder.data.json';
const SIDECAR_SUFFIX = '.data.json';
const RESERVED_NAME_PREFIX = '_folder';
const ENVELOPE_KEY = '_gtoveMeta';
const MAX_SCAN_DEPTH = 16;

// Folder sidecars exist purely to anchor a stable GUID to a physical directory
// across rescans. Anything else (display name, app-properties) is either
// implicit in the file system or unused locally. We keep `properties` as an
// optional escape hatch because bundle-extraction flows attach `fromBundleId`
// to the folder they create (see `gTove.tsx#createImageShortcutFromDrive`).
interface FolderSidecarData {
    id: string;
    properties?: AnyProperties;
}

interface AssetSidecarData {
    id: string;
    name?: string;
    mimeType?: string;
    appProperties?: AnyAppProperties;
    properties?: AnyProperties;
}

interface JsonEnvelope {
    id: string;
    name?: string;
    mimeType?: string;
    appProperties?: AnyAppProperties;
    properties?: AnyProperties;
}

interface JsonNativeFile {
    [ENVELOPE_KEY]: JsonEnvelope;
    content: any;
}

type EntryKind = 'folder' | 'json' | 'binary';

// ============================================================================
// Module state
// ============================================================================

let rootDirectoryHandle: FileSystemDirectoryHandle | null = null;
let signInHandler: ((signedIn: boolean) => void) | null = null;
let errorHandler: ((error: Error) => void) | null = null;

let syntheticRootId: string | null = null;

// All metadata known to the app (real assets and folders).
const metadataById = new Map<string, FileMetadata>();
// Real on-disk path (relative to root) for every folder and asset id.
const pathByOwnedId = new Map<string, string>();
// Ordered child ids per folder id.
const childrenByFolderId = new Map<string, string[]>();
// Single parent per id.
const parentByChildId = new Map<string, string>();

// Cache of blob URLs keyed by file id, used to populate `thumbnailLink`. They
// actually point to full-resolution content; a thumbnail-scaling pass can be
// layered on later without changing the contract.
const blobUrlCache: {[fileId: string]: string} = {};

// Local FS is single-player. The owner returned in metadata is always the
// signed-in GM; we keep this as a placeholder rather than reading any real
// account info from the browser.
let loggedInUserInfo: FileSystemUser = {
    displayName: 'Local GM',
    emailAddress: 'local@localhost',
    permissionId: 'local-user',
    offline: true,
    me: true
};

// Errors detected during scanning that should keep the app from operating.
let fatalScanError: Error | null = null;

// ============================================================================
// Path / name helpers
// ============================================================================

function joinPath(parent: string, name: string): string {
    return parent ? `${parent}/${name}` : name;
}

function splitPathLast(relativePath: string): {dir: string; name: string} {
    const idx = relativePath.lastIndexOf('/');
    if (idx < 0) {
        return {dir: '', name: relativePath};
    }
    return {dir: relativePath.slice(0, idx), name: relativePath.slice(idx + 1)};
}

function sanitiseFsName(name: string): string {
    // Strip characters that most filesystems reject. The picked directory is
    // user-owned, so we keep names readable rather than mangling them further.
    // eslint-disable-next-line no-control-regex
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'untitled';
}

function isReservedName(name: string): boolean {
    if (name === FOLDER_SIDECAR_NAME) {
        return true;
    }
    if (name.endsWith(SIDECAR_SUFFIX)) {
        return true;
    }
    if (name === RESERVED_NAME_PREFIX || name.startsWith(`${RESERVED_NAME_PREFIX}.`)) {
        return true;
    }
    return false;
}

async function navigateToDirectory(relativePath: string): Promise<FileSystemDirectoryHandle> {
    if (!rootDirectoryHandle) {
        throw new Error('Local file system not initialised');
    }
    if (!relativePath) {
        return rootDirectoryHandle;
    }
    let current = rootDirectoryHandle;
    for (const part of relativePath.split('/').filter(Boolean)) {
        current = await current.getDirectoryHandle(part);
    }
    return current;
}

async function childExists(parentDir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
    try {
        await parentDir.getFileHandle(name);
        return true;
    } catch {
        // not a file
    }
    try {
        await parentDir.getDirectoryHandle(name);
        return true;
    } catch {
        // not a directory either
    }
    return false;
}

async function ensureUniqueChildName(
    parentDir: FileSystemDirectoryHandle,
    desiredName: string,
    options: {reserveSidecar?: boolean} = {}
): Promise<string> {
    const {reserveSidecar = false} = options;
    const dotIndex = desiredName.lastIndexOf('.');
    const hasExt = dotIndex > 0;
    const base = hasExt ? desiredName.slice(0, dotIndex) : desiredName;
    const ext = hasExt ? desiredName.slice(dotIndex) : '';
    let candidate = desiredName;
    let counter = 1;
    while (true) {
        const taken = await childExists(parentDir, candidate)
            || (reserveSidecar && await childExists(parentDir, `${candidate}${SIDECAR_SUFFIX}`));
        if (!taken) {
            return candidate;
        }
        counter++;
        candidate = `${base} (${counter})${ext}`;
    }
}

// ============================================================================
// Sidecar / envelope read & write
// ============================================================================

async function readJsonFile<T>(handle: FileSystemFileHandle): Promise<T> {
    const file = await handle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
}

async function writeJsonHandle(handle: FileSystemFileHandle, data: unknown): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
}

async function writeFolderSidecar(folderHandle: FileSystemDirectoryHandle, data: FolderSidecarData): Promise<void> {
    const handle = await folderHandle.getFileHandle(FOLDER_SIDECAR_NAME, {create: true});
    await writeJsonHandle(handle, data);
}

async function writeAssetSidecar(
    folderHandle: FileSystemDirectoryHandle,
    assetName: string,
    data: AssetSidecarData
): Promise<void> {
    const handle = await folderHandle.getFileHandle(`${assetName}${SIDECAR_SUFFIX}`, {create: true});
    await writeJsonHandle(handle, data);
}

async function writeJsonNativeFile(
    folderHandle: FileSystemDirectoryHandle,
    fileName: string,
    envelope: JsonEnvelope,
    content: any
): Promise<void> {
    const handle = await folderHandle.getFileHandle(fileName, {create: true});
    const payload: JsonNativeFile = {[ENVELOPE_KEY]: envelope, content};
    await writeJsonHandle(handle, payload);
}

// ============================================================================
// Hydration
// ============================================================================

/**
 * Build a fresh `FileMetadata` for handing back to the rest of the app: the
 * stored entry, with `owners` filled in and a thumbnail blob URL attached for
 * images that have not been read yet.
 */
async function hydrateMetadata(meta: FileMetadata): Promise<FileMetadata> {
    const hydrated: FileMetadata = {
        ...meta,
        owners: [loggedInUserInfo]
    };
    const isImage = meta.mimeType?.startsWith('image/');
    if (isImage) {
        hydrated.thumbnailLink = await getOrCreateThumbnailUrl(meta.id);
    }
    return hydrated;
}

async function getOrCreateThumbnailUrl(id: string): Promise<string | undefined> {
    if (blobUrlCache[id]) {
        return blobUrlCache[id];
    }
    const path = pathByOwnedId.get(id);
    if (!path) {
        return undefined;
    }
    try {
        const {dir, name} = splitPathLast(path);
        const folderHandle = await navigateToDirectory(dir);
        const fileHandle = await folderHandle.getFileHandle(name);
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        blobUrlCache[id] = url;
        return url;
    } catch {
        return undefined;
    }
}

function classifyEntry(meta: FileMetadata): EntryKind {
    if (meta.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
        return 'folder';
    }
    const path = pathByOwnedId.get(meta.id) || '';
    return path.endsWith('.json') ? 'json' : 'binary';
}

/**
 * Re-write the on-disk metadata for `id` so it reflects current in-memory state
 * (sidecar for binary assets, envelope for JSON-native files, `_folder.data.json`
 * for folders). Used after metadata-only mutations.
 */
async function persistMetadataFor(id: string): Promise<void> {
    const meta = metadataById.get(id);
    if (!meta) {
        return;
    }
    const path = pathByOwnedId.get(id);
    if (path === undefined) {
        return;
    }
    const kind = classifyEntry(meta);
    if (kind === 'folder') {
        const folderHandle = await navigateToDirectory(path);
        await writeFolderSidecar(folderHandle, {
            id,
            properties: meta.properties
        });
    } else if (kind === 'binary') {
        const {dir, name} = splitPathLast(path);
        const parentDir = await navigateToDirectory(dir);
        await writeAssetSidecar(parentDir, name, {
            id,
            name,
            mimeType: meta.mimeType,
            appProperties: meta.appProperties,
            properties: meta.properties
        });
    } else if (kind === 'json') {
        const {dir, name} = splitPathLast(path);
        const parentDir = await navigateToDirectory(dir);
        const fileHandle = await parentDir.getFileHandle(name);
        let body: any = {};
        try {
            const parsed = await readJsonFile<JsonNativeFile>(fileHandle);
            body = parsed?.content ?? {};
        } catch {
            // Existing file is unreadable; fall back to an empty body.
        }
        await writeJsonNativeFile(parentDir, name, {
            id,
            name,
            mimeType: meta.mimeType,
            appProperties: meta.appProperties,
            properties: meta.properties
        }, body);
    }
}

// ============================================================================
// Scan engine
// ============================================================================

function resetIndexes(): void {
    metadataById.clear();
    pathByOwnedId.clear();
    childrenByFolderId.clear();
    parentByChildId.clear();
    syntheticRootId = null;
    fatalScanError = null;
}

function revokeAllBlobUrls(): void {
    for (const id of Object.keys(blobUrlCache)) {
        URL.revokeObjectURL(blobUrlCache[id]);
        delete blobUrlCache[id];
    }
}

async function scanFromRoot(): Promise<void> {
    if (!rootDirectoryHandle) {
        throw new Error('Local file system not initialised');
    }
    resetIndexes();
    revokeAllBlobUrls();

    const rootId = await ensureRootFolderSidecar();
    syntheticRootId = rootId;

    for (const topName of constants.topLevelFolders) {
        const topHandle = await rootDirectoryHandle.getDirectoryHandle(topName, {create: true});
        const topMeta = await ensureFolderSidecarFor(topHandle, topName, rootId, topName);
        if (!topMeta) {
            continue;
        }
        await walkFolder(topHandle, topName, topMeta.id, 1);
        if (fatalScanError) {
            throw fatalScanError;
        }
    }
}

async function ensureRootFolderSidecar(): Promise<string> {
    if (!rootDirectoryHandle) {
        throw new Error('No root directory');
    }
    let id: string;
    let properties: AnyProperties | undefined;
    let sidecarHandle: FileSystemFileHandle | null;
    try {
        sidecarHandle = await rootDirectoryHandle.getFileHandle(FOLDER_SIDECAR_NAME);
    } catch {
        sidecarHandle = null;
    }
    if (sidecarHandle) {
        try {
            const parsed = await readJsonFile<FolderSidecarData>(sidecarHandle);
            if (!parsed.id) {
                throw new Error('Root sidecar is missing id');
            }
            id = parsed.id;
            properties = parsed.properties;
        } catch (error) {
            console.warn('Could not parse root folder sidecar; recreating it.', error);
            id = v4();
            await writeFolderSidecar(rootDirectoryHandle, {id});
        }
    } else {
        id = v4();
        await writeFolderSidecar(rootDirectoryHandle, {id});
    }
    metadataById.set(id, {
        id,
        name: constants.FOLDER_ROOT,
        trashed: false,
        parents: [],
        mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
        properties
    });
    pathByOwnedId.set(id, '');
    childrenByFolderId.set(id, []);
    return id;
}

async function ensureFolderSidecarFor(
    folderHandle: FileSystemDirectoryHandle,
    relativePath: string,
    parentId: string,
    displayName: string
): Promise<FileMetadata | null> {
    let id: string;
    let properties: AnyProperties | undefined;
    let sidecarHandle: FileSystemFileHandle | null;
    try {
        sidecarHandle = await folderHandle.getFileHandle(FOLDER_SIDECAR_NAME);
    } catch {
        sidecarHandle = null;
    }
    if (sidecarHandle) {
        try {
            const parsed = await readJsonFile<FolderSidecarData>(sidecarHandle);
            if (!parsed.id) {
                throw new Error(`Folder sidecar at "${relativePath}" is missing id`);
            }
            id = parsed.id;
            properties = parsed.properties;
        } catch (error) {
            console.warn(`Could not parse folder sidecar at "${relativePath}"; skipping subtree.`, error);
            return null;
        }
    } else {
        id = v4();
        await writeFolderSidecar(folderHandle, {id});
    }
    if (metadataById.has(id)) {
        console.warn(`Duplicate folder GUID ${id} at "${relativePath}"; keeping first occurrence.`);
        return null;
    }
    if (parentByChildId.has(id)) {
        fatalScanError = new Error(`Folder ${id} is referenced by two parents (already at "${pathByOwnedId.get(id)}", now at "${relativePath}").`);
        return null;
    }
    const meta: FileMetadata = {
        id,
        name: displayName,
        trashed: false,
        parents: [parentId],
        mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
        properties
    };
    metadataById.set(id, meta);
    pathByOwnedId.set(id, relativePath);
    childrenByFolderId.set(id, []);
    parentByChildId.set(id, parentId);
    childrenByFolderId.get(parentId)!.push(id);
    return meta;
}

async function walkFolder(
    folderHandle: FileSystemDirectoryHandle,
    relativePath: string,
    folderId: string,
    depth: number
): Promise<void> {
    if (depth > MAX_SCAN_DEPTH) {
        console.warn(`Skipping descent into "${relativePath}" - exceeds max depth ${MAX_SCAN_DEPTH}.`);
        return;
    }

    const fileEntries: {name: string; handle: FileSystemFileHandle}[] = [];
    const dirEntries: {name: string; handle: FileSystemDirectoryHandle}[] = [];
    for await (const entry of (folderHandle as any).values() as AsyncIterable<FileSystemHandle>) {
        // Symlinks are not exposed by File System Access API; treat unknown
        // kinds defensively by simply ignoring them.
        if (entry.kind === 'file') {
            fileEntries.push({name: entry.name, handle: entry as FileSystemFileHandle});
        } else if (entry.kind === 'directory') {
            dirEntries.push({name: entry.name, handle: entry as FileSystemDirectoryHandle});
        }
    }

    const sidecarsByBaseName = new Map<string, FileSystemFileHandle>();
    for (const fe of fileEntries) {
        if (fe.name === FOLDER_SIDECAR_NAME) {
            continue;
        }
        if (fe.name.endsWith(SIDECAR_SUFFIX)) {
            sidecarsByBaseName.set(fe.name.slice(0, -SIDECAR_SUFFIX.length), fe.handle);
        }
    }

    for (const de of dirEntries) {
        if (de.name === RESERVED_NAME_PREFIX || de.name.startsWith(`${RESERVED_NAME_PREFIX}.`)) {
            console.warn(`Skipping reserved-name folder "${joinPath(relativePath, de.name)}".`);
            continue;
        }
        const subPath = joinPath(relativePath, de.name);
        const subMeta = await ensureFolderSidecarFor(de.handle, subPath, folderId, de.name);
        if (fatalScanError) {
            return;
        }
        if (!subMeta) {
            continue;
        }
        await walkFolder(de.handle, subPath, subMeta.id, depth + 1);
        if (fatalScanError) {
            return;
        }
    }

    for (const fe of fileEntries) {
        if (fe.name === FOLDER_SIDECAR_NAME || fe.name.endsWith(SIDECAR_SUFFIX)) {
            continue;
        }
        if (isReservedName(fe.name)) {
            console.warn(`Skipping reserved-name file "${joinPath(relativePath, fe.name)}".`);
            continue;
        }
        const filePath = joinPath(relativePath, fe.name);
        if (fe.name.endsWith('.json')) {
            await registerJsonNativeAsset(fe.handle, fe.name, filePath, folderId);
        } else {
            const sidecar = sidecarsByBaseName.get(fe.name);
            if (!sidecar) {
                console.warn(`Asset "${filePath}" has no sidecar; skipping.`);
                continue;
            }
            sidecarsByBaseName.delete(fe.name);
            await registerBinaryAsset(fe.handle, sidecar, fe.name, filePath, folderId);
        }
    }

    for (const orphan of sidecarsByBaseName.keys()) {
        console.warn(`Orphan sidecar "${joinPath(relativePath, orphan)}${SIDECAR_SUFFIX}" has no matching asset; skipping.`);
    }
}

async function registerJsonNativeAsset(
    fileHandle: FileSystemFileHandle,
    fileName: string,
    filePath: string,
    folderId: string
): Promise<void> {
    let parsed: JsonNativeFile;
    try {
        parsed = await readJsonFile<JsonNativeFile>(fileHandle);
    } catch (error) {
        console.warn(`Could not parse JSON file "${filePath}"; skipping.`, error);
        return;
    }
    const envelope = parsed?.[ENVELOPE_KEY];
    if (!envelope || !envelope.id) {
        console.warn(`JSON file "${filePath}" has no ${ENVELOPE_KEY} envelope with id; skipping.`);
        return;
    }
    if (metadataById.has(envelope.id)) {
        console.warn(`Duplicate GUID ${envelope.id} at "${filePath}"; keeping first occurrence.`);
        return;
    }
    const meta: FileMetadata = {
        id: envelope.id,
        name: fileName,
        trashed: false,
        parents: [folderId],
        mimeType: envelope.mimeType ?? constants.MIME_TYPE_JSON,
        appProperties: envelope.appProperties,
        properties: envelope.properties
    };
    metadataById.set(meta.id, meta);
    pathByOwnedId.set(meta.id, filePath);
    parentByChildId.set(meta.id, folderId);
    childrenByFolderId.get(folderId)!.push(meta.id);
}

async function registerBinaryAsset(
    fileHandle: FileSystemFileHandle,
    sidecarHandle: FileSystemFileHandle,
    fileName: string,
    filePath: string,
    folderId: string
): Promise<void> {
    let sidecar: AssetSidecarData;
    try {
        sidecar = await readJsonFile<AssetSidecarData>(sidecarHandle);
    } catch (error) {
        console.warn(`Could not parse sidecar for "${filePath}"; skipping.`, error);
        return;
    }
    if (!sidecar.id) {
        console.warn(`Sidecar for "${filePath}" missing id; skipping.`);
        return;
    }
    if (metadataById.has(sidecar.id)) {
        console.warn(`Duplicate GUID ${sidecar.id} at "${filePath}"; keeping first occurrence.`);
        return;
    }
    let mimeType = sidecar.mimeType;
    if (!mimeType) {
        try {
            mimeType = (await fileHandle.getFile()).type;
        } catch {
            mimeType = '';
        }
    }
    const meta: FileMetadata = {
        id: sidecar.id,
        name: fileName,
        trashed: false,
        parents: [folderId],
        mimeType,
        appProperties: sidecar.appProperties,
        properties: sidecar.properties
    };
    metadataById.set(meta.id, meta);
    pathByOwnedId.set(meta.id, filePath);
    parentByChildId.set(meta.id, folderId);
    childrenByFolderId.get(folderId)!.push(meta.id);
}

// ============================================================================
// Mutation helpers (renames, moves, cascade deletes)
// ============================================================================

async function moveHandle(
    handle: FileSystemHandle,
    newParent: FileSystemDirectoryHandle,
    newName: string
): Promise<void> {
    // `move` is implemented in Chromium-based browsers; fall back to throwing
    // so callers can surface a clear error if the user is on a runtime without it.
    const moveFn = (handle as any).move as undefined | ((parent: FileSystemDirectoryHandle, name: string) => Promise<void>);
    if (typeof moveFn !== 'function') {
        throw new Error('Renaming/moving is not supported in this browser.');
    }
    await moveFn.call(handle, newParent, newName);
}

async function renameHandle(handle: FileSystemHandle, newName: string): Promise<void> {
    const moveFn = (handle as any).move as undefined | ((name: string) => Promise<void>);
    if (typeof moveFn !== 'function') {
        throw new Error('Renaming is not supported in this browser.');
    }
    await moveFn.call(handle, newName);
}

function updatePathPrefix(oldPrefix: string, newPrefix: string): void {
    const updates: Array<[string, string]> = [];
    for (const [id, path] of pathByOwnedId.entries()) {
        if (path === oldPrefix) {
            updates.push([id, newPrefix]);
        } else if (path.startsWith(`${oldPrefix}/`)) {
            updates.push([id, `${newPrefix}${path.slice(oldPrefix.length)}`]);
        }
    }
    for (const [id, newPath] of updates) {
        pathByOwnedId.set(id, newPath);
    }
}

function detachFromParent(id: string): void {
    const parentId = parentByChildId.get(id) ?? metadataById.get(id)?.parents[0];
    if (!parentId) {
        return;
    }
    const list = childrenByFolderId.get(parentId);
    if (list) {
        childrenByFolderId.set(parentId, list.filter((cid) => cid !== id));
    }
    parentByChildId.delete(id);
}

function dropFromIndexes(id: string): void {
    metadataById.delete(id);
    pathByOwnedId.delete(id);
    childrenByFolderId.delete(id);
    parentByChildId.delete(id);
    if (blobUrlCache[id]) {
        URL.revokeObjectURL(blobUrlCache[id]);
        delete blobUrlCache[id];
    }
}

function cleanupFolderRecursive(folderId: string): void {
    const queue = [folderId];
    while (queue.length > 0) {
        const id = queue.pop()!;
        for (const childId of childrenByFolderId.get(id) || []) {
            const child = metadataById.get(childId);
            if (!child) {
                continue;
            }
            if (child.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
                queue.push(childId);
            } else {
                dropFromIndexes(childId);
            }
        }
        detachFromParent(id);
        dropFromIndexes(id);
    }
}

// ============================================================================
// FileAPI
// ============================================================================

const localFileSystemAPI: FileAPI = {

    supportsShortcuts: false,

    initialiseFileAPI: async (onInitialised, onSignIn, onError) => {
        signInHandler = onSignIn;
        errorHandler = onError;

        if (!('showDirectoryPicker' in window)
            || !('queryPermission' in FileSystemDirectoryHandle.prototype)
            || !('requestPermission' in FileSystemDirectoryHandle.prototype)) {
            onError(new Error('File System Access API is not supported in this browser. Please use a Chromium-based browser like Chrome or Edge.'));
            return;
        }
        onInitialised();

        const savedHandle = await loadDirectoryHandle();
        if (savedHandle) {
            try {
                let permission = await savedHandle.queryPermission({mode: 'readwrite'});
                if (permission !== 'granted') {
                    permission = await savedHandle.requestPermission({mode: 'readwrite'});
                }
                if (permission === 'granted') {
                    rootDirectoryHandle = savedHandle;
                    await scanFromRoot();
                    onSignIn(true);
                    return;
                }
            } catch (error) {
                console.warn('Saved directory handle is no longer usable; clearing.', error);
                await clearDirectoryHandle();
            }
        }
    },

    signInToFileAPI: async () => {
        try {
            const handle = await (window as unknown as FileSystemAccessWindow).showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });
            rootDirectoryHandle = handle;
            await saveDirectoryHandle(handle);
            await scanFromRoot();
            signInHandler?.(true);
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                signInHandler?.(false);
                return;
            }
            errorHandler?.(error);
        }
    },

    signOutFromFileAPI: async () => {
        rootDirectoryHandle = null;
        resetIndexes();
        revokeAllBlobUrls();
        await clearDirectoryHandle();
        signInHandler?.(false);
    },

    getLoggedInUserInfo: (): Promise<FileSystemUser> => {
        return Promise.resolve(loggedInUserInfo);
    },

    loadRootFiles: async (addFilesCallback): Promise<void> => {
        if (!rootDirectoryHandle || !syntheticRootId) {
            return;
        }
        const root = metadataById.get(syntheticRootId);
        if (!root) {
            return;
        }
        addFilesCallback([await hydrateMetadata(root)]);
        const topIds = childrenByFolderId.get(syntheticRootId) || [];
        const tops: FileMetadata[] = [];
        for (const id of topIds) {
            const meta = metadataById.get(id);
            if (meta) {
                tops.push(await hydrateMetadata(meta));
            }
        }
        if (tops.length > 0) {
            addFilesCallback(tops);
        }
    },

    loadFilesInFolder: async (id: string, addFilesCallback): Promise<void> => {
        const childIds = childrenByFolderId.get(id) || [];
        const children: FileMetadata[] = [];
        for (const childId of childIds) {
            const meta = metadataById.get(childId);
            if (meta) {
                children.push(await hydrateMetadata(meta));
            }
        }
        if (children.length > 0) {
            addFilesCallback(children);
        }
    },

    getFullMetadata: async (id: string): Promise<FileMetadata> => {
        const meta = metadataById.get(id);
        if (!meta) {
            throw new Error(`File not found: ${id}`);
        }
        return await hydrateMetadata(meta);
    },

    getFileModifiedTime: async (id: string): Promise<number> => {
        const meta = metadataById.get(id);
        if (!meta) {
            throw new Error(`File not found: ${id}`);
        }
        const path = pathByOwnedId.get(id);
        if (!path) {
            return Date.now();
        }
        try {
            const {dir, name} = splitPathLast(path);
            const folderHandle = await navigateToDirectory(dir);
            const fileHandle = await folderHandle.getFileHandle(name);
            const file = await fileHandle.getFile();
            return file.lastModified;
        } catch {
            return Date.now();
        }
    },

    createFolder: async (folderName: string, metadata?: Partial<FileMetadata>): Promise<FileMetadata> => {
        if (!rootDirectoryHandle) {
            throw new Error('Local file system not initialised');
        }
        if (isReservedName(folderName) || folderName.includes('/')) {
            throw new Error(`Folder name "${folderName}" is reserved.`);
        }
        const id = metadata?.id || v4();
        const parentId = metadata?.parents?.[0] || syntheticRootId;
        if (!parentId || !pathByOwnedId.has(parentId)) {
            throw new Error('Cannot create folder without a known parent');
        }
        const parentPath = pathByOwnedId.get(parentId)!;
        const parentDir = await navigateToDirectory(parentPath);
        const sanitised = sanitiseFsName(folderName);
        const finalName = await ensureUniqueChildName(parentDir, sanitised);
        const newDir = await parentDir.getDirectoryHandle(finalName, {create: true});
        await writeFolderSidecar(newDir, {
            id,
            properties: metadata?.properties
        });

        const newPath = joinPath(parentPath, finalName);
        const newMeta: FileMetadata = {
            id,
            name: finalName,
            trashed: false,
            parents: [parentId],
            mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
            properties: metadata?.properties
        };
        metadataById.set(id, newMeta);
        pathByOwnedId.set(id, newPath);
        childrenByFolderId.set(id, []);
        parentByChildId.set(id, parentId);
        const siblings = childrenByFolderId.get(parentId) || [];
        siblings.push(id);
        childrenByFolderId.set(parentId, siblings);

        return await hydrateMetadata(newMeta);
    },

    uploadFile: async (
        fileSystemMetadata: Partial<FileMetadata>,
        file: Blob,
        onProgress?: (progress: OnProgressParams) => void
    ): Promise<FileMetadata> => {
        if (!rootDirectoryHandle) {
            throw new Error('Local file system not initialised');
        }
        const id = fileSystemMetadata.id || v4();
        const parentId = fileSystemMetadata.parents?.[0];
        if (!parentId || !pathByOwnedId.has(parentId)) {
            throw new Error('Cannot upload file without a known parent');
        }
        const parentPath = pathByOwnedId.get(parentId)!;
        const parentDir = await navigateToDirectory(parentPath);
        const requestedName = fileSystemMetadata.name || `file-${id}`;
        if (isReservedName(requestedName) || requestedName.includes('/')) {
            throw new Error(`File name "${requestedName}" is reserved.`);
        }
        const sanitised = sanitiseFsName(requestedName);
        const finalName = await ensureUniqueChildName(parentDir, sanitised, {reserveSidecar: true});
        const mimeType = file.type || fileSystemMetadata.mimeType || 'application/octet-stream';
        const appProperties = fileSystemMetadata.appProperties;
        const properties = fileSystemMetadata.properties as AnyProperties | undefined;

        // Sidecar first: if anything below fails the next scan can detect the
        // orphan sidecar and re-prompt for the missing media via the existing
        // miss/replace flow.
        await writeAssetSidecar(parentDir, finalName, {
            id,
            name: finalName,
            mimeType,
            appProperties,
            properties
        });

        const fileHandle = await parentDir.getFileHandle(finalName, {create: true});
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        onProgress?.({loaded: file.size, total: file.size});

        const newPath = joinPath(parentPath, finalName);
        const meta: FileMetadata = {
            id,
            name: finalName,
            trashed: false,
            parents: [parentId],
            mimeType,
            appProperties,
            properties
        };
        metadataById.set(id, meta);
        pathByOwnedId.set(id, newPath);
        parentByChildId.set(id, parentId);
        const siblings = childrenByFolderId.get(parentId) || [];
        siblings.push(id);
        childrenByFolderId.set(parentId, siblings);

        return await hydrateMetadata(meta);
    },

    saveJsonToFile: async (idOrMetadata: string | Partial<FileMetadata>, json: object): Promise<FileMetadata> => {
        if (!rootDirectoryHandle) {
            throw new Error('Local file system not initialised');
        }
        const partial: Partial<FileMetadata> = typeof idOrMetadata === 'string' ? {id: idOrMetadata} : idOrMetadata;
        const id = partial.id || v4();
        const existing = metadataById.get(id);

        if (existing) {
            const oldPath = pathByOwnedId.get(id);
            if (!oldPath) {
                throw new Error(`Stored entry ${id} has no on-disk path`);
            }
            const {dir, name} = splitPathLast(oldPath);
            const parentDir = await navigateToDirectory(dir);
            const mimeType = partial.mimeType ?? existing.mimeType ?? constants.MIME_TYPE_JSON;
            const appProperties = partial.appProperties ?? existing.appProperties;
            const properties = partial.properties ?? existing.properties;
            await writeJsonNativeFile(parentDir, name, {
                id,
                name,
                mimeType,
                appProperties,
                properties
            }, json);
            const updated: FileMetadata = {
                ...existing,
                mimeType,
                appProperties,
                properties
            };
            metadataById.set(id, updated);
            return await hydrateMetadata(updated);
        }

        const parentId = partial.parents?.[0];
        if (!parentId || !pathByOwnedId.has(parentId)) {
            throw new Error('Cannot save JSON without a known parent');
        }
        const parentPath = pathByOwnedId.get(parentId)!;
        const parentDir = await navigateToDirectory(parentPath);
        let requested = partial.name || `${id}.json`;
        if (!requested.endsWith('.json')) {
            requested = `${requested}.json`;
        }
        if (isReservedName(requested) || requested.includes('/')) {
            throw new Error(`File name "${requested}" is reserved.`);
        }
        const sanitised = sanitiseFsName(requested);
        const finalName = await ensureUniqueChildName(parentDir, sanitised);
        const mimeType = partial.mimeType ?? constants.MIME_TYPE_JSON;
        const appProperties = partial.appProperties;
        const properties = partial.properties as AnyProperties | undefined;
        await writeJsonNativeFile(parentDir, finalName, {
            id,
            name: finalName,
            mimeType,
            appProperties,
            properties
        }, json);

        const newPath = joinPath(parentPath, finalName);
        const meta: FileMetadata = {
            id,
            name: finalName,
            trashed: false,
            parents: [parentId],
            mimeType,
            appProperties,
            properties
        };
        metadataById.set(id, meta);
        pathByOwnedId.set(id, newPath);
        parentByChildId.set(id, parentId);
        const siblings = childrenByFolderId.get(parentId) || [];
        siblings.push(id);
        childrenByFolderId.set(parentId, siblings);

        return await hydrateMetadata(meta);
    },

    uploadFileMetadata: async (
        fileSystemMetadata: Partial<FileMetadata>,
        addParents?: string[],
        removeParents?: string[]
    ): Promise<FileMetadata> => {
        if (!rootDirectoryHandle) {
            throw new Error('Local file system not initialised');
        }
        const id = fileSystemMetadata.id;
        const existing = id ? metadataById.get(id) : undefined;

        if (!existing) {
            // Creating a brand-new metadata-only entry (e.g. a web link). Persist
            // it as a JSON-native file so the next scan can pick it up.
            const newId = id || v4();
            const parentId = fileSystemMetadata.parents?.[0] || addParents?.[0];
            if (!parentId) {
                throw new Error('Cannot create metadata without a parent');
            }
            const baseName = fileSystemMetadata.name || `link-${newId}`;
            const fileName = baseName.endsWith('.json') ? baseName : `${baseName}.json`;
            return await localFileSystemAPI.saveJsonToFile({
                id: newId,
                name: fileName,
                parents: [parentId],
                mimeType: fileSystemMetadata.mimeType || constants.MIME_TYPE_JSON,
                appProperties: fileSystemMetadata.appProperties,
                properties: fileSystemMetadata.properties
            }, {});
        }

        return await updateExistingMetadata(existing, fileSystemMetadata, addParents, removeParents);
    },

    createShortcut: async (): Promise<FileMetadata> => {
        // The local file system has no notion of cross-file "virtual links"
        // (each asset is exactly one path on disk and only the signed-in GM
        // can see anything in the picked directory anyway). Callers that
        // surface shortcut-creating UI should gate it on
        // `FileAPI.supportsShortcuts`; if we get here something missed that
        // check and we want to fail loudly rather than silently no-op.
        throw new Error('Local FS does not support shortcuts.');
    },

    getFileContents: async (fileSystemMetadata: Partial<FileMetadata>): Promise<Blob> => {
        if (!fileSystemMetadata.id) {
            throw new Error('Cannot get file contents without metadata ID');
        }
        const webLink = (fileSystemMetadata.properties as WebLinkProperties)?.webLink
            ?? (metadataById.get(fileSystemMetadata.id)?.properties as WebLinkProperties)?.webLink;
        if (webLink) {
            const response = await fetch(webLink);
            return await response.blob();
        }
        const path = pathByOwnedId.get(fileSystemMetadata.id);
        if (!path) {
            throw new Error(`File not found: ${fileSystemMetadata.id}`);
        }
        const {dir, name} = splitPathLast(path);
        const parentDir = await navigateToDirectory(dir);
        const fileHandle = await parentDir.getFileHandle(name);
        return await fileHandle.getFile();
    },

    getJsonFileContents: async (fileSystemMetadata: Partial<FileMetadata>): Promise<any> => {
        if (!fileSystemMetadata.id) {
            throw new Error('Cannot get JSON without metadata ID');
        }
        const path = pathByOwnedId.get(fileSystemMetadata.id);
        if (!path) {
            throw new Error(`File not found: ${fileSystemMetadata.id}`);
        }
        const {dir, name} = splitPathLast(path);
        const parentDir = await navigateToDirectory(dir);
        const fileHandle = await parentDir.getFileHandle(name);
        const parsed = await readJsonFile<JsonNativeFile | any>(fileHandle);
        if (parsed && typeof parsed === 'object' && parsed[ENVELOPE_KEY]) {
            return (parsed as JsonNativeFile).content ?? null;
        }
        // Foreign JSON without our envelope; return as-is so callers see something
        // recognisable rather than null.
        return parsed;
    },

    makeFileReadableToAll: (): Promise<void> => {
        return Promise.resolve();
    },

    findFilesWithAppProperty: (key: string, value: string): Promise<FileMetadata[]> => {
        const out: FileMetadata[] = [];
        for (const meta of metadataById.values()) {
            if (meta.appProperties && (meta.appProperties as any)[key] === value) {
                out.push({...meta, owners: [loggedInUserInfo]});
            }
        }
        return Promise.resolve(out);
    },

    findFilesWithProperty: (key: string, value: string): Promise<FileMetadata[]> => {
        const out: FileMetadata[] = [];
        for (const meta of metadataById.values()) {
            if (meta.properties && (meta.properties as any)[key] === value) {
                out.push({...meta, owners: [loggedInUserInfo]});
            }
        }
        return Promise.resolve(out);
    },

    findFilesContainingNameWithProperty: (name: string, key: string, value: string): Promise<FileMetadata[]> => {
        const lowerName = name.toLowerCase();
        const out: FileMetadata[] = [];
        for (const meta of metadataById.values()) {
            if (
                meta.name.toLowerCase().includes(lowerName)
                && meta.properties
                && (meta.properties as any)[key] === value
            ) {
                out.push({...meta, owners: [loggedInUserInfo]});
            }
        }
        return Promise.resolve(out);
    },

    deleteFile: async (fileSystemMetadata: Partial<FileMetadata>): Promise<void> => {
        if (!fileSystemMetadata.id) {
            return;
        }
        const id = fileSystemMetadata.id;
        const existing = metadataById.get(id);
        if (!existing) {
            return;
        }

        const path = pathByOwnedId.get(id);

        if (existing.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            if (path !== undefined && rootDirectoryHandle) {
                if (!path) {
                    console.warn('Refusing to delete root folder via deleteFile.');
                    return;
                }
                const {dir, name} = splitPathLast(path);
                try {
                    const parentDir = await navigateToDirectory(dir);
                    await parentDir.removeEntry(name, {recursive: true});
                } catch (error) {
                    console.warn(`Could not delete folder "${path}" from disk.`, error);
                }
            }
            cleanupFolderRecursive(id);
            return;
        }

        // Asset (binary or JSON-native).
        if (path !== undefined) {
            const {dir, name} = splitPathLast(path);
            try {
                const parentDir = await navigateToDirectory(dir);
                try {
                    await parentDir.removeEntry(name);
                } catch (error) {
                    console.warn(`Could not delete asset "${path}" from disk.`, error);
                }
                if (!name.endsWith('.json')) {
                    try {
                        await parentDir.removeEntry(`${name}${SIDECAR_SUFFIX}`);
                    } catch (error) {
                        console.warn(`Could not delete sidecar for "${path}".`, error);
                    }
                }
            } catch (error) {
                console.warn(`Parent directory unreachable while deleting "${path}".`, error);
            }
        }
        detachFromParent(id);
        dropFromIndexes(id);
    }
};

// ============================================================================
// uploadFileMetadata helpers
// ============================================================================

function resolveSingleParent(
    current: string,
    requestedParents: string[] | undefined,
    addParents: string[] | undefined,
    removeParents: string[] | undefined
): string | undefined {
    if (requestedParents && requestedParents.length > 0) {
        return requestedParents[0];
    }
    let next = current;
    if (removeParents && removeParents.includes(next) && addParents && addParents.length > 0) {
        next = addParents[0];
    } else if (addParents && addParents.length > 0) {
        next = addParents[addParents.length - 1];
    } else if (removeParents && removeParents.includes(next)) {
        // Removed without replacement; keep current to avoid orphaning.
        return undefined;
    }
    return next === current ? undefined : next;
}

async function updateExistingMetadata(
    existing: FileMetadata,
    incoming: Partial<FileMetadata>,
    addParents?: string[],
    removeParents?: string[]
): Promise<FileMetadata> {
    if (!rootDirectoryHandle) {
        throw new Error('Local file system not initialised');
    }
    const oldPath = pathByOwnedId.get(existing.id);
    if (oldPath === undefined) {
        throw new Error(`No on-disk path for ${existing.id}`);
    }
    const {dir: oldDir, name: oldName} = splitPathLast(oldPath);
    const isFolder = existing.mimeType === constants.MIME_TYPE_DRIVE_FOLDER;
    const isJsonNative = !isFolder && oldName.endsWith('.json');

    const currentParent = existing.parents[0] || syntheticRootId!;
    const newParent = resolveSingleParent(currentParent, incoming.parents, addParents, removeParents) ?? currentParent;
    if (!metadataById.get(newParent)) {
        throw new Error(`Cannot move ${existing.id} to unknown parent ${newParent}`);
    }
    if (newParent !== currentParent && isFolder) {
        if (newParent === existing.id || isAncestorOf(existing.id, newParent)) {
            throw new Error('Cannot move folder into itself');
        }
    }

    let desiredName = incoming.name ?? existing.name;
    if (isJsonNative && !desiredName.endsWith('.json')) {
        desiredName = `${desiredName}.json`;
    }
    if (isReservedName(desiredName) || desiredName.includes('/')) {
        throw new Error(`Name "${desiredName}" is reserved.`);
    }
    desiredName = sanitiseFsName(desiredName);

    const newParentPath = pathByOwnedId.get(newParent)!;
    const newParentDir = await navigateToDirectory(newParentPath);
    const oldParentDir = await navigateToDirectory(oldDir);
    const movingOrRenaming = newParent !== currentParent || desiredName !== oldName;

    let finalName = oldName;
    if (movingOrRenaming) {
        finalName = await ensureUniqueChildName(newParentDir, desiredName, {reserveSidecar: !isFolder && !isJsonNative});
        if (isFolder) {
            const dirHandle = await oldParentDir.getDirectoryHandle(oldName);
            if (newParent !== currentParent) {
                await moveHandle(dirHandle, newParentDir, finalName);
            } else {
                await renameHandle(dirHandle, finalName);
            }
        } else {
            const fileHandle = await oldParentDir.getFileHandle(oldName);
            if (newParent !== currentParent) {
                await moveHandle(fileHandle, newParentDir, finalName);
            } else {
                await renameHandle(fileHandle, finalName);
            }
            if (!isJsonNative) {
                try {
                    const sidecarHandle = await oldParentDir.getFileHandle(`${oldName}${SIDECAR_SUFFIX}`);
                    if (newParent !== currentParent) {
                        await moveHandle(sidecarHandle, newParentDir, `${finalName}${SIDECAR_SUFFIX}`);
                    } else {
                        await renameHandle(sidecarHandle, `${finalName}${SIDECAR_SUFFIX}`);
                    }
                } catch (error) {
                    console.warn(`Could not move sidecar for "${oldPath}".`, error);
                }
            }
        }
    }

    const newPath = joinPath(newParentPath, finalName);
    if (newPath !== oldPath) {
        if (isFolder) {
            updatePathPrefix(oldPath, newPath);
        } else {
            pathByOwnedId.set(existing.id, newPath);
        }
    }

    if (newParent !== currentParent) {
        const oldSiblings = childrenByFolderId.get(currentParent) || [];
        childrenByFolderId.set(currentParent, oldSiblings.filter((cid) => cid !== existing.id));
        const newSiblings = childrenByFolderId.get(newParent) || [];
        newSiblings.push(existing.id);
        childrenByFolderId.set(newParent, newSiblings);
        parentByChildId.set(existing.id, newParent);
    }

    const updated: FileMetadata = {
        ...existing,
        name: finalName,
        parents: [newParent],
        appProperties: incoming.appProperties ?? existing.appProperties,
        properties: incoming.properties ?? existing.properties,
        trashed: incoming.trashed ?? existing.trashed
    };
    metadataById.set(existing.id, updated);
    await persistMetadataFor(existing.id);
    return await hydrateMetadata(updated);
}

function isAncestorOf(ancestorId: string, descendantId: string): boolean {
    let cur = parentByChildId.get(descendantId);
    while (cur) {
        if (cur === ancestorId) {
            return true;
        }
        cur = parentByChildId.get(cur);
    }
    return false;
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Override the default placeholder owner used when hydrating metadata from the
 * local file system. Currently unused; provided as an extension point for the
 * day a real account/profile is configured for the local GM.
 */
export function configureLocalFsOwner(user: FileSystemUser): void {
    loggedInUserInfo = {...user, me: true};
}

export default localFileSystemAPI;
