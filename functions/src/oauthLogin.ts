import {defineString} from 'firebase-functions/params';
import {google} from 'googleapis';
import * as functions from 'firebase-functions';
import {database} from 'firebase-admin';

const clientId = defineString('CLIENT_ID', {description: 'The oAuth clientId defined in Google Cloud Console.'});
const clientSecret = defineString('CLIENT_SECRET', {description: 'The client secret associated with clientId.'});

const oauth2Client = new google.auth.OAuth2(
    clientId.value(),
    clientSecret.value(),
    'postmessage' // special value for redirect_uri when the client uses the popup login flow.
);

/**
 * In order to keep the client secret, y'know, secret, the request to exchange the authentication code for the various
 * oAuth tokens needs to be made server-side.  Since the user hasn't actually signed into Firebase at this stage (they
 * need the access token to do that), store their refresh token under a temporary "success code".
 */
export const handleOAuthCode = functions.https.onCall(async (data) => {
    const {tokens} = await oauth2Client.getToken(data.code);
    const successCode = await database().ref(`loginTokens`).push(tokens.refresh_token).key;
    return {accessToken: tokens.access_token, successCode};
});

/**
 * Once the client has authenticated to Firebase, it calls this function to copy the refresh token to a place in the
 * RTDB associated with their Firebase UserID (and we clean up the token stored under their "success code".)
 */
export const handleOAuthSuccess = functions.https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    const successCode = data.successCode;
    if (!userId || !successCode) {
        throw new Error('Invalid');
    }
    const accessTokenRef = database().ref(`loginTokens/${successCode}`);
    const tokenSnapshot = await accessTokenRef.get();
    if (!tokenSnapshot.exists()) {
        throw new Error('Invalid');
    }
    await database().ref(`refreshTokens/${userId}`).set(tokenSnapshot.val());
    await accessTokenRef.remove();
});

/**
 * This function uses a previously stored refresh token for a given user to get a current access token. The client calls
 * this function both when the current access token expires, and when the user returns to the application in a browser
 * which was previously signed into gTove (which persists their Firebase login).
 */
export const refreshAccessToken = functions.https.onCall(async (data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
        const refreshTokenSnapshot = await database().ref(`refreshTokens/${userId}`).get();
        if (refreshTokenSnapshot.exists()) {
            const refresh_token = refreshTokenSnapshot.val();
            oauth2Client.setCredentials({refresh_token});
            const {credentials} = await oauth2Client.refreshAccessToken();
            return {access_token: credentials.access_token};
        }
    }
    throw new Error('Invalid');
});

/**
 * When a user explicitly signs out of gTove, we delete their refresh token from the RTDB.
 */
export const gToveSignOut = functions.https.onCall(async (_data, context) => {
    const userId = context.auth?.uid;
    if (userId) {
        await database().ref(`refreshTokens/${userId}`).remove();
    }
});