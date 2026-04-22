import './tabletopTapMenu.scss';

import omit from 'lodash/omit';
import takeWhile from 'lodash/takeWhile';
import {
    createContext,
    FunctionComponent, memo,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {useSelector, useStore} from 'react-redux';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {isRayCastIntersectMap, isRayCastIntersectMini, RayCastIntersect} from '../hooks/useRaycast';
import {getScenarioFromStore, getTabletopFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {SAME_LEVEL_MAP_DELTA_Y} from '../util/constants';
import {getPieceName, ObjectVector2} from '../util/scenarioUtils';
import {compareAlphanumeric} from '../util/stringUtils';
import {
    BaseTapMenuFunctionContext,
    TabletopTapMenuList,
    TabletopTapMenuSelection,
    TapMenuFunctionContext,
    TapMenuOption,
    TapMenuOptionButton
} from '../util/tapMenuTypes';
import {isDefined} from '../util/typescriptUtils';
import InputButton from './inputButton';
import StayInsideContainer from './stayInsideContainer';
import {TabletopViewGestureContext} from './tabletopViewComponent';

const TabletopTapMenuContextObject = createContext<null | {
    registerTapMenuList: (arg: string | TabletopTapMenuList) => void;
    setTapMenuSelection: (list?: TabletopTapMenuSelection) => void;
    gestureHandler: GestureHandler<TabletopViewGestureContext>;
}>(null);

function isTapMenuOptionButton<Intersect extends RayCastIntersect>(option: TapMenuOption<Intersect>): option is TapMenuOptionButton<Intersect> {
    return 'label' in option && 'title' in option && 'onClick' in option;
}

function renderMenuOption<Intersect extends RayCastIntersect>(option: TapMenuOption<Intersect>, context: TapMenuFunctionContext<Intersect>, closeMenu: () => void) {
    return (option.show && !option.show(context)) ? null
        : isTapMenuOptionButton(option) ? (
            <InputButton type='button' tooltip={option.title} onChange={() => {
                option.onClick(context);
                if (!option.keepOpenOnClick) {
                    closeMenu();
                }
            }}>
                {option.label}
            </InputButton>
        ) : (
            option.render(context)
        )
}

interface TabletopTapMenuProps extends PropsWithChildren {
    disableTapMenu?: boolean;
    userIsGM: boolean;
}

const TabletopTapMenu: FunctionComponent<TabletopTapMenuProps> = memo(({disableTapMenu, userIsGM, children}) => {
    const store = useStore();
    const scenario = useSelector(getScenarioFromStore);
    const tabletop = useSelector(getTabletopFromStore);

    const [tapMenuLists, setTapMenuLists] = useState<{[key: string]: TabletopTapMenuList}>({});
    const [tapMenuSelection, setTapMenuSelection] = useState<TabletopTapMenuSelection | undefined>();
    const [tapIntersect, setTapIntersect] = useState<RayCastIntersect | undefined>();

    const gestureContextRef = useRef<TabletopViewGestureContext | undefined>();

    const closeMenu = useCallback(() => {
        setTapMenuSelection(undefined);
        setTapIntersect(undefined);
    }, []);
    
    const selectValidIntersect = useCallback((state: ReduxStoreType) => (
        isRayCastIntersectMap(tapIntersect) ? getScenarioFromStore(state).maps[tapIntersect.mapId] !== undefined
            : isRayCastIntersectMini(tapIntersect) ? getScenarioFromStore(state).minis[tapIntersect.miniId] !== undefined
                : true
    ), [tapIntersect]);
    const isValid = useSelector(selectValidIntersect);
    const {dragMode} = useSelector(getTabletopStateFromStore);
    useEffect(() => {
        if (!isValid || dragMode) {
            closeMenu();
        }
    }, [closeMenu, dragMode, isValid]);

    // Gesture handling
    const match = useCallback((context: TabletopViewGestureContext) => {
        gestureContextRef.current = context;
        return false;
    }, []);
    const onTap = useCallback((position: ObjectVector2) => {
        if (disableTapMenu || !gestureContextRef.current) {
            return;
        }
        const {allIntersects, dragHandle} = gestureContextRef.current;
        if (allIntersects.length === 0) {
            return;
        }
        const {dragMode} = getTabletopStateFromStore(store.getState());
        const firstIntersect = allIntersects[0];
        if (dragHandle && dragMode) {
            const match = Object.values(tapMenuLists).find((list) => (list.dragHandle?.[dragMode]));
            if (match?.dragHandle?.[dragMode]) {
                setTapMenuSelection({
                    label: match.dragHandle[dragMode].label,
                    position: firstIntersect.position,
                    options: match.dragHandle[dragMode].options
                });
            }
            return;
        }
        const sameType = takeWhile(allIntersects, (intersect) => (
            (firstIntersect.type === intersect.type &&
                (firstIntersect.type === 'miniId' || firstIntersect.point.distanceToSquared(intersect.point) < SAME_LEVEL_MAP_DELTA_Y * SAME_LEVEL_MAP_DELTA_Y))
        ));
        const scenario = getScenarioFromStore(store.getState());
        const tabletop = getTabletopFromStore(store.getState());
        if (sameType.length > 1 && firstIntersect.type !== 'dieRollId') {
            // Tap disambiguation
            setTapMenuSelection({
                label: 'Which do you want to select?',
                position,
                options: sameType
                    .map((intersect) => {
                        const name = intersect.type === 'mapId' ? scenario.maps[intersect.mapId].name
                            : intersect.type === 'miniId' ? getPieceName(intersect.miniId, scenario.minis, tabletop.piecesRosterColumns)
                                : undefined;
                        return !name ? undefined : {
                            label: name,
                            title: 'Select ' + name,
                            onClick: () => {
                                const match = Object.values(tapMenuLists).find((list) => (
                                    list.intersect && (!list.intersect.match || list.intersect.match(intersect))
                                ));
                                setTapIntersect(intersect);
                                setTapMenuSelection((previous) => (!match?.intersect ? undefined : {
                                    label: match.intersect!.label,
                                    position: previous!.position,
                                    options: match.intersect.options
                                }));
                            },
                            keepOpenOnClick: true
                        };
                    })
                    .filter(isDefined)
                    .sort((o1, o2) => (compareAlphanumeric(o1.label, o2.label)))
            })
        } else {
            const match = Object.values(tapMenuLists).find((list) => (
                list.intersect && (!list.intersect.match || list.intersect.match(firstIntersect))
            ));
            setTapIntersect(firstIntersect);
            setTapMenuSelection(!match?.intersect ? undefined : {
                label: match.intersect.label,
                position,
                options: match.intersect.options,
            });
        }
    }, [disableTapMenu, store, tapMenuLists]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'tabletop-tap-menu',
        priority: 30,
        default: true,
        match,
        onTap
    }), [match, onTap]);

    const optionElements = useMemo(() => {
        if (!tapMenuSelection) {
            return undefined;
        }
        const intersect = tapIntersect;
        const base: BaseTapMenuFunctionContext = {
            userIsGM,
            scenario,
            tabletop,
            store,
        };
        const context = isRayCastIntersectMap(intersect) ? {...base, intersect, map: scenario.maps[intersect.mapId]}
            : isRayCastIntersectMini(intersect) ? {...base, intersect, mini: scenario.minis[intersect.miniId]}
                : base;
        if (tapMenuSelection.options.length === 1 && 'onClick' in tapMenuSelection.options[0] && tapMenuSelection.options[0].autoExecuteSingleOption) {
            tapMenuSelection.options[0].onClick(context as any);
            closeMenu();
            return undefined;
        }
        return tapMenuSelection.options.map((option) => (renderMenuOption(option, context, closeMenu)))
            .filter(isDefined);
    }, [closeMenu, scenario, store, tabletop, tapIntersect, tapMenuSelection, userIsGM]);

    const registerTapMenuList = useCallback((arg: string | TabletopTapMenuList) => {
        setTapMenuLists((prev) => (
            typeof arg === 'string' ? omit(prev, arg)
                : prev[arg.id] === arg ? prev : {...prev, [arg.id]: arg}
        ))
    }, []);

    const contextValue = useMemo(() => ({
        registerTapMenuList,
        setTapMenuSelection,
        gestureHandler
    }), [gestureHandler, registerTapMenuList]);

    return (
        <>
            <TabletopTapMenuContextObject.Provider value={contextValue}>
                {children}
            </TabletopTapMenuContextObject.Provider>
            {
                !tapMenuSelection || !optionElements?.length ? null : (
                    <StayInsideContainer className='tabletopTapMenu'
                                         top={tapMenuSelection.position.y + 10}
                                         left={tapMenuSelection.position.x + 10}
                    >
                        {
                            !tapMenuSelection.label ? null : (
                                <div className='menuSelectedTitle'>{tapMenuSelection.label}</div>
                            )
                        }
                        <div className='menuCancel' onClick={closeMenu} onTouchStart={closeMenu}>&times;</div>
                        <div className='scrollable'>
                            {
                                optionElements
                                    .map((Option, index) => (
                                        !Option ? null : <div key={'menuButton' + index}>{Option}</div>
                                    ))
                            }
                        </div>
                    </StayInsideContainer>
                )
            }
        </>
    );
});

export default TabletopTapMenu;

export function useTapMenu<Intersect extends RayCastIntersect>(list: TabletopTapMenuList<Intersect>) {
    const contextValue = useContext(TabletopTapMenuContextObject);
    if (!contextValue) {
        throw new Error('Call useTapMenu from inside a TabletopTapMenu provider');
    }
    const {registerTapMenuList} = contextValue;
    useEffect(() => {
        registerTapMenuList(list as unknown as TabletopTapMenuList);
        return () => {
            registerTapMenuList(list.id);
        }
    }, [registerTapMenuList, list]);
}

export function useSetTapMenuSelection() {
    const contextValue = useContext(TabletopTapMenuContextObject);
    if (!contextValue) {
        throw new Error('Call useSetSelectedMenuList from inside a TabletopTapMenu provider');
    }
    return contextValue.setTapMenuSelection;
}

export function TabletopTapMenuGestureHandler() {
    const contextValue = useContext(TabletopTapMenuContextObject);
    if (!contextValue) {
        throw new Error('Call TabletopTapMenuGestureHook from inside a TabletopTapMenu provider');
    }
    useGestureHandler(contextValue.gestureHandler);
    return null;
}