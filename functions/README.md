# Firebase functions for gTove

The old sign-in to Google has been deprecated, and the new Google Identity Services isn't as useful (as is par for the
course for Google - https://twitter.com/ronamadeo/status/1412905316254208009 ).

Specifically, when the short-lived access token expires after an hour, the old sign-in code allowed the client to
refresh the access code in the background without user intervention by calling
`gapi.auth2.getAuthInstance().currentUser.get().reloadAuthResponse()`.  The new GIS approach however only allows you to
silently refresh the access code on the server - the client-side "solution" would require the user to reauthenticate
every hour.

So, these are some server-side functions to handle access token refreshes.  They're deployed to Firebase as [Cloud
functions](https://firebase.google.com/docs/functions).
