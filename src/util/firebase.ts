import * as firebase from 'firebase';

export class Firebase {

    private fb: firebase.app.App;
    private tabletopRef: string;

    constructor(config: object) {
        this.tabletopRef = '/tabletops/';
        this.initFirebase(config);
    }
    
    /**
     * Initializes Firebase from standard config object
     * @param config Firebase config src/firebase-config
     */
    initFirebase(config: object) {
        this.fb = firebase.initializeApp(config);
    }

    /**
     * Creates a Firebase reference listener for the current
     * tabletop to trigger client updates whenever changes occur. 
     * @param tabletopId the tabletop ID
     * @param callback function required to update tabletop
     */
    initTabletopDataListener(tabletopId: string|null, callback: any) {
        const tabletop = this.fb.database().ref(this.tabletopRef + tabletopId);
        return tabletop.on('value', (snapshot: any) => {
            // console.log("\nListener Triggered:", snapshot.val());
            callback(snapshot.val(), this);
        });
    }

    /**
     * Writes tabletop scenario data to Firebase whenever a change 
     * occurs.
     * @param tabletopId tabletop ID (ref: /tabletops/<id>/{scenario data})
     * @param scenario scenario JSON object
     */
    saveTabletopScenario(tabletopId: string|null, scenario: object) {
        const updates = {[this.tabletopRef + tabletopId]: scenario};
        this.fb.database().ref().update(updates);
        return updates;
    }

    /**
     * Retrieves the latest scenario data for current tabletop.
     * @param tabletopId tabletop ID (ref: /tabletops/<id>/{scenario data})
     */
    readTabletopData(tabletopId: string|null): Promise<firebase.database.DataSnapshot> {
        return this.fb.database().ref(this.tabletopRef + tabletopId).once('value');
    }
}