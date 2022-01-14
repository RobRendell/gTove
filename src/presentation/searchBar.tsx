import {useCallback, useState} from 'react';

import InputField from './inputField';
import InputButton from './inputButton';

import './searchBar.scss';

interface SearchBarProps {
    onSearch: (search: string) => void;
    placeholder?: string;
    initialValue?: string;
}

export default function SearchBar({onSearch, placeholder, initialValue}: SearchBarProps) {
    const [text, setText] = useState('');
    const onDone = useCallback(() => (
        setText((text) => {
            onSearch(text);
            return text;
        })
    ), [onSearch]);
    return (
        <div className='searchBar'>
            <InputField type='text' initialValue={initialValue || text} onChange={setText} placeholder={placeholder}
                        specialKeys={{
                            Return: onDone, Enter: onDone
                        }}/>
            <InputButton type='button' onChange={onDone}>
                <span className='material-icons'>search</span>
            </InputButton>
        </div>
    );
}