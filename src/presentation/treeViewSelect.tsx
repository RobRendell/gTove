import * as React from 'react';
import * as PropTypes from 'prop-types';
import classNames from 'classnames';
import Spinner from './spinner';

import './treeViewSelect.scss';

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
    loading?: {[key: string]: boolean};
}

type FolderSelectedType = boolean | 'partial';

interface TreeViewSelectState {
    expanded: {[key: string]: boolean};
    folderSelected: {[root: string]: {[key: string]: FolderSelectedType}};
}

class TreeViewSelect extends React.Component<TreeViewSelectProps, TreeViewSelectState> {

    static propTypes = {
        className: PropTypes.string,
        roots: PropTypes.arrayOf(PropTypes.string).isRequired,
        items: PropTypes.object.isRequired,
        itemChildren: PropTypes.object.isRequired,
        renderItem: PropTypes.func.isRequired,
        onExpand: PropTypes.func,
        selected: PropTypes.object.isRequired,
        onSelect: PropTypes.func,
        loading: PropTypes.object
    };

    constructor(props: TreeViewSelectProps) {
        super(props);
        this.sortItems = this.sortItems.bind(this);
        this.state = {
            expanded: {},
            folderSelected: {}
        };
    }

    componentDidMount() {
        this.setAllRootsFolderSelected(this.props);
    }

    UNSAFE_componentWillReceiveProps(props: TreeViewSelectProps) {
        this.setAllRootsFolderSelected(props);
    }

    setAllRootsFolderSelected(props:TreeViewSelectProps) {
        const folderSelected = Object.keys(props.selected).reduce((folderSelected: {[root: string]: {[key: string]: FolderSelectedType}}, root) => {
            const folderIdMap: {[key: string]: FolderSelectedType} = Object.keys(props.selected[root])
            .reduce((folderIdMap: {[key: string]: boolean}, metadataId) => {
                let parents = [...props.items[metadataId].parents];
                let parentId;
                while ((parentId = parents.pop()) !== undefined) {
                    if (!folderIdMap[parentId as keyof typeof folderIdMap]) {
                        folderIdMap[parentId as keyof typeof folderIdMap] = true;
                        props.items[parentId] && props.items[parentId].parents && parents.push(...props.items[parentId].parents);
                    }
                }
                return folderIdMap;
            }, {});
            const rootItem = props.renderItem(root);
            this.setPartialFolderSelected(props, root, rootItem.key, folderIdMap);
            folderSelected[root] = folderIdMap;
            return folderSelected;
        }, {});
        this.setState({folderSelected});
    }

    setPartialFolderSelected(props: TreeViewSelectProps, root: string, folderId: string, folderSelected: {[key: string]: FolderSelectedType}) {
        const folderChildren = props.itemChildren[folderId] || [];
        const numberSelected = folderChildren.reduce((count, metadataId) => {
            if (folderSelected[metadataId]) {
                this.setPartialFolderSelected(props, root, metadataId, folderSelected);
            }
            const value = (metadataId in props.selected[root]) ? props.selected[root][metadataId] : folderSelected[metadataId];
            return count + (value === 'partial' ? 0.5 : (value ? 1 : 0));
        }, 0);
        folderSelected[folderId] = (numberSelected === 0) ? false : (numberSelected === folderChildren.length) ? true : 'partial';
    }

    onToggleExpanded(item: TreeViewSelectItem) {
        this.setState((state) => {
            const expanded = !state.expanded[item.key];
            this.props.onExpand && this.props.onExpand(item.key, expanded);
            return {expanded: {...state.expanded, [item.key]: expanded}}
        })
    }

    async onChangeFolderSelected(root: string, folderKey: string, value: boolean): Promise<void> {
        // Set selected of the folder
        this.setState((state) => ({folderSelected: {...state.folderSelected, [root]: {...state.folderSelected[root], [folderKey]: value}}}));
        // ... and its contents, once they're loaded.
        if (this.props.onExpand) {
            await this.props.onExpand(folderKey, true);
        }
        for (let key of this.props.itemChildren[folderKey] || []) {
            const item = this.props.renderItem(root, key);
            if (item.canExpand) {
                await this.onChangeFolderSelected(root, item.key, value);
            } else if (!item.disabled) {
                await this.props.setSelected(root, item.key, value);
            }
        }
    }

    onSelectItem(item: TreeViewSelectItem, root: string) {
        if (item.canExpand) {
            this.onChangeFolderSelected(root, item.key, (this.state.folderSelected[root][item.key] !== true));
        } else if (!item.disabled) {
            this.props.setSelected(root, item.key, !this.props.selected[root][item.key]);
        }
    }

    onClickItem(item: TreeViewSelectItem, root: string) {
        if (item.canExpand) {
            this.onToggleExpanded(item);
        } else {
            this.onSelectItem(item, root);
        }
    }

    sortItems(item1: TreeViewSelectItem, item2: TreeViewSelectItem) {
        return (item1.sortLabel !== item2.sortLabel ? (item1.sortLabel < item2.sortLabel ? -1 : 1)
            : 0);
    }

    renderCheckbox(item: TreeViewSelectItem, root: string) {
        const selected = (item.key in this.props.selected[root]) ? this.props.selected[root][item.key] : (this.state.folderSelected[root] && this.state.folderSelected[root][item.key]);
        const icon = selected ? (selected === true ? 'check_box' : 'indeterminate_check_box') : 'check_box_outline_blank';
        return (this.props.loading && this.props.loading[item.key]) ? (
            <Spinner/>
        ) : (
            <span className={classNames('material-icons', {disabled: item.disabled})} onClick={() => {
                this.onSelectItem(item, root);
            }}>{icon}</span>
        )
    }

    renderChildren(children: string[] = [], root: string) {
        return (
            <div className='children'>
                {
                    children.map((key) => (this.props.renderItem(root, key)))
                        .sort(this.sortItems)
                        .map((item) => (this.renderItem(item, root)))
                }
            </div>
        );
    }

    renderItem(item: TreeViewSelectItem, root: string): React.ReactElement<any> {
        return (
            <div key={item.key}>
                {
                    !item.canExpand ? null : (
                        <span
                            onClick={() => {this.onToggleExpanded(item)}}
                            className={classNames('material-icons', 'expandIcon', {
                                open: this.state.expanded[item.key]
                            })}
                        >
                            chevron_right
                        </span>
                    )
                }
                {this.renderCheckbox(item, root)}
                <span onClick={() => {this.onClickItem(item, root)}}>{item.element}</span>
                {this.state.expanded[item.key] ? this.renderChildren(this.props.itemChildren[item.key], root) : null}
            </div>
        );
    }

    render() {
        return (
            <div className={classNames('treeViewSelect', this.props.className)}>
                {this.props.roots.map((root) => (this.renderItem(this.props.renderItem(root), root)))}
            </div>
        )
    }
}

export default TreeViewSelect;