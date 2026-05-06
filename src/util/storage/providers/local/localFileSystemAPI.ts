import {v4} from 'uuid';

import * as constants from '../../../constants';
import {
    AnyAppProperties,
    AnyProperties,
    FileAPI,
    FileMetadata,
    FileShortcut,
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
// Sidecars (and embedded envelopes) hold:
//   - id: stable GUID
//   - mimeType (assets) / appProperties / properties (any kind)
//   - shortcuts: optional list of "virtual links" pointing into other folders;
//     synthesised at scan time into `FileShortcut`-shaped metadata.
//
// The directory and file names on disk are authoritative for navigation; the
// sidecar `name` field is descriptive only.

const FOLDER_SIDECAR_NAME = '_folder.data.json';
const SIDECAR_SUFFIX = '.data.json';
const RESERVED_NAME_PREFIX = '_folder';
const ENVELOPE_KEY = '_gtoveMeta';
const MAX_SCAN_DEPTH = 16;

interface ShortcutSidecarEntry {
    ownedMetadataId: string;
    parentFolderId: string;
    propertyOverlay?: AnyProperties;
}

interface FolderSidecarData {
    id: string;
    name?: string;
    appProperties?: AnyAppProperties;
    properties?: AnyProperties;
}

interface AssetSidecarData {
    id: string;
    name?: string;
    mimeType?: string;
    appProperties?: AnyAppProperties;
    properties?: AnyProperties;
    shortcuts?: ShortcutSidecarEntry[];
}

interface JsonEnvelope {
    id: string;
    name?: string;
    mimeType?: string;
    appProperties?: AnyAppProperties;
    properties?: AnyProperties;
    shortcuts?: ShortcutSidecarEntry[];
}

interface JsonNativeFile {
    [ENVELOPE_KEY]: JsonEnvelope;
    content: any;
}

interface ShortcutEntry {
    ownedMetadataId: string;
    targetMetadataId: string;
    parentFolderId: string;
    propertyOverlay?: AnyProperties;
}

type EntryKind = 'folder' | 'json' | 'binary' | 'shortcut';

// ============================================================================
// Module state
// ============================================================================

let rootDirectoryHandle: FileSystemDirectoryHandle | null = null;
let signInHandler: ((signedIn: boolean) => void) | null = null;
let errorHandler: ((error: Error) => void) | null = null;

let syntheticRootId: string | null = null;

// All metadata known to the app (real assets, folders, and synthesised shortcut entries).
const metadataById = new Map<string, FileMetadata>();
// Real on-disk path (relative to root) for every folder and asset id. Shortcut
// owned ids do not appear here; they resolve to their target via shortcutsByOwnedId.
const pathByOwnedId = new Map<string, string>();
// Ordered child ids per folder id, mixing real children and shortcut owned ids.
const childrenByFolderId = new Map<string, string[]>();
// Single parent per id (folders and assets only; shortcut owned ids are placed
// directly into childrenByFolderId for their virtual parent).
const parentByChildId = new Map<string, string>();
const shortcutsByOwnedId = new Map<string, ShortcutEntry>();
const shortcutsByTargetId = new Map<string, ShortcutEntry[]>();

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
// Hydration & shortcut synthesis
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
    const targetId = shortcutsByOwnedId.get(id)?.targetMetadataId ?? id;
    const path = pathByOwnedId.get(targetId);
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

function synthesiseShortcutMetadata(target: FileMetadata, entry: ShortcutEntry): FileMetadata {
    const properties = {
        ...(target.properties as object | undefined),
        ...(entry.propertyOverlay as object | undefined),
        shortcutMetadataId: target.id,
        ownedMetadataId: entry.ownedMetadataId
    } as unknown as FileShortcut;
    return {
        id: entry.ownedMetadataId,
        name: target.name,
        trashed: false,
        parents: [entry.parentFolderId],
        mimeType: target.mimeType,
        appProperties: target.appProperties,
        properties: properties as unknown as AnyProperties
    };
}

function classifyEntry(meta: FileMetadata): EntryKind {
    if (shortcutsByOwnedId.has(meta.id)) {
        return 'shortcut';
    }
    if (meta.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
        return 'folder';
    }
    const path = pathByOwnedId.get(meta.id) || '';
    return path.endsWith('.json') ? 'json' : 'binary';
}

function buildShortcutSidecarList(targetId: string): ShortcutSidecarEntry[] | undefined {
    const arr = shortcutsByTargetId.get(targetId);
    if (!arr || arr.length === 0) {
        return undefined;
    }
    return arr.map((sc) => ({
        ownedMetadataId: sc.ownedMetadataId,
        parentFolderId: sc.parentFolderId,
        propertyOverlay: sc.propertyOverlay
    }));
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
            name: meta.name,
            appProperties: meta.appProperties,
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
            properties: meta.properties,
            shortcuts: buildShortcutSidecarList(id)
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
            properties: meta.properties,
            shortcuts: buildShortcutSidecarList(id)
        }, body);
    }
}

