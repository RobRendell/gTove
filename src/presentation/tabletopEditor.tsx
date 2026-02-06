import {FunctionComponent, useCallback, useContext, useState} from 'react';
import {useGranularEffect} from 'granular-hooks';
import {useDispatch, useSelector} from 'react-redux';
import {randomBytes} from 'crypto';

import './tabletopEditor.scss';

import RenameFileEditor, {RenameFileEditorProps} from './renameFileEditor';
import {
    DistanceMode,
    distanceModeStrings,
    DistanceRound,
    distanceRoundStrings,
    jsonToScenarioAndTabletop,
    ScenarioType,
    TabletopType
} from '../util/scenarioUtils';
import { AnyProperties, FileMetadata, GridType, TabletopFileAppProperties } from '../util/storage/storageContract';
import { getAllFilesFromStore, getTabletopIdFromStore } from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import InputField from './inputField';
import InputButton from './inputButton';
import HelpButton from './helpButton';
import PiecesRosterConfiguration from './piecesRosterConfiguration';
import EnumSelect from './enumSelect';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import LabelSizeSlider from './labelSizeSlider';

const defaultGridStrings = {
    [GridType.NONE]: undefined,
    [GridType.SQUARE]: 'Squares',
    [GridType.HEX_VERT]: 'Hexagons (Vertical)',
    [GridType.HEX_HORZ]: 'Hexagons (Horizontal)'
};

type TabletopEditorProps = RenameFileEditorProps<TabletopFileAppProperties, AnyProperties>;

const TabletopEditor: FunctionComponent<TabletopEditorProps> = ({metadata, onClose}) => {
    const dispatch = useDispatch();
    const tabletopId = useSelector(getTabletopIdFromStore);
    const files = useSelector(getAllFilesFromStore);
    const fileAPI = useContext(FileAPIContextObject);

    const [tabletop, setTabletop] = useState<TabletopType | null>(null);

    useGranularEffect(() => {
        if (metadata.appProperties) {
            // If we own this tabletop, we need to load the private tabletop to get gmSecret
            const metadataId = metadata.appProperties.gmFile;
            fileAPI.getJsonFileContents({id: metadataId})
                .then((combined: ScenarioType & TabletopType) => {
                    const [, tabletop] = jsonToScenarioAndTabletop(combined, files.fileMetadata);
                    if (!tabletop.gmSecret) {
                        // since we weren't loading the private tabletop before, the gmSecret may have been lost with previous editing.
                        tabletop.gmSecret = randomBytes(48).toString('hex');
                    }
                    setTabletop(tabletop);
                })
        } else {
            // Tabletop is owned by someone else, we can only edit the name
            fileAPI.getJsonFileContents(metadata)
                .then((combined: ScenarioType & TabletopType) => {
                    const [, tabletop] = jsonToScenarioAndTabletop(combined, files.fileMetadata);
                    setTabletop(tabletop);
                });
        }
    }, [metadata], [fileAPI, files.fileMetadata]);

    const getSaveMetadata = useCallback(() => (
        // If we don't own this tabletop, still allow RenameFileEditor to save the updated name.
        (!metadata.appProperties) ? metadata : {}
    ), [metadata]);
    
    const onSave = useCallback(async (gmFileMetadata: FileMetadata) => {
        if (!metadata.appProperties) {
            // We don't own this tabletop
        } else if (tabletop && metadata.id === tabletopId) {
            // If current, can just dispatch Redux actions to update the tabletop live.
            dispatch(updateTabletopAction(tabletop));
        } else {
            // Otherwise, merge changes with public and private tabletop files.
            const combined = await fileAPI.getJsonFileContents(metadata);
            await fileAPI.saveJsonToFile(metadata.id, {...combined, ...tabletop, gmSecret: undefined});
            const gmOnly = await fileAPI.getJsonFileContents(gmFileMetadata);
            await fileAPI.saveJsonToFile(gmFileMetadata.id, {...gmOnly, ...tabletop});
        }
    }, [dispatch, fileAPI, metadata, tabletop, tabletopId]);

    const onLabelSizeChange = useCallback((defaultLabelSize: number) => {
        setTabletop((tabletop) => {
            if (!tabletop) {
                throw new Error('Cannot set label size on undefined tabletop');
            }
            return {...tabletop, defaultLabelSize};
        });
    }, []);
    
    return (
        <RenameFileEditor
            className='tabletopEditor'
            metadata={metadata}
            onClose={onClose}
            getSaveMetadata={getSaveMetadata}
            onSave={onSave}
        >
            {
                !tabletop ? (
                    <span>Loading...</span>
                ) : !metadata.appProperties ? (
                    <div>
                        This is a shortcut to a tabletop belonging to {metadata.owners?.length ?
                        metadata.owners[0].displayName : 'someone else'}. You can only edit the name of
                        your shortcut.
                    </div>
                ) : (
                    <div>
                        <fieldset>
                            <legend>Tabletop defaults</legend>
                            <div className='gridDefault'>
                                <label>Default grid on tabletop is</label>
                                <EnumSelect
                                    containingObject={tabletop}
                                    fieldName='defaultGrid'
                                    enumObject={GridType}
                                    labels={defaultGridStrings}
                                    defaultValue={GridType.SQUARE}
                                    onChange={setTabletop}
                                />
                            </div>
                            <div className='gridScaleDiv'>
                                <label>{tabletop.defaultGrid === GridType.SQUARE ? 'One grid square is' : 'Distance from one hexagon to the next is'}</label>
                                <InputField type='number' initialValue={tabletop.gridScale || 0} onChange={(value) => {
                                    setTabletop({...tabletop, gridScale: Number(value) || undefined});
                                }}
                                />
                                <InputField type='text' initialValue={tabletop.gridUnit || ''} onChange={(value) => {
                                    setTabletop({...tabletop, gridUnit: String(value) || undefined});
                                }} placeholder='Units e.g. foot/feet, meter/meters'
                                />
                            </div>
                            <div className='gridDiagonalDiv'>
                                <label>Measure distance</label>
                                <EnumSelect
                                    containingObject={tabletop}
                                    fieldName='distanceMode'
                                    enumObject={DistanceMode}
                                    labels={distanceModeStrings}
                                    defaultValue={DistanceMode.STRAIGHT}
                                    onChange={setTabletop}
                                />
                            </div>
                            <div className='gridRoundDiv'>
                                <label>Distances are</label>
                                <EnumSelect
                                    containingObject={tabletop}
                                    fieldName='distanceRound'
                                    enumObject={DistanceRound}
                                    labels={distanceRoundStrings}
                                    defaultValue={DistanceRound.ROUND_OFF}
                                    onChange={setTabletop}
                                />
                            </div>
                            <div className='defaultLabelSizeDiv'>
                                <label>Default label sizes</label>
                                <div className='sliderWrapper'>
                                    <LabelSizeSlider labelSize={tabletop.defaultLabelSize ?? 0.35}
                                                     setLabelSize={onLabelSizeChange}
                                    />
                                </div>
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend>Permissions</legend>
                            <div className='permissionsDiv'>
                                <label>Restrict who may connect to this tabletop</label>
                                <InputButton type='checkbox' selected={tabletop.tabletopUserControl !== undefined} onChange={() => {
                                    setTabletop({
                                        ...tabletop,
                                        tabletopUserControl: tabletop!.tabletopUserControl === undefined
                                            ? {whitelist: [], blacklist: []} : undefined
                                    });
                                }}/>
                            </div>
                            {
                                tabletop?.tabletopUserControl === undefined ? null : (
                                    <>
                                        <div>
                                            Enter email addresses (separated by spaces) or * to control who may
                                            connect to this tabletop.
                                            <HelpButton>
                                                <>
                                                    <p>
                                                        A player whose email address appears on the whitelist is
                                                        allowed to join the tabletop. Anyone with an email address
                                                        on the blacklist will be automatically rejected. Enter the
                                                        wildcard character * to match anyone not on the other
                                                        list... for example, putting * in the blacklist will mean
                                                        no-one other than the emails in the whitelist can join.
                                                    </p>
                                                    <p>
                                                        If a user connects who doesn't match either list, the GM
                                                        will be prompted that such-and-such user is attempting to
                                                        connect, and given options to allow or deny them. The
                                                        whitelist or blacklist will be updated automatically based
                                                        on the response. You can use this to more easily populate
                                                        the whitelist, and then set the blacklist to * to prevent
                                                        anyone else connecting.
                                                    </p>
                                                </>
                                            </HelpButton>
                                        </div>
                                        <div className='permissionsDiv indented'>
                                            <label>Whitelist:</label>
                                            <textarea
                                                value={tabletop.tabletopUserControl!.whitelist.join(' ')}
                                                placeholder='Email addresses of players allowed to join'
                                                onChange={(evt) => {
                                                    const tabletopUserControl = tabletop!.tabletopUserControl!;
                                                    setTabletop({
                                                        ...tabletop,
                                                        tabletopUserControl: {
                                                            ...tabletopUserControl,
                                                            whitelist: evt.target.value.split(/,? +/)
                                                        }
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className='permissionsDiv indented'>
                                            <label>Blacklist:</label>
                                            <textarea
                                                value={tabletop.tabletopUserControl!.blacklist.join(' ')}
                                                placeholder='Email addresses of people who cannot join'
                                                onChange={(evt) => {
                                                    const tabletopUserControl = tabletop!.tabletopUserControl!;
                                                    setTabletop({
                                                        ...tabletop,
                                                        tabletopUserControl: {
                                                            ...tabletopUserControl,
                                                            blacklist: evt.target.value.split(/,? +/)
                                                        }
                                                    });
                                                }}
                                            />
                                        </div>
                                    </>
                                )
                            }
                            <div className='permissionsDiv'>
                                <label>Only the GM may ping the map (long-press)</label>
                                <InputButton type='checkbox' selected={tabletop.gmOnlyPing} onChange={() => {
                                    setTabletop({...tabletop, gmOnlyPing: !tabletop.gmOnlyPing});
                                }}/>
                            </div>
                            <div className='permissionsDiv'>
                                <label>Limit the maximum number of dice rolled in a single pool</label>
                                <InputButton type='checkbox' selected={tabletop.dicePoolLimit !== undefined} onChange={() => {
                                    setTabletop({...tabletop, dicePoolLimit: tabletop.dicePoolLimit === undefined ? 50 : undefined});
                                }}/>
                            </div>
                            {
                                tabletop?.dicePoolLimit === undefined ? null : (
                                    <div className='permissionsDiv indented'>
                                        <label>Maximum number of dice:</label>
                                        <InputField type='number' value={tabletop.dicePoolLimit} onChange={(dicePoolLimit) => {
                                            setTabletop({...tabletop, dicePoolLimit});
                                        }}/>
                                    </div>
                                )
                            }
                        </fieldset>
                        <fieldset>
                            <legend>Pieces Roster Columns</legend>
                            <PiecesRosterConfiguration columns={tabletop.piecesRosterColumns} setColumns={(piecesRosterColumns) => {
                                setTabletop({...tabletop, piecesRosterColumns})
                            }}/>
                        </fieldset>
                    </div>
                )
            }
        </RenameFileEditor>
    );
};

export default TabletopEditor;