import {initializeApp} from 'firebase-admin/app';
import {databaseURL} from 'firebase-functions/params';

initializeApp({
    databaseURL: databaseURL.value()
});

export * from './oauthLogin';