// ============================================================================
// Scan engine
// ============================================================================

interface PendingShortcuts {
    targetId: string;
    entries: ShortcutSidecarEntry[];
}

function resetIndexes(): void {
    metadataById.clear();
    pathByOwnedId.clear();
    childrenByFolderId.clear();
    parentByChildId.clear();
    shortcutsByOwnedId.clear();
    shortcutsByTargetId.clear();
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

    const pendingShortcuts: PendingShortcuts[] = [];

    for (const topName of constants.topLevelFolders) {
        const topHandle = await rootDirectoryHandle.getDirectoryHandle(topName, {create: true});
        const topMeta = await ensureFolderSidecarFor(topHandle, topName, rootId, topName);
        if (!topMeta) {
            continue;
        }
        await walkFolder(topHandle, topName, topMeta.id, 1, pendingShortcuts);
        if (fatalScanError) {
            throw fatalScanError;
        }
    }

    materialiseShortcuts(pendingShortcuts);
}

async function ensureRootFolderSidecar(): Promise<string> {
    if (!rootDirectoryHandle) {
        throw new Error('No root directory');
    }
    let id: string;
    let appProperties: AnyAppProperties = {
        rootFolder: 'true',
        dataVersion: constants.DATA_VERSION.toString()
    } as AnyAppProperties;
    let properties: AnyProperties = undefined;
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
            appProperties = parsed.appProperties ?? appProperties;
            properties = parsed.properties ?? properties;
        } catch (error) {
            console.warn('Could not parse root folder sidecar; recreating it.', error);
            id = v4();
            await writeFolderSidecar(rootDirectoryHandle, {id, name: constants.FOLDER_ROOT, appProperties, properties});
        }
    } else {
        id = v4();
        await writeFolderSidecar(rootDirectoryHandle, {id, name: constants.FOLDER_ROOT, appProperties, properties});
    }
    metadataById.set(id, {
        id,
        name: constants.FOLDER_ROOT,
        trashed: false,
        parents: [],
        mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
        appProperties,
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
    let appProperties: AnyAppProperties | undefined;
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
            appProperties = parsed.appProperties;
            properties = parsed.properties;
        } catch (error) {
            console.warn(`Could not parse folder sidecar at "${relativePath}"; skipping subtree.`, error);
            return null;
        }
    } else {
        id = v4();
        await writeFolderSidecar(folderHandle, {id, name: displayName});
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
        appProperties,
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
    depth: number,
    pendingShortcuts: PendingShortcuts[]
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
        await walkFolder(de.handle, subPath, subMeta.id, depth + 1, pendingShortcuts);
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
            await registerJsonNativeAsset(fe.handle, fe.name, filePath, folderId, pendingShortcuts);
        } else {
            const sidecar = sidecarsByBaseName.get(fe.name);
            if (!sidecar) {
                console.warn(`Asset "${filePath}" has no sidecar; skipping.`);
                continue;
            }
            sidecarsByBaseName.delete(fe.name);
            await registerBinaryAsset(fe.handle, sidecar, fe.name, filePath, folderId, pendingShortcuts);
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
    folderId: string,
    pendingShortcuts: PendingShortcuts[]
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
    if (envelope.shortcuts && envelope.shortcuts.length > 0) {
        pendingShortcuts.push({targetId: meta.id, entries: envelope.shortcuts});
    }
}

async function registerBinaryAsset(
    fileHandle: FileSystemFileHandle,
    sidecarHandle: FileSystemFileHandle,
    fileName: string,
    filePath: string,
    folderId: string,
    pendingShortcuts: PendingShortcuts[]
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
    if (sidecar.shortcuts && sidecar.shortcuts.length > 0) {
        pendingShortcuts.push({targetId: meta.id, entries: sidecar.shortcuts});
    }
}

function materialiseShortcuts(pendingShortcuts: PendingShortcuts[]): void {
    for (const {targetId, entries} of pendingShortcuts) {
        const target = metadataById.get(targetId);
        if (!target) {
            continue;
        }
        if (target.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            console.warn(`Folder ${targetId} has shortcut entries; folder shortcuts are not supported and will be ignored.`);
            continue;
        }
        for (const entry of entries) {
            if (!entry?.ownedMetadataId || !entry?.parentFolderId) {
                console.warn(`Invalid shortcut entry on target ${targetId}; skipping.`);
                continue;
            }
            if (metadataById.has(entry.ownedMetadataId)) {
                console.warn(`Duplicate shortcut owned id ${entry.ownedMetadataId}; skipping.`);
                continue;
            }
            const parent = metadataById.get(entry.parentFolderId);
            if (!parent || parent.mimeType !== constants.MIME_TYPE_DRIVE_FOLDER) {
                console.warn(`Shortcut parent ${entry.parentFolderId} for target ${targetId} is not a known folder; skipping.`);
                continue;
            }
            const shortcut: ShortcutEntry = {
                ownedMetadataId: entry.ownedMetadataId,
                targetMetadataId: targetId,
                parentFolderId: entry.parentFolderId,
                propertyOverlay: entry.propertyOverlay
            };
            const synth = synthesiseShortcutMetadata(target, shortcut);
            metadataById.set(synth.id, synth);
            childrenByFolderId.get(entry.parentFolderId)!.push(synth.id);
            shortcutsByOwnedId.set(synth.id, shortcut);
            const list = shortcutsByTargetId.get(targetId) || [];
            list.push(shortcut);
            shortcutsByTargetId.set(targetId, list);
        }
    }
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

function dropShortcutsTargeting(targetId: string): void {
    const arr = shortcutsByTargetId.get(targetId);
    if (!arr) {
        return;
    }
    for (const sc of arr) {
        metadataById.delete(sc.ownedMetadataId);
        shortcutsByOwnedId.delete(sc.ownedMetadataId);
        const parentList = childrenByFolderId.get(sc.parentFolderId);
        if (parentList) {
            childrenByFolderId.set(sc.parentFolderId, parentList.filter((cid) => cid !== sc.ownedMetadataId));
        }
    }
    shortcutsByTargetId.delete(targetId);
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
    dropShortcutsTargeting(id);
}

async function cleanupFolderRecursive(folderId: string): Promise<void> {
    const queue = [folderId];
    // Collect target ids whose sidecars need to be re-persisted because we are
    // dropping shortcut entries pointing into the doomed subtree.
    const targetsToRepersist = new Set<string>();
    while (queue.length > 0) {
        const id = queue.pop()!;
        for (const childId of childrenByFolderId.get(id) || []) {
            const child = metadataById.get(childId);
            if (!child) {
                continue;
            }
            const shortcut = shortcutsByOwnedId.get(childId);
            if (shortcut) {
                const remaining = (shortcutsByTargetId.get(shortcut.targetMetadataId) || [])
                    .filter((sc) => sc.ownedMetadataId !== childId);
                if (remaining.length > 0) {
                    shortcutsByTargetId.set(shortcut.targetMetadataId, remaining);
                } else {
                    shortcutsByTargetId.delete(shortcut.targetMetadataId);
                }
                if (metadataById.has(shortcut.targetMetadataId)) {
                    targetsToRepersist.add(shortcut.targetMetadataId);
                }
                shortcutsByOwnedId.delete(childId);
                metadataById.delete(childId);
            } else if (child.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
                queue.push(childId);
            } else {
                dropFromIndexes(childId);
            }
        }
        detachFromParent(id);
        dropFromIndexes(id);
    }
    for (const targetId of targetsToRepersist) {
        try {
            await persistMetadataFor(targetId);
        } catch (error) {
            console.warn(`Could not update sidecar for target ${targetId} after folder deletion.`, error);
        }
    }
}

// ============================================================================
// FileAPI
// ============================================================================

const localFileSystemAPI: FileAPI = {

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
        const targetId = shortcutsByOwnedId.get(id)?.targetMetadataId ?? id;
        const path = pathByOwnedId.get(targetId);
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
            name: finalName,
            appProperties: metadata?.appProperties,
            properties: metadata?.properties
        });

        const newPath = joinPath(parentPath, finalName);
        const newMeta: FileMetadata = {
            id,
            name: finalName,
            trashed: false,
            parents: [parentId],
            mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
            appProperties: metadata?.appProperties,
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

        if (existing && !shortcutsByOwnedId.has(id)) {
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
                properties,
                shortcuts: buildShortcutSidecarList(id)
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
        const shortcut = id ? shortcutsByOwnedId.get(id) : undefined;

        if (shortcut && existing) {
            return await updateShortcutMetadata(shortcut, fileSystemMetadata, addParents, removeParents);
        }

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

    createShortcut: async (
        originalFile: Partial<FileMetadata> & {id: string},
        newParents: string[]
    ): Promise<FileMetadata> => {
        const target = metadataById.get(originalFile.id);
        if (!target) {
            throw new Error(`Original file not found: ${originalFile.id}`);
        }
        if (target.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            throw new Error('Local FS does not support folder shortcuts.');
        }
        if (newParents.length === 0) {
            throw new Error('createShortcut requires at least one parent');
        }
        // Use the first parent only; multi-parent virtual links are not modelled
        // locally and the sole caller (gTove.tsx, screenTabletopBrowser.tsx) only
        // ever passes a single parent.
        const parentFolderId = newParents[0];
        if (!metadataById.get(parentFolderId)) {
            throw new Error(`Shortcut parent folder ${parentFolderId} not found`);
        }
        const ownedMetadataId = v4();
        const propertyOverlay = (originalFile.properties && originalFile.properties !== target.properties)
            ? (originalFile.properties as AnyProperties)
            : undefined;
        const entry: ShortcutEntry = {
            ownedMetadataId,
            targetMetadataId: target.id,
            parentFolderId,
            propertyOverlay
        };
        const list = shortcutsByTargetId.get(target.id) || [];
        list.push(entry);
        shortcutsByTargetId.set(target.id, list);
        shortcutsByOwnedId.set(ownedMetadataId, entry);

        await persistMetadataFor(target.id);

        const synth = synthesiseShortcutMetadata(target, entry);
        metadataById.set(synth.id, synth);
        const parentChildren = childrenByFolderId.get(parentFolderId) || [];
        parentChildren.push(synth.id);
        childrenByFolderId.set(parentFolderId, parentChildren);

        return await hydrateMetadata(synth);
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
        const targetId = shortcutsByOwnedId.get(fileSystemMetadata.id)?.targetMetadataId ?? fileSystemMetadata.id;
        const path = pathByOwnedId.get(targetId);
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
        const targetId = shortcutsByOwnedId.get(fileSystemMetadata.id)?.targetMetadataId ?? fileSystemMetadata.id;
        const path = pathByOwnedId.get(targetId);
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

        const shortcut = shortcutsByOwnedId.get(id);
        if (shortcut) {
            // Remove just the shortcut entry from target's stored shortcut list.
            const remaining = (shortcutsByTargetId.get(shortcut.targetMetadataId) || [])
                .filter((sc) => sc.ownedMetadataId !== id);
            if (remaining.length > 0) {
                shortcutsByTargetId.set(shortcut.targetMetadataId, remaining);
            } else {
                shortcutsByTargetId.delete(shortcut.targetMetadataId);
            }
            shortcutsByOwnedId.delete(id);
            metadataById.delete(id);
            const parentList = childrenByFolderId.get(shortcut.parentFolderId);
            if (parentList) {
                childrenByFolderId.set(shortcut.parentFolderId, parentList.filter((cid) => cid !== id));
            }
            try {
                await persistMetadataFor(shortcut.targetMetadataId);
            } catch (error) {
                console.warn('Could not update target sidecar after removing shortcut entry.', error);
            }
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
            await cleanupFolderRecursive(id);
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

async function updateShortcutMetadata(
    shortcut: ShortcutEntry,
    incoming: Partial<FileMetadata>,
    addParents?: string[],
    removeParents?: string[]
): Promise<FileMetadata> {
    const oldParentFolderId = shortcut.parentFolderId;
    const parentChange = resolveSingleParent(oldParentFolderId, incoming.parents, addParents, removeParents);
    if (parentChange) {
        if (!metadataById.get(parentChange)) {
            throw new Error(`Cannot move shortcut to unknown parent ${parentChange}`);
        }
        if (parentChange !== oldParentFolderId) {
            const oldList = childrenByFolderId.get(oldParentFolderId) || [];
            childrenByFolderId.set(oldParentFolderId, oldList.filter((cid) => cid !== shortcut.ownedMetadataId));
            const newList = childrenByFolderId.get(parentChange) || [];
            newList.push(shortcut.ownedMetadataId);
            childrenByFolderId.set(parentChange, newList);
            shortcut.parentFolderId = parentChange;
        }
    }

    if (incoming.properties !== undefined) {
        // Drive replaces a shortcut file's properties wholesale; do the same here.
        const overlay = stripShortcutKeys(incoming.properties as AnyProperties);
        shortcut.propertyOverlay = overlay;
    }

    const target = metadataById.get(shortcut.targetMetadataId);
    if (!target) {
        throw new Error(`Shortcut target ${shortcut.targetMetadataId} disappeared`);
    }
    const synth = synthesiseShortcutMetadata(target, shortcut);
    metadataById.set(synth.id, synth);
    await persistMetadataFor(shortcut.targetMetadataId);
    return await hydrateMetadata(synth);
}

function stripShortcutKeys(properties: AnyProperties | undefined): AnyProperties | undefined {
    if (!properties) {
        return properties;
    }
    const obj = {...(properties as object)} as any;
    delete obj.shortcutMetadataId;
    delete obj.ownedMetadataId;
    return obj as AnyProperties;
}

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
