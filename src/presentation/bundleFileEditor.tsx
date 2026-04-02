import './bundleFileEditor.scss';

import {useGranularEffect} from 'granular-hooks';
import {FunctionComponent, useCallback, useContext, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {addFilesAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore} from '../redux/mainReducer';
import {buildBundleJson, BundleType} from '../util/bundleUtils';
import {FOLDER_MAP, FOLDER_MINI, FOLDER_SCENARIO, MIME_TYPE_DRIVE_FOLDER, MIME_TYPE_JSON} from '../util/constants';
import {getAllScenarioMetadataIds} from '../util/scenarioUtils';
import {AnyAppProperties, FileMetadata} from '../util/storage/storageContract';
import {isWebLinkProperties} from '../util/storage/storageUtils';
import RenameFileEditor, {RenameFileEditorProps} from './renameFileEditor';
import TreeViewSelect, {TreeViewSelectItem} from './treeViewSelect';

const FOLDER_ROOTS = [
    FOLDER_SCENARIO,
    FOLDER_MAP,
    FOLDER_MINI
];

interface BundleFileEditorProps extends RenameFileEditorProps<AnyAppProperties, void> {
}

const BundleFileEditor: FunctionComponent<BundleFileEditorProps> = (props) => {
    const fileAPI = useContext(FileAPIContextObject);
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    
    const [loadingBundle, setLoadingBundle] = useState(true);
    const [loading, setLoading] = useState<{[key: string]: boolean}>({});
    const [selected, setSelected] = useState<{[root: string]: {[key: string]: boolean}}>({});
    
    const ensureAllMetadata = useCallback(async (missingMetadataIds: string[]): Promise<FileMetadata[]> => {
        const allMetadata = [];
        const loadedMetadata = [];
        for (let metadataId of missingMetadataIds) {
            const missingMetadata = !files.fileMetadata[metadataId];
            const metadata = missingMetadata ? await fileAPI.getFullMetadata(metadataId) : files.fileMetadata[metadataId];
            allMetadata.push(metadata);
            if (missingMetadata) {
                loadedMetadata.push(metadata);
            }
        }
        dispatch(addFilesAction(loadedMetadata));
        return allMetadata;
    }, [dispatch, fileAPI, files.fileMetadata]);
    
    const loadAllDirectoriesToRoot = useCallback(async (rootMetadataId: string, itemMetadataIds: string[]) => {
        if (itemMetadataIds.length === 0) {
            await fileAPI.loadFilesInFolder(rootMetadataId, (files: FileMetadata[]) => {dispatch(addFilesAction(files))})
        }
        let directoryIdMap: Record<string, boolean> = {};
        let toCheck = itemMetadataIds;
        // Follow the parents of each item in toCheck up to the root, loading their metadata if required.
        while (toCheck.length > 0) {
            const missingDirectoryIds = toCheck.reduce((missing: string[], metadataId) => {
                if (metadataId !== rootMetadataId && files.fileMetadata[metadataId]) {
                    files.fileMetadata[metadataId].parents.forEach((parentId: string) => {
                        directoryIdMap[parentId] = true;
                        if (!files.fileMetadata[parentId]) {
                            missing.push(parentId);
                        }
                    });
                }
                return missing;
            }, []);
            const missingDirectoryMetadata = await ensureAllMetadata(missingDirectoryIds);
            toCheck = missingDirectoryMetadata.map((metadata) => (metadata.id));
        }
        // Now load the directory contents of all the directories containing the items and their ancestors.
        for (let directoryId of Object.keys(directoryIdMap)) {
            await fileAPI.loadFilesInFolder(directoryId, (files: FileMetadata[]) => {
                dispatch(addFilesAction(files));
            });
        }
    }, [dispatch, ensureAllMetadata, fileAPI, files.fileMetadata]);

    useGranularEffect(() => {
        (async () => {
            // Select all the existing items saved in the bundle - this potentially requires loading a lot of stuff from Drive.
            let selected: {[root: string]: {[key: string]: boolean}};
            let missingMetadataIds: string[];
            const bundle = await fileAPI.getJsonFileContents(props.metadata) as BundleType;
            // Mark the current items from the bundle as selected.
            selected = FOLDER_ROOTS.reduce((selected, root) => ({...selected, [root]: {}}), {});
            markSelected(selected[FOLDER_MAP], bundle.driveMaps);
            markSelected(selected[FOLDER_MINI], bundle.driveMinis);
            markSelected(selected[FOLDER_SCENARIO],
                Object.keys(bundle.scenarios || {}).map((scenarioName) => (bundle.scenarios[scenarioName].metadataId)));
            // Load the metadata for the selected items.
            const allMetadataIds = FOLDER_ROOTS.reduce<string[]>((all, root) => ([...all, ...Object.keys(selected[root])]), []);
            missingMetadataIds = allMetadataIds.filter((metadataId) => (!files.fileMetadata[metadataId]));
            const loadedMetadata = await ensureAllMetadata(missingMetadataIds);
            handleFailingMetadata(missingMetadataIds, loadedMetadata, selected);
            setSelected(selected);
            // Load the ancestor directories of the selected items, up to the root.
            for (let rootId of FOLDER_ROOTS) {
                await loadAllDirectoriesToRoot(files.roots[rootId], Object.keys(selected[rootId]));
            }
            setLoadingBundle(false);
        })();
    }, [], [ensureAllMetadata, fileAPI, loadAllDirectoriesToRoot, files.fileMetadata, files.roots, props.metadata]);
    
    const onSave = useCallback(async (metadata: FileMetadata): Promise<FileMetadata> => {
        const bundleJson = await buildBundleJson(fileAPI,
            metadata.name,
            Object.keys(selected[FOLDER_SCENARIO]),
            Object.keys(selected[FOLDER_MAP]),
            Object.keys(selected[FOLDER_MINI])
        );
        return await fileAPI.saveJsonToFile(metadata.id, bundleJson);
    }, [fileAPI, selected]);
    
    const onSetSelected = useCallback(async (root: string, key: string, value: boolean) => {
        setSelected((prevState) => (
            {...prevState, [root]: {...prevState[root], [key]: value}}
        ));
        if (root === FOLDER_SCENARIO) {
            // automatically de/select maps and minis in the scenario
            const scenario = await fileAPI.getJsonFileContents({id: key});
            await ensureAllMetadata(getAllScenarioMetadataIds(scenario));
            setSelected((prevState) => {
                const result = {
                    ...prevState,
                    [FOLDER_MAP]: {...prevState[FOLDER_MAP]},
                    [FOLDER_MINI]: {...prevState[FOLDER_MINI]}
                };
                markSelected(result[FOLDER_MAP],
                    Object.keys(scenario.maps).map((mapId) => (scenario.maps[mapId].metadata.id)), value);
                markSelected(result[FOLDER_MINI],
                    Object.keys(scenario.minis).map((miniId) => (scenario.minis[miniId].metadata.id)), value);
                return result;
            });
        }
    }, [ensureAllMetadata, fileAPI]);
    
    const renderItem = useCallback((root: string, key?: string): TreeViewSelectItem => {
        if (!key) {
            return {sortLabel: '', element: (<span>{root}</span>), key: files.roots[root], canExpand: true, disabled: false};
        } else {
            const metadata = files.fileMetadata[key];
            const isFolder = (metadata.mimeType === MIME_TYPE_DRIVE_FOLDER);
            const isJson = (metadata.mimeType === MIME_TYPE_JSON);
            const icon = isFolder ? 'folder' : (isJson ? (root === FOLDER_SCENARIO ? 'photo' : 'cloud') : null);
            return {
                sortLabel: (isFolder ? '1' : '2') + metadata.name,
                element: (
                    <span className='bundleItem'>
                        <span className='itemIcon'>
                            {
                                isWebLinkProperties(metadata.properties) ? <img src={metadata.properties.webLink} alt=''/> :
                                    metadata.thumbnailLink ? <img src={metadata.thumbnailLink} alt=''/> :
                                        <span className='material-icons'>{icon}</span>
                            }
                        </span>
                        {metadata.name}
                    </span>
                ),
                key,
                canExpand: isFolder,
                disabled: !isFolder && !isJson && !(metadata.appProperties || metadata.properties)
            };
        }
    }, [files.fileMetadata, files.roots]);

    return loadingBundle ? (
        <div>
            Loading...
        </div>
    ) : (
        <RenameFileEditor
            metadata={props.metadata}
            onClose={props.onClose}
            getSaveMetadata={props.getSaveMetadata}
            onSave={onSave}
        >
            <TreeViewSelect
                roots={FOLDER_ROOTS}
                items={files.fileMetadata}
                itemChildren={files.children}
                renderItem={renderItem}
                loading={loading}
                onExpand={async (key: string, expanded: boolean) => {
                    if (expanded) {
                        setLoading((prevState) => ({...prevState, [key]: true}));
                        await fileAPI.loadFilesInFolder(key, (files: FileMetadata[]) => {
                            dispatch(addFilesAction(files));
                        });
                        setLoading((prevState) => ({...prevState, [key]: false}));
                    }
                }}
                selected={selected}
                setSelected={onSetSelected}
            />
        </RenameFileEditor>
    )
}

export default BundleFileEditor;

function markSelected(selected: {[metadataId: string]: boolean}, metadataIds: string[] = [], value = true) {
    for (let metadataId of metadataIds) {
        selected[metadataId] = value;
    }
}

function handleFailingMetadata(metadataIds: string[], loadedMetadata: FileMetadata[], selected: {[p: string]: {[p: string]: boolean}}) {
    // Handle if any of the metadata failed to load.
    const failedMetadataIds = metadataIds.filter((_, index) => (!loadedMetadata[index]));
    if (failedMetadataIds.length > 0) {
        Object.keys(selected).forEach((root) => {
            Object.keys(selected[root]).forEach((metadataId) => {
                if (failedMetadataIds.indexOf(metadataId) >= 0) {
                    delete(selected[root][metadataId]);
                }
            });
        })
    }
}
