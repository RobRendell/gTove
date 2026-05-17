import {FunctionComponent, useContext, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {DropDownMenuClickParams} from '../presentation/dropDownMenu';
import GoogleAvatar from '../presentation/googleAvatar';
import TabletopEditor from '../presentation/tabletopEditor';
import {setTabletopIdAction} from '../redux/locationReducer';
import {getAllFilesFromStore, getLoggedInUserFromStore, getTabletopIdFromStore} from '../redux/mainReducer';
import {emptyScenario} from '../redux/scenarioReducer';
import {FOLDER_TABLETOP} from '../util/constants';
import {copyURLToClipboard, jsonToScenarioAndTabletop, ScenarioType, TabletopType} from '../util/scenarioUtils';
import {FileMetadata, TabletopFileAppProperties} from '../util/storage/storageContract';
import BrowseFilesComponent from './browseFilesComponent';

interface ScreenTabletopBrowserProps {
    onFinish: (callback?: () => void) => void;
    createNewTabletop: (parents: string[], name?: string, scenario?: ScenarioType, tabletop?: TabletopType) 
        => Promise<FileMetadata<TabletopFileAppProperties, void>>;
    isGM: boolean;
}

const ScreenTabletopBrowser: FunctionComponent<ScreenTabletopBrowserProps> = ({onFinish, createNewTabletop, isGM}) => {
    const dispatch = useDispatch();
    const tabletopId = useSelector(getTabletopIdFromStore);
    const files = useSelector(getAllFilesFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;
    const fileAPI = useContext(FileAPIContextObject);
    const tabletopName = tabletopId && files.fileMetadata[tabletopId]
        ? files.fileMetadata[tabletopId].name : 'current Tabletop';
    const tabletopSuffix = tabletopName.toLowerCase().indexOf('tabletop') >= 0 ? '' : ' Tabletop';
    const globalActions = useMemo(() => ([
        {label: 'Add Tabletop', createsFile: true, onClick: async (parents: string[]) => (createNewTabletop(parents))},
        {
            label: `Bookmark ${tabletopName}${tabletopSuffix}`,
            createsFile: true,
            onClick: async (parents: string[]) => {
                const tabletop = await fileAPI.getFullMetadata(tabletopId);
                return await fileAPI.createShortcut(tabletop, parents) as FileMetadata<TabletopFileAppProperties, void>;
            },
            hidden: !tabletopId || isGM || !fileAPI.supportsShortcuts
        }
    ]), [tabletopId, tabletopName, tabletopSuffix, fileAPI, createNewTabletop, isGM]);
    const fileActions = useMemo(() => ([
        {
            label: 'Open tabletop',
            onClick: (tabletopMetadata: FileMetadata<TabletopFileAppProperties, void>) => {
                if (!tabletopId) {
                    dispatch(setTabletopIdAction(tabletopMetadata.id, tabletopMetadata.name, tabletopMetadata.resourceKey));
                    onFinish();
                } else if (tabletopId !== tabletopMetadata.id) {
                    // pop out a new window/tab with the new tabletop
                    const newWindow = window.open(tabletopMetadata.id, '_blank');
                    newWindow && newWindow.focus();
                    onFinish();
                }
                return true;
            }
        },
        {
            label: 'Copy URL',
            onClick: (metadata: FileMetadata<TabletopFileAppProperties, void>) => {
                const copyUrl = () => {
                    copyURLToClipboard(metadata.id);
                    const name = metadata.name + (metadata.name.endsWith('abletop') ? '' : ' Tabletop');
                    toast(name + ' URL copied to clipboard.');
                };
                if (tabletopId) {
                    onFinish(copyUrl);
                } else {
                    copyUrl();
                }
            }
        },
        {
            label: 'Copy Tabletop...',
            onClick: async (metadata: FileMetadata<TabletopFileAppProperties, void>, params?: DropDownMenuClickParams) => {
                params?.setShowBusySpinner && params.setShowBusySpinner(true);
                // Read existing tabletop contents, and discard scenario
                const json = await fileAPI.getJsonFileContents(metadata);
                let [, tabletop] = jsonToScenarioAndTabletop(json, files.fileMetadata);
                tabletop = {...tabletop, gm: loggedInUser.emailAddress};
                // Save to a new tabletop, private and public
                const newMetadata = await createNewTabletop(metadata.parents, 'Copy of ' + metadata.name, emptyScenario, tabletop);
                params?.setShowBusySpinner && params.setShowBusySpinner(false);
                return {
                    postAction: 'edit',
                    metadata: newMetadata
                }
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [createNewTabletop, dispatch, fileAPI, files.fileMetadata, loggedInUser.emailAddress, onFinish, tabletopId]);
    return (
        <BrowseFilesComponent<TabletopFileAppProperties, void>
            topDirectory={FOLDER_TABLETOP}
            highlightMetadataId={tabletopId}
            onBack={tabletopId ? onFinish : fileAPI.signOutFromFileAPI}
            backLabel={tabletopId ? 'Finish' : 'Sign Out'}
            showSearch={false}
            allowUploadAndWebLink={false}
            allowMultiPick={false}
            globalActions={globalActions}
            fileActions={fileActions}
            editorComponent={TabletopEditor}
            screenInfo={
                <div className='browseFilesScreenInfo'>
                    <p>A Tabletop is a shared space that you and your players can view - everyone connected to
                        the same tabletop sees the same map and miniatures (although you as the GM may see
                        additional, hidden items).</p>
                    <p>You might want to create a Tabletop for each campaign that you GM, plus perhaps a
                        personal "working tabletop" where you can prepare scenarios out of sight of your
                        players.</p>
                </div>
            }
            jsonIcon={(metadata) => {
                const ownedByMe = metadata.owners && metadata.owners.some((owner) => (owner.me));
                return ownedByMe || !metadata.owners ? (
                    <div className='material-icons'>cloud</div>
                ) : (
                    <GoogleAvatar user={metadata.owners[0]}/>
                )
            }}
        />
    );
};

export default ScreenTabletopBrowser;