import {
    Database,
    DatabaseReference,
    DataSnapshot,
    child as firebaseChild,
    get as firebaseGet,
    getDatabase as firebaseGetDatabase,
    onChildAdded as firebaseOnChildAdded,
    onChildRemoved as firebaseOnChildRemoved,
    ref as firebaseRef,
    push as firebasePush,
    set as firebaseSet,
    remove as firebaseRemove
} from 'firebase/database';
import {FirebaseApp} from '@firebase/app';
import {Unsubscribe} from '@firebase/database';

/**
 * If Key is a key of T, return T[Key], else void (handles the special case where
 * Javascript implicitly converts numbers to strings, see first paragraph of:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_Accessors#property_names)
 */
export type TypeOfStringOrNumberField<T, Key> = Key extends keyof T
    ? Required<T>[Key]
    : Key extends `${number}`
        ? T extends { [key: number]: unknown }
            ? Required<T>[number]
            : void
        : void;

/**
 * Drills down into a type, treating Key as a slash separated list of keys
 * (it also strips any leading slashes). If the given path is invalid, resolves
 * to void.
 *
 * Example: NextedValueOf<{ a: { b: 'c' } }, '/a/b'> resolves to 'c'
 *
 * Note: Trailing slashes will add an extra '' key, which will probably be invalid:
 * NextedValueOf<{ a: { b: 'c' } }, '/a/b/'> resolves to void
 */
export type NestedValueOf<T, Key extends string> = T extends object
    ? Key extends `/${infer SubKeys}`
        ? NestedValueOf<T, SubKeys>
        : Key extends `${infer KeyOfT}/${infer SubKeys}`
            ? NestedValueOf<TypeOfStringOrNumberField<T, KeyOfT>, SubKeys>
            : TypeOfStringOrNumberField<T, Key>
    : void;

export type TypedDatabase<Base> = Database & {_base: Base};

export function getDatabase<Base>(app: FirebaseApp): TypedDatabase<Base> {
    return firebaseGetDatabase(app) as any;
}

export type TypedDatabaseReference<T, Base> = DatabaseReference & {_type: T, _base: Base};

export function ref<Path extends string, Base>(db: TypedDatabase<Base>, path: Path): TypedDatabaseReference<NestedValueOf<Base, Path>, Base> {
    return firebaseRef(db, path) as any;
}

export interface TypedDataSnapshot<T, Base, Exists extends boolean = boolean> extends DataSnapshot {
    child<P extends string>(path: P): TypedDataSnapshot<NestedValueOf<T, P>, Base>;
    forEach(action: (a: TypedDataSnapshot<T[keyof T], Base, true>) => boolean | void): boolean;
    ref: TypedDatabaseReference<T, Base>;
    exists(this: TypedDataSnapshot<T,  Base, Exists>): this is TypedDataSnapshot<T,  Base, true>;
    val(): Exists extends true ? T : Exists extends false ? null : T | null;
}

export function get<T, Base>(ref: TypedDatabaseReference<T, Base>): Promise<TypedDataSnapshot<T, Base>> {
    return firebaseGet(ref) as any;
}

export function onChildAdded<T, Base>(
    ref: TypedDatabaseReference<T, Base>,
    callback: (snapshot: TypedDataSnapshot<T[keyof T], Base, true>, previousChildName?: string | null) => void
): Unsubscribe {
    return firebaseOnChildAdded(ref, callback as any);
}

export function onChildRemoved<T, Base>(
    ref: TypedDatabaseReference<T, Base>,
    callback: (snapshot: TypedDataSnapshot<T[keyof T], Base, true>) => void
): Unsubscribe {
    return firebaseOnChildRemoved(ref, callback as any);
}

/**
 * In some cases, it is useful to specify that we want the child of some Object, where that
 * object only has "dynamic" keys. i.e. [key: string]
 */
export type ChildOfDynamicStringKey<T> = T extends { [key: string]: string }
    ? string extends keyof T
        ? T[string]
        : void
    : number | string extends keyof T
        ? T[keyof T]
        : void;


export type TypedThenableReference<T, Base> = TypedDatabaseReference<T, Base> & Promise<TypedDatabaseReference<T, Base>>;

export function push<T, Base>(
    parent: TypedDatabaseReference<T, Base>,
    value: ChildOfDynamicStringKey<T>
): TypedThenableReference<T, Base> {
    return firebasePush(parent, value) as any
}

export async function set<T, Base>(
    ref: TypedDatabaseReference<T, Base>,
    value: T
) {
    return firebaseSet(ref, value);
}

export function child<T, Base, Path extends string>(
    parent: TypedDatabaseReference<T, Base>,
    path: Path
): TypedDatabaseReference<NestedValueOf<T, Path>, Base> {
    return firebaseChild(parent, path) as any;
}

export function remove<T extends object, Base>(
    ref: TypedDatabaseReference<T, Base>
): Promise<void> {
    return firebaseRemove(ref);
}