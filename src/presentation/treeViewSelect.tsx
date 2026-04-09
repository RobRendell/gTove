import './treeViewSelect.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useEffect, useState} from 'react';

import Spinner from './spinner';

export interface TreeViewSelectItem {
    key: string;
    sortLabel: string;
    element: React.ReactElement<any>;
    canExpand?: boolean;
    disabled?: boolean;
}

interface TreeViewSelectProps {
    className?: string;
    roots: string[];
    items: {[key: string]: {parents: string[]}}
    itemChildren: {[key: string]: string[]};
    renderItem: (root: string, key?: string) => TreeViewSelectItem;
    onExpand?: (key: string, expanded: boolean) => Promise<void>;
    selected: {[root: string]: {[key: string]: boolean}};
    setSelected: (root: string, key: string, value: boolean) => void;
    loading?: {[key: string]: boolean | number};
}

type FolderSelectedType = boolean | 'partial';

const TreeViewSelect: FunctionComponent<TreeViewSelectProps> = ({
                                                                    className,
                                                                    roots,
                                                                    items,
                                                                    itemChildren,
                                                                    renderItem,
                                                                    onExpand,
                                                                    selected,
                                                                    setSelected,
                                                                    loading
                                                                }) => {

    const [expanded, setExpanded] = useState<{[key: string]: boolean}>({});
    const [folderSelected, setFolderSelected] = useState<{[root: string]: {[key: string]: FolderSelectedType}}>({});

    useEffect(() => {
        setFolderSelected(
            Object.keys(selected).reduce((folderSelected: {[root: string]: {[key: string]: FolderSelectedType}}, root) => {
                const folderIdMap: {[key: string]: FolderSelectedType} = Object.keys(selected[root])
                    .reduce((folderIdMap: {[key: string]: boolean}, metadataId) => {
                        let parents = [...items[metadataId].parents];
                        let parentId;
                        while ((parentId = parents.pop()) !== undefined) {
                            if (!folderIdMap[parentId as keyof typeof folderIdMap]) {
                                folderIdMap[parentId as keyof typeof folderIdMap] = true;
                                items[parentId] && items[parentId].parents && parents.push(...items[parentId].parents);
                            }
                        }
                        return folderIdMap;
                    }, {});
                const rootItem = renderItem(root);
                setPartialFolderSelected(itemChildren, selected, root, rootItem.key, folderIdMap);
                folderSelected[root] = folderIdMap;
                return folderSelected;
            }, {})
        );
    }, [itemChildren, items, renderItem, selected]);

    const onToggleExpanded = useCallback((item: TreeViewSelectItem) => {
        setExpanded((prevState) => {
            const expanded = !prevState[item.key];
            onExpand?.(item.key, expanded);
            return {...prevState, [item.key]: expanded}
        })
    }, [onExpand]);

    const onChangeFolderSelected = useCallback(async (root: string, folderKey: string, value: boolean): Promise<void> => {
        // Set selected of the folder
        setFolderSelected((prevState) => ({...prevState, [root]: {...prevState[root], [folderKey]: value}}));
        // ... and its contents, once they're loaded.
        await onExpand?.(folderKey, true);
        for (let key of itemChildren[folderKey] ?? []) {
            const item = renderItem(root, key);
            if (item.canExpand) {
                await onChangeFolderSelected(root, item.key, value);
            } else if (!item.disabled) {
                setSelected(root, item.key, value);
            }
        }
    }, [itemChildren, onExpand, renderItem, setSelected]);

    const onSelectItem = useCallback((item: TreeViewSelectItem, root: string) => {
        if (item.canExpand) {
            void onChangeFolderSelected(root, item.key, (folderSelected[root][item.key] !== true));
        } else if (!item.disabled) {
            setSelected(root, item.key, !selected[root][item.key]);
        }
    }, [folderSelected, onChangeFolderSelected, selected, setSelected]);

    const onClickItem = useCallback((item: TreeViewSelectItem, root: string) => {
        if (item.canExpand) {
            onToggleExpanded(item);
        } else {
            onSelectItem(item, root);
        }
    }, [onSelectItem, onToggleExpanded]);

    const renderCheckbox = useCallback((item: TreeViewSelectItem, root: string) => {
        const isSelected = (item.key in selected[root]) ? selected[root][item.key] : (folderSelected[root]?.[item.key]);
        const icon = isSelected ? (isSelected === true ? 'check_box' : 'indeterminate_check_box') : 'check_box_outline_blank';
        return (loading?.[item.key]) ? (
            <Spinner/>
        ) : (
            <span className={classNames('material-icons checkbox', {disabled: item.disabled})} onClick={() => {
                onSelectItem(item, root);
            }}>{icon}</span>
        )
    }, [folderSelected, loading, onSelectItem, selected]);

    const renderTreeViewSelectItem = useCallback((item: TreeViewSelectItem, root: string) => {
        return (
            <div key={item.key}>
                {
                    !item.canExpand ? null : (
                        <span
                            onClick={() => {onToggleExpanded(item)}}
                            className={classNames('material-icons', 'expandIcon', {
                                open: expanded[item.key]
                            })}
                        >
                                    chevron_right
                                </span>
                    )
                }
                {renderCheckbox(item, root)}
                <span onClick={() => {onClickItem(item, root)}}>{item.element}</span>
                {!expanded[item.key] ? null : (
                    <div className='children'>
                        {
                            (itemChildren[item.key] ?? []).map((key) => (renderItem(root, key)))
                                .sort(sortItems)
                                .map((item) => (renderTreeViewSelectItem(item, root)))
                        }
                    </div>
                )}
            </div>
        );
    }, [expanded, itemChildren, onClickItem, onToggleExpanded, renderCheckbox, renderItem]);

    return (
        <div className={classNames('treeViewSelect', className)}>
            {
                roots.map((root) => (
                    renderTreeViewSelectItem(renderItem(root), root)
                ))
            }
        </div>
    )

}

export default TreeViewSelect;

function setPartialFolderSelected(itemChildren: {[key: string]: string[]}, selected: {[root: string]: {[key: string]: boolean}}, root: string, folderId: string, folderSelected: {[key: string]: FolderSelectedType}) {
    const folderChildren = itemChildren[folderId] ?? [];
    const numberSelected = folderChildren.reduce((count, metadataId) => {
        if (folderSelected[metadataId]) {
            setPartialFolderSelected(itemChildren, selected, root, metadataId, folderSelected);
        }
        const value = (metadataId in selected[root]) ? selected[root][metadataId] : folderSelected[metadataId];
        return count + (value === 'partial' ? 0.5 : (value ? 1 : 0));
    }, 0);
    folderSelected[folderId] = (numberSelected === 0) ? false : (numberSelected === folderChildren.length) ? true : 'partial';
}

function sortItems(item1: TreeViewSelectItem, item2: TreeViewSelectItem) {
    return (item1.sortLabel !== item2.sortLabel ? (item1.sortLabel < item2.sortLabel ? -1 : 1)
        : 0);
}
