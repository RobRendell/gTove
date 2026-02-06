import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import RenameFileEditor, {RenameFileEditorProps} from './renameFileEditor';
import TreeViewSelect, {TreeViewSelectItem} from './treeViewSelect';
import {getAllFilesFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import * as constants from '../util/constants';
import {addFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {AnyAppProperties, FileMetadata} from '../util/storage/storageContract';
import { isWebLinkProperties } from '../util/storage/storageUtils';
import {buildBundleJson, BundleType} from '../util/bundleUtils';
import {getAllScenarioMetadataIds} from '../util/scenarioUtils';

import './bundleFileEditor.scss';
import { FileAPIContext } from '../util/storage/storageContract';

interface BundleFileEditorProps extends RenameFileEditorProps<AnyAppProperties, void>, GtoveDispatchProp {
    files: FileIndexReducerType
}

interface BundleFileEditorState {
    loadingBundle: boolean;
    saving: boolean;
    loading: {[key: string]: boolean};
    selected: {[root: string]: {[key: string]: boolean}};
}

class BundleFileEditor extends React.Component<BundleFileEditorProps, BundleFileEditorState> {

    static FOLDER_ROOTS = [
        constants.FOLDER_SCENARIO,
        constants.FOLDER_MAP,
        constants.FOLDER_MINI
    ];

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    context: FileAPIContext;

    constructor(props: BundleFileEditorProps) {
        super(props);
        this.renderItem = this.renderItem.bind(this);
        this.onSave = this.onSave.bind(this);
        this.onSetSelected = this.onSetSelected.bind(this);
        this.state = {
            loadingBundle: true,
            saving: false,
            loading: {},
            selected: {}
        };
    }

    private markSelected(selected: {[metadataId: string]: boolean}, metadataIds: string[] = [], value = true) {
        for (let metadataId of metadataIds) {
            selected[metadataId] = value;
        }
    }

    async componentDidMount() {
        // Select all the existing items saved in the bundle - this potentially requires loading a lot of stuff from Drive.
        let selected: {[root: string]: {[key: string]: boolean}};
        let missingMetadataIds: string[];
        const bundle = await this.context.fileAPI.getJsonFileContents(this.props.metadata) as BundleType;
        // Mark the current items from the bundle as selected.
        selected = BundleFileEditor.FOLDER_ROOTS.reduce((selected, root) => ({...selected, [root]: {}}), {});
        this.markSelected(selected[constants.FOLDER_MAP], bundle.driveMaps);
        this.markSelected(selected[constants.FOLDER_MINI], bundle.driveMinis);
        this.markSelected(selected[constants.FOLDER_SCENARIO],
            Object.keys(bundle.scenarios || {}).map((scenarioName) => (bundle.scenarios[scenarioName].metadataId)));
        // Load the metadata for the selected items.
        const allMetadataIds = BundleFileEditor.FOLDER_ROOTS.reduce<string[]>((all, root) => ([...all, ...Object.keys(selected[root])]), []);
        missingMetadataIds = allMetadataIds.filter((metadataId) => (!this.props.files.fileMetadata[metadataId]));
        const loadedMetadata = await this.ensureAllMetadata(missingMetadataIds);
        this.handleFailingMetadata(missingMetadataIds, loadedMetadata, selected);
        this.setState({selected});
        // Load the ancestor directories of the selected items, up to the root.
        for (let rootId of BundleFileEditor.FOLDER_ROOTS) {
            await this.loadAllDirectoriesToRoot(this.props.files.roots[rootId], Object.keys(selected[rootId]));
        }
        this.setState({loadingBundle: false});
    }

    private handleFailingMetadata(metadataIds: string[], loadedMetadata: FileMetadata[], selected: {[p: string]: {[p: string]: boolean}}) {
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

    async ensureAllMetadata(missingMetadataIds: string[]): Promise<FileMetadata[]> {
        const allMetadata = [];
        const loadedMetadata = [];
        for (let metadataId of missingMetadataIds) {
            const missingMetadata = !this.props.files.fileMetadata[metadataId];
            const metadata = missingMetadata ? await this.context.fileAPI.getFullMetadata(metadataId) : this.props.files.fileMetadata[metadataId];
            allMetadata.push(metadata);
            if (missingMetadata) {
                loadedMetadata.push(metadata);
            }
        }
        this.props.dispatch(addFilesAction(loadedMetadata));
        return allMetadata;
    }

    async loadAllDirectoriesToRoot(rootMetadataId: string, itemMetadataIds: string[]) {
        if (itemMetadataIds.length === 0) {
            await this.context.fileAPI.loadFilesInFolder(rootMetadataId, (files: FileMetadata[]) => {this.props.dispatch(addFilesAction(files))})
        }
        let directoryIdMap: Record<string, boolean> = {};
        let toCheck = itemMetadataIds;
        // Follow the parents of each item in toCheck up to the root, loading their metadata if required.
        while (toCheck.length > 0) {
            const missingDirectoryIds = toCheck.reduce((missing: string[], metadataId) => {
                if (metadataId !== rootMetadataId && this.props.files.fileMetadata[metadataId]) {
                    this.props.files.fileMetadata[metadataId].parents.forEach((parentId: string) => {
                        directoryIdMap[parentId] = true;
                        if (!this.props.files.fileMetadata[parentId]) {
                            missing.push(parentId);
                        }
                    });
                }
                return missing;
            }, []);
            const missingDirectoryMetadata = await this.ensureAllMetadata(missingDirectoryIds);
            toCheck = missingDirectoryMetadata.map((metadata) => (metadata.id));
        }
        // Now load the directory contents of all the directories containing the items and their ancestors.
        for (let directoryId of Object.keys(directoryIdMap)) {
            await this.context.fileAPI.loadFilesInFolder(directoryId, (files: FileMetadata[]) => {
                this.props.dispatch(addFilesAction(files));
            });
        }
    }

    async onSave(metadata: FileMetadata): Promise<FileMetadata> {
        const bundleJson = await buildBundleJson(this.context.fileAPI,
            metadata.name,
            Object.keys(this.state.selected[constants.FOLDER_SCENARIO]),
            Object.keys(this.state.selected[constants.FOLDER_MAP]),
            Object.keys(this.state.selected[constants.FOLDER_MINI])
        );
        return await this.context.fileAPI.saveJsonToFile(metadata.id, bundleJson);
    }

    async onSetSelected(root: string, key: string, value: boolean) {
        this.setState((state) => {
            return {selected: {...state.selected, [root]: {...state.selected[root], [key]: value}}};
        });
        if (root === constants.FOLDER_SCENARIO) {
            // automatically de/select maps and minis in the scenario
            const scenario = await this.context.fileAPI.getJsonFileContents({id: key});
            await this.ensureAllMetadata(getAllScenarioMetadataIds(scenario));
            this.setState((state) => {
                const result = {
                    selected: {
                        ...state.selected,
                        [constants.FOLDER_MAP]: {...state.selected[constants.FOLDER_MAP]},
                        [constants.FOLDER_MINI]: {...state.selected[constants.FOLDER_MINI]}
                    }
                };
                this.markSelected(result.selected[constants.FOLDER_MAP],
                    Object.keys(scenario.maps).map((mapId) => (scenario.maps[mapId].metadata.id)), value);
                this.markSelected(result.selected[constants.FOLDER_MINI],
                    Object.keys(scenario.minis).map((miniId) => (scenario.minis[miniId].metadata.id)), value);
                return result;
            })
        }
    }

    renderItem(root: string, key?: string): TreeViewSelectItem {
        if (!key) {
            return {sortLabel: '', element: (<span>{root}</span>), key: this.props.files.roots[root], canExpand: true, disabled: false};
        } else {
            const metadata = this.props.files.fileMetadata[key];
            const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
            const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
            const icon = isFolder ? 'folder' : (isJson ? (root === constants.FOLDER_SCENARIO ? 'photo' : 'cloud') : null);
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
    }

    render() {
        return this.state.loadingBundle ? (
            <div>
                Loading...
            </div>
        ) : this.state.saving ? (
            <div>
                Saving...
            </div>
        ) : (
            <RenameFileEditor
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.props.getSaveMetadata}
                onSave={this.onSave}
            >
                <TreeViewSelect
                    roots={BundleFileEditor.FOLDER_ROOTS}
                    items={this.props.files.fileMetadata}
                    itemChildren={this.props.files.children}
                    renderItem={this.renderItem}
                    loading={this.state.loading}
                    onExpand={(key: string, expanded: boolean) => {
                        if (expanded) {
                            this.setState((state) => ({loading: {...state.loading, [key]: true}}));
                            return this.context.fileAPI.loadFilesInFolder(key, (files: FileMetadata[]) => {this.props.dispatch(addFilesAction(files))})
                                .then(() => {
                                    this.setState((state) => ({loading: {...state.loading, [key]: false}}));
                                });
                        } else {
                            return Promise.resolve();
                        }
                    }}
                    selected={this.state.selected}
                    setSelected={this.onSetSelected}
                />
            </RenameFileEditor>
        )
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store)
    }
}

export default connect(mapStoreToProps)(BundleFileEditor);