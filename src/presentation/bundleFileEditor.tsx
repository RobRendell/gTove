import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Dispatch} from 'redux';
import {connect} from 'react-redux';

import {FileAPIContext} from '../util/fileUtils';
import RenameFileEditor, {RenameFileEditorProps} from './renameFileEditor';
import TreeViewSelect, {TreeViewSelectItem} from './treeViewSelect';
import {getAllFilesFromStore, ReduxStoreType} from '../redux/mainReducer';
import * as constants from '../util/constants';
import {addFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {DriveMetadata} from '../util/googleDriveUtils';

import './bundleFileEditor.css';
import {buildBundleJson, BundleType} from '../util/bundleUtils';
import {ScenarioType} from '../@types/scenario';
import {getAllScenarioMetadataIds} from '../util/scenarioUtils';

interface BundleFileEditorProps extends RenameFileEditorProps {
    dispatch: Dispatch<ReduxStoreType>;
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

    componentDidMount() {
        // Select all the existing items saved in the bundle - this potentially requires loading a lot of stuff from Drive.
        let selected: {[root: string]: {[key: string]: boolean}};
        this.context.fileAPI.getJsonFileContents(this.props.metadata)
            .then((bundle: BundleType) => {
                // Mark the current items from the bundle as selected.
                selected = BundleFileEditor.FOLDER_ROOTS.reduce((selected, root) => ({...selected, [root]: {}}), {});
                (bundle.driveMaps || []).forEach((mapId) => {selected[constants.FOLDER_MAP][mapId] = true});
                (bundle.driveMinis || []).forEach((miniId) => {selected[constants.FOLDER_MINI][miniId] = true});
                Object.keys(bundle.scenarios || {}).forEach((scenarioName) => {selected[constants.FOLDER_SCENARIO][bundle.scenarios[scenarioName].metadataId] = true});
                this.setState({selected});
                // Load the metadata for the selected items.
                const allMetadataIds = BundleFileEditor.FOLDER_ROOTS.reduce((all, root) => ([...all, ...Object.keys(selected[root])]), []);
                return this.ensureAllMetadata(allMetadataIds);
            })
            .then(() => (
                // Load the ancestor directories of the selected items, up to the root.
                Promise.all(BundleFileEditor.FOLDER_ROOTS.map((root) => (
                    this.loadAllDirectoriesToRoot(this.props.files.roots[root], Object.keys(selected[root]))
                )))
            ))
            .then(() => {this.setState({loadingBundle: false})});
    }

    ensureAllMetadata(allMetadataIds: string[]): Promise<DriveMetadata[]> {
        const missingMetadataIds = allMetadataIds.filter((metadataId) => (!this.props.files.driveMetadata[metadataId]));
        return Promise
            .all(missingMetadataIds.map((metadataId) => (this.context.fileAPI.getFullMetadata(metadataId))))
            .then((missingMetadata) => {
                this.props.dispatch(addFilesAction(missingMetadata));
                return missingMetadata;
            });
    }

    async loadAllDirectoriesToRoot(rootMetadataId: string, itemMetadataIds: string[]) {
        let directoryIdMap = {};
        let toCheck = itemMetadataIds;
        // Follow the parents of each item in toCheck up to the root, loading their metadata if required.
        while (toCheck.length > 0) {
            const missingDirectoryIds = toCheck.reduce((missing: string[], metadataId) => {
                if (metadataId !== rootMetadataId) {
                    this.props.files.driveMetadata[metadataId].parents.forEach((parentId) => {
                        directoryIdMap[parentId] = true;
                        if (!this.props.files.driveMetadata[parentId]) {
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
        return await Promise.all(Object.keys(directoryIdMap).map((directoryId) => (
            this.context.fileAPI.loadFilesInFolder(directoryId, (files: DriveMetadata[]) => {this.props.dispatch(addFilesAction(files))})
        )));
    }

    onSave(metadata: DriveMetadata): Promise<DriveMetadata> {
        return buildBundleJson(this.context.fileAPI,
            metadata.name,
            Object.keys(this.state.selected[constants.FOLDER_SCENARIO]),
            Object.keys(this.state.selected[constants.FOLDER_MAP]),
            Object.keys(this.state.selected[constants.FOLDER_MINI])
        )
            .then((bundleJson) => (
                this.context.fileAPI.saveJsonToFile({id: metadata.id}, bundleJson)
            ));
    }

    onSetSelected(root: string, key: string, value: boolean) {
        this.setState((state) => {
            return {selected: {...state.selected, [root]: {...state.selected[root], [key]: value}}};
        });
        if (root === constants.FOLDER_SCENARIO) {
            // automatically de/select maps and minis in the scenario
            this.context.fileAPI.getJsonFileContents({id: key})
                .then((scenario: ScenarioType) => (
                    this.ensureAllMetadata(getAllScenarioMetadataIds(scenario))
                        .then(() => (scenario))
                ))
                .then((scenario: ScenarioType) => {
                    this.setState((state) => {
                        const result = {
                            selected: {
                                ...state.selected,
                                [constants.FOLDER_MAP]: {...state.selected[constants.FOLDER_MAP]},
                                [constants.FOLDER_MINI]: {...state.selected[constants.FOLDER_MINI]}
                            }
                        };
                        Object.keys(scenario.maps).forEach((mapId) => {
                            result.selected[constants.FOLDER_MAP][scenario.maps[mapId].metadata.id] = value;
                        });
                        Object.keys(scenario.minis).forEach((miniId) => {
                            result.selected[constants.FOLDER_MINI][scenario.minis[miniId].metadata.id] = value;
                        });
                        return result;
                    })
                });
        }
    }

    renderItem(root: string, key?: string): TreeViewSelectItem {
        if (!key) {
            return {sortLabel: '', element: (<span>{root}</span>), key: this.props.files.roots[root], canExpand: true};
        } else {
            const metadata = this.props.files.driveMetadata[key];
            const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
            const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
            const icon = isFolder ? 'folder' : (isJson ? (root === constants.FOLDER_SCENARIO ? 'photo' : 'cloud') : null);
            return {
                sortLabel: (isFolder ? '1' : '2') + metadata.name,
                element: (
                    <span className='bundleItem'>
                        <span className='itemIcon'>
                            {metadata.thumbnailLink ? <img src={metadata.thumbnailLink}/> : <span className='material-icons'>{icon}</span>}
                        </span>
                        {metadata.name}
                    </span>
                ),
                key, canExpand: isFolder};
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
                    items={this.props.files.driveMetadata}
                    itemChildren={this.props.files.children}
                    renderItem={this.renderItem}
                    loading={this.state.loading}
                    onExpand={(key: string, expanded: boolean) => {
                        if (expanded) {
                            this.setState((state) => ({loading: {...state.loading, [key]: true}}));
                            return this.context.fileAPI.loadFilesInFolder(key, (files: DriveMetadata[]) => {this.props.dispatch(addFilesAction(files))})
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