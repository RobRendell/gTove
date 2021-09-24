import {FunctionComponent, useContext, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {toast} from 'react-toastify';

import BrowseFilesComponent from './browseFilesComponent';
import {FOLDER_BUNDLE} from '../util/constants';
import {DriveMetadata} from '../util/googleDriveUtils';
import BundleFileEditor from '../presentation/bundleFileEditor';
import {getAllFilesFromStore, getFolderStacksFromStore} from '../redux/mainReducer';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {copyURLToClipboard} from '../util/scenarioUtils';

interface ScreenBundleBrowserProps {
    onFinish: (callback?: () => void) => void;
}

const ScreenBundleBrowser: FunctionComponent<ScreenBundleBrowserProps> = ({onFinish}) => {
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const folderStacks = useSelector(getFolderStacksFromStore);
    const fileAPI = useContext(FileAPIContextObject);
    const globalActions = useMemo(() => ([
        {
            label: 'Add bundle',
            createsFile: true,
            onClick: async (parents: string[]) => {
                const metadata = await fileAPI.saveJsonToFile({name: 'New Bundle', parents}, {});
                await fileAPI.makeFileReadableToAll(metadata);
                return metadata;
            }
        }
    ]), [fileAPI]);
    const fileActions = useMemo(() => ([
        {
            label: 'Copy URL',
            onClick: (metadata: DriveMetadata) => {
                onFinish(() => {
                    copyURLToClipboard(metadata.id);
                    toast('Bundle URL copied to clipboard.');
                });
            }
        },
        {label: 'Edit', onClick: 'edit' as const},
        {label: 'Select', onClick: 'select' as const},
        {label: 'Delete', onClick: 'delete' as const}
    ]), [onFinish]);
    return (
        <BrowseFilesComponent
            files={files}
            dispatch={dispatch}
            topDirectory={FOLDER_BUNDLE}
            folderStack={folderStacks[FOLDER_BUNDLE]}
            onBack={onFinish}
            showSearch={false}
            allowUploadAndWebLink={false}
            allowMultiPick={false}
            globalActions={globalActions}
            fileActions={fileActions}
            editorComponent={BundleFileEditor}
            jsonIcon='photo_library'
            screenInfo={
                <div className='browseFilesScreenInfo'>
                    <p>Bundles are used to create "content packs" for gTove, allowing you to transfer gTove objects
                        to other users.  You select some of your maps, minis and scenarios to add to the bundle, and
                        gTove will assign the bundle a unique URL.  When another GM accesses a bundle URL, shortcuts
                        to the contents of the bundle in your Drive will be created in their Drive, ready for them
                        to use in gTove.</p>
                    <p>Note that you do not need to define bundles to share a tabletop and its contents with your
                        players.  Bundles are only needed if you want to share content with other GMs.</p>
                    <p>Please ensure you respect the copyright of any images you share using bundles.</p>
                </div>
            }
        />
    );
};

export default ScreenBundleBrowser;