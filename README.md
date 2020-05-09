# gTove - a virtual gaming tabletop

_'Twas Brillig, and the slithy toves did gyre and gimble in the wabe._

This project is a lightweight web application to simulate a virtual tabletop.  Multiple
maps and standee-style miniatures can be placed on the tabletop, and everyone connected
to the same tabletop can see them and move the miniatures around.  To make the hosting
costs as low as possible and to allow other people to fork the project, Google Drive is
used to store shared resources such as the images for miniatures and maps, and data for
scenarios.

## User Version
If you just want to use gTove, it can be accessed here:

[https://illuminantgames.com/gtove](https://illuminantgames.com/gtove)

## Browser Support
At the moment, I'm doing my development in Chrome, with occasional tests in Firefox.  Other browsers may or may not
work at this stage.

## Discord Server
I've created a Discord Server for gTove where people can discuss the application, including discussing bugs (before
raising then on Github) and making feature suggestions.

[https://discord.gg/rZCCfR9](https://discord.gg/rZCCfR9)

## Basic User Guide

You can access gTove by going here: [https://illuminantgames.com/gtove](https://illuminantgames.com/gtove)

### Getting Started

After giving permission to the app to access your Google Drive (see [Permissions](#permissions) below), it will create
an empty folder structure at the top level of your Drive (which you can move elsewhere in your Drive if you like).  You
will be taken to a tutorial tabletop, which will guide you through the basics of navigating and using the app.

After you have finished with the tutorial, press the "Tabletops" button in the left-hand menu to go to the Tabletops
browser.  Press "Add Tabletop" to create your own tabletop, a shared virtual gaming space that can contain maps and
miniatures.  You will be given various configuration options for the tabletop, but you can simply "Save" the tabletop to
proceed for now - you can return at any time later and Edit the tabletop to explore the tabletop configuration options.

You are the owner of any tabletops you create (making you the Game Master for that tabletop), and you can invite your
players to one of your tabletops by sending them the URL that is shown in your browser address bar when you are viewing
the tabletop yourself.

The contents of a tabletop can only be changed when the GM is connected, but players can look at the current tabletop by
going to the URL at any time.  Players accessing an existing tabletop are not prompted by gTove to create the empty
folder structure in their Drive, but they must still give gTove permission to access their Drive.

When you use gTove, all of its configuration files, images and directories are created in your Drive, and nowhere else.
There is no central gTove server which stores any information... everything is driven from the gTove files saved on the
Drive of the currently signed in user.

### Viewing the Tabletop

Once you create and select a new tabletop, you will see an empty grid (since you have no maps loaded), and various
controls on the left.  These controls allow you to toggle various tabletop-wide options like Grid Snap (whether minis
snap to the map's grid or not) and Edit Fog (which allows you to cover up sections of the map with a "fog of war",
hiding the map underneath from your players), as well as allowing you to switch between "GM view" (where everything is
visible) and "player view" (where fog of war is opaque and hidden maps and miniatures are not shown, so you can see what
your players will see.)

The left-hand menu can be closed by clicking the × symbol, and revealed again by clicking the ☰ menu symbol.

### Adding Maps and Miniatures

To add maps and miniatures to the tabletop, click the buttons marked "Maps" or "Minis" in the left-hand menu.  This will
open a file browser of the gTove folders on your Drive, where you can upload images and configure how they will appear
on to tabletop.

Click "Upload" to add your first image.  You can multi-select files when uploading if you want to import many images
into gTove at once.  You can also paste images that you have copied to your clipboard directly into the file browser for
maps and miniatures, but you cannot yet drag-and-drop files.

When an image file is first uploaded, it will be marked as "NEW", and gTove will require you to configure the image
before using it on the tabletop.
* For maps, you can set its name, and align a grid over the map so gTove knows what scale to display the map at.  Note
that you cannot hide parts of the map from players using Fog of War unless the map has a grid defined.  You can
optionally have gTove show the grid overlay when on the tabletop, if you have a map image which does not have a grid
overlay as part of the image itself.
* For miniatures, you can set its name, and also see a preview of what the miniature will look like on the tabletop.
The left-hand or top panel shows how the image will be framed in the standee outline - pan and zoom the frame to adjust
how much of the image will be visible.  The camera in the 3D view can be moved using the gestures described in the
"Interacting with the Tabletop" section below, and if you rotate the camera to look top-down, you will switch to
configuring how the image will be framed when in flat, top-down mode.

Save the configured version of your image, and you will return to the file browser.  Click or tap a map or miniature
image that you have configured to drop it on your tabletop.

Note that you should not save images directly into the gTove folders using the Google Drive interface, as gTove will not
have permission to modify them.

### Interacting with the Tabletop

Back on the tabletop, the gestures or mouse interactions are consistent across the app:
* Single finger tap or left mouse click to select or bring up a menu relating to the thing you clicked or tapped.  The
options available depend on whether you own the tabletop or not.
  * The miniature menu includes options like making the miniature lie down/stand up, editing its name label, changing
  its scale, duplicating it or removing it from the tabletop.
  * The map menu includes options such as covering or uncovering the whole map with fog of war (as long as the map has a
  grid defined for it), repositioning it, or removing it from the tabletop.
  * For the GM, both miniature and map menus include the option to reveal the map or miniature to the players, or to
  hide a revealed map or miniature.  Newly added miniatures are automatically hidden from players, as are newly added
  maps with no grid defined.  If a newly added map has a grid, it is not hidden from players, but is instead completely
  covered by Fog of War.
* Left click and drag, or drag with a single finger, to pan.
  * Panning a miniature will move it around on the map.  Its base will snap vertically to whatever map you drag over, so
  you can drag it between maps at different elevations if you like.
  * Panning a map or on the background will pan the camera around.
  * If you are repositioning a map, panning will move the map on the tabletop.
* Right click and drag, control-left click and drag, or rotate with two fingers, to rotate.
  * Rotating a miniature will rotate it on its base.
  * Rotating a map or on the background will orbit the camera around the point it's currently looking at, and also elevate
  between an oblique view or looking top-down on the tabletop.
  * If you are repositioning a map, rotating will rotate it around its centre.
* Middle click and drag, shift-left click and drag (for those without a three-button mouse), or two finger pinch, to zoom.
  * Zooming a miniature will elevate it above or below its base, to represent flying, burrowing or swimming creatures.
  * Zooming a miniature while scaling it will adjust its size.
  * Zooming a map or on the background will cause the camera to zoom in and out.
  * If you are repositioning a map, zooming it will change its elevation.

### Connected Users

The Google avatar of the signed in user is visible in the top-right corner.  You can click this icon to open a
connection menu, which contains a button to sign out of gTove.

If other users connect to the tabletop, a counter will appear on this avatar showing how many users are connected.
If the GM is connected, the counter will be green; otherwise, it is orange.  Expanding the connection menu allows you to
see who is connected.  

## Building gTove from Source

**Note:** You don't have to build gTove yourself to use it - simply go to
[https://illuminantgames.com/gtove](https://illuminantgames.com/gtove) and start using it!

If you want to contribute to gTove's development though, you may want to check out the repository and start working
with it locally.  gTove is a react typescript application, built with create-react-app and then manually converted to
typescript (because I didn't use --scripts-version=react-scripts-ts when I first ran create-react-app).

* You need Node.js installed.  I'm currently running version 12.16.1
* Check out the repository using your preferred git tool.
* Install yarn: `npm install -g yarn` (I use yarn, and thus the project has a `yarn.lock` file rather than a
    `package.lock`)
* Change into the top level gTove directory: `cd gTove`
* Run `yarn install`
* After dependencies are installed, you can start a development server by running `yarn start`.

## Styling

At this stage, the app is quite minimally styled.  Many UI elements are just default HTML buttons, laid out in columns.
Once the major functionality is implemented, I'll try get someone who's good at graphic design to come up with a style
for the app and add the styling.  For now, the emphasis is on functionality.

That said, there are certain user interactions which I'm very happy with.  I like the unified mouse/gesture interface
with the virtual tabletop, and the way users align the grid when editing a map is most of the way to something I reckon
is intuitive and easy to use. 

## Permissions

To accesses your Google Drive and store its files, gTove requires "drive.file" access, which is defined as "Per-file
access to files created or opened by the app. File authorization is granted on a per-user basis and is revoked when the
user deauthorizes the app."

What that means is that the app cannot read any files in your Drive it does not create itself.

Note that this means that you cannot upload files or create folders for gTove in the Drive UI - gTove will not be able
to see them - you need to use the app.  However, you can safely use the Google Drive UI to rearrange files and folders
that were created by the app (although moving files into different top-level folders, such as moving a configured mini
image into Maps, will certainly break things). 

# Features

## Implemented

* Maps and miniatures can be loaded into the app, and are saved to Google Drive.
* Add map(s) and minis to tabletop.
* Try to make mouse and gesture controls consistent - re-use the same gestures to control the camera, maps and minis as
much as possible.
* Camera can pan, zoom, rotate using mouse or touch gestures.
* By starting the mouse gesture/touch gesture on a mini, mini can be moved, elevated, rotated.
* By selecting a map (by clicking/tapping it), map can be moved, elevated, rotated.
* Only re-render 3D scene if something changes (camera angle, mini position etc.) to reduce power/battery consumption.
* The GM has a current tabletop, with a unique URL.  Players going to the URL join the tabletop.
* Peer-to-peer sharing of actions between everyone on the same tabletop.
* Show Google icon for the logged in user, and for other users connected to the tabletop.
* Selecting a different tabletop when one is already selected pops out a new window/tab.
* Clear the tabletop.
* Add a GM-private JSON file per tabletop for saving GM-only data like hidden minis and maps.
* Hide/reveal minis and maps from/to players.
* Remove minis and maps individually from the tabletop.
* Align/scale a grid on a map.  Required for fog of war.
* Fog of war on maps with a grid defined.
* Add menu option to scale a mini up or down.
* Tap the Fog of War drag handle to bring up a menu (cover/uncover all, finish).
* Dragging the Fog of War rect to edge of screen auto-pans the camera.
* Support offline usage (changes are not saved, lost when the tab closes)
* Add tabletop-level option: Snap to Grid.
    * minis: position snaps to grid, rotation snaps to 45 degrees, size snaps to 1/4, 1/3, 1/2 or whole numbers,
        elevation snaps to whole numbers.
    * maps: position snaps to match up grids with existing maps, elevation snaps to whole numbers, rotation snaps to
        90 degrees.
* Add "none" as an option for grid colour.  Maps with no grid have no Fog of War.  Snap to Grid still works, using the
    default grid.
* Make Save button for map editor disabled if grid != none and either pushpin not pinned.
* Ensure map grid alignment pushpins remain on screen when they're not pinned.
* Make fog of war rect snap to grid.
* Toggle fog of war cover on a map grid square by tapping/clicking (when in fog of war mode.)
* Option for GM to view tabletop as a player - opaque Fog of War, hide hidden maps and minis.
* When repositioning a map, keep selected until user taps or selects something else.
* Refresh the grid on an already-displayed map if you edit the map grid layout.
* Add buttons to bump grid-aligning pushpin one pixel up/down/left/right.
* Adapt grid-aligning pushpins to portrait orientation.
* Prevent minis from being selected when in Fog of War mode.
* Fix: connecting to a tabletop while people are moving things around can cause the loading client to crash.
* Rename Drive top-level Drive folder to gTove.  Handle the top-level folder having a different name (allows users to
    rename the top level folder with impunity... could already move it elsewhere in their Drive.)
* Move fogWidth, fogHeight into appProperties, set when you edit the grid.
* Convert project to typescript.
* Load drive file metadata dynamically, rather than all up-front.  Add "refresh" button to file browser.
* Fix mini scaling with middle-click-drag on desktop and pinch-zoom on touch devices.
* Prevent drag-down-to-reload behaviour in mobile Chrome.
* Make Fog of War drag rectangle/calculations respect map rotation.
* Add to map menu: Cover with Fog of War, Uncover Fog of War
* Add to map menu: Focus Map, to make the camera orbit-point lie on the map's plane, and fade maps and minis at higher
    elevations.
* Add to global menu: Refocus camera, focus higher, focus lower.
* Position added maps/minis so they don't overlap existing maps/minis.
* Add ability to save and load scenarios.
* Reposition pop-up menus if created close to an edge so they don't extend off-screen.
* Implement delete in file browser.
* Remember where you last browsed to for each file browser (maps, minis etc.) and re-open the browser in the same folder.
* Add option to tip over minis, to represent prone, dead or whatever.
* Allow editing (renaming) and deleting folders.
* Add button to save current tabletop over existing scenario (edit scenario).
* Fix fog of war cover/uncover alignment issue when maps are exact grids.
* Show drag handle in map reposition mode.  Add menu option to leave mode.
* Warn that loading a scenario will replace the current tabletop contents.
* Remove maps or minis with trashed or deleted metadata from the tabletop.
* Top-down view for minis.
* When editing minis, user can move/zoom the circle selecting cropped top-down mini image.
* Warn if GM tries to set Fog of War on maps with no grid. 
* Show editable name labels on minis.
* Duplicate a mini on the tabletop N times (default 1).  New minis are named with numbers based off the original such as
    "Goblin 2", "Goblin 3" etc. (and the original mini is also given a number if it doesn't have one already).
* Reset offline status when you log out of offline mode and in again using Drive.
* Manually added minis should also be given unique names.
* Adjust the Google console profile to allow https access to gTove, and change the default URL to use it.
* Add icon image to manifest.json.
* Make client keep comparing the saved Drive data with received actions until it can verify it's in sync.
* Prevent a non-GM user from selecting a map/mini which is already being updated by someone else.
* Show a highlight on minis/maps currently selected by someone else.
* Allow GM clients to share actions with one another in a secure fashion.
* Make Google Drive API calls automatically retry with exponential backoff if they get back a 403 error due to exceeding
    Drive's rate limits.  Doesn't apply to mass-uploading though.
* Fix annoying jump when snapping large minis to grid.
* Preview a 3D mini in the mini editor, and allow the user to define the standee outline/crop area.
* If user uploads a single map/mini image, automatically launch the editor on it afterward the upload completes.
* Change file browser to have a drop-down menu per item, rather than a mode.
* Open the tabletop menu by default.  Make menu more mobile-friendly.
* Support pasting images from the clipboard directly into the maps and minis file browser.
* Improve the handling of multiple files uploading at once, including a "cancel" button.
* Add ability to toggle minis between always rendering as flat counters and rendering as standees when not top-down.
* When in Player View mode, minis/maps added to the tabletop are automatically revealed.
* Add a slider to control the size of mini labels (not shared or persisted, so each user can set as preferred).
* Give the GM options with what to do when tabletop images fail to load - continue without the image (minis/maps will
    show black), remove anything that uses the image from the tabletop, or use a different image.
* Make larger flat or top down minis slightly thinner than smaller ones, so when overlapping the smaller mini remains
    visible.
* Fix text position for larger flat or top down minis.
* Make the system able to create new top-level folders in existing gTove root folders.  Add Bundles top-level folder.
* Show a default grid if no map has been added to the tabletop.
* Drive-based bundles.  Save a collection of scenarios, maps and minis, and share a link to the bundle with other GMs to
    give them copies of the scenarios, and shortcuts to the maps and minis, set up in their gTove files ready to use.
* Gracefully handle shortcuts to deleted files.
* Prevent "new" maps/minis (without params defined) from going into bundles.
* Prevent editing shortcut maps/minis, which you don't have permission to write to anyway.
* Add support for URL-based maps and miniatures.  The image is not saved in Drive, only the URL and parameters such as
    grid scale and offset for maps or crop frame for miniatures.
* "Confirm Movement" mode added - draw arrows from mini starting points to where they are now, and the distance in grid
    squares travelled, until the move is confirmed or cancelled from the mini menu.
* Make newly added maps revealed by default if they have a grid (because they'll be covered by Fog of War).
* Snap newly added maps to the grid, whether or not snap to grid is on.
* Tabletop options to specify the scale of the grid, how to measure distance (straight line, follow grid - diagonals
    are free, follow grid - diagonals cost three squares every two), and how to round distances (off, up, down or not).
* Make "follow grid" distance actually show a path which follows the grid (made from grid-aligned and 45 degree lines).
* Add ability to set and clear waypoints along a movement path.
* Recover from Google API token expiring.
* "Template" miniatures to represent spell areas, auras, traps or whatever.  A template has a shape (square/rectangle,
    circle or arc), various dimensions such as radius, height and angle, and a colour/opacity.  Once defined, a template
    can then be dropped onto the tabletop and (mostly) acts like a miniature - it can be moved, scaled up or down and
    rotated.
* Change to non-cookie way of using httprelay.io, allowing multiple tabs in the same browser to reliably get messages.
* Attach/detach minis.  Drag a mini/template onto another mini/template and "Attach" from the mini menu.  Once attached,
    the two minis move, rotate and elevate together.  This feature can be used to represent riding mounts, attaching
    auras to minis or (by putting multiple minis on a common base) to make squads.  Note: does not currently support
    attaching templates to templates.
* Enforce Google Drive appProperties length limit for URL-based images: URL cannot be longer than 117 bytes.
* Add option to switch to (experimental) multi-cast communication mode.
* Prevent annoying momentary non-grid-aligned wiggle on other clients when finishing a gesture while snapping to grid.
* Attempt to ensure pinned-down push pins in map editor are visible on iDevices.
* Don't auto-close the side menu - only ever close when user explicitly clicks the menu icon.
* Add ability to manually set the elevation of a template, and to reset the template offset back to the origin. 
* Disambiguate tap - if several minis/maps are potential targets of the tap, first show a menu of their names before
    showing their menu.
* Handle removing a mini that other minis are attached to.
* Add small elevation offset to overlapping templates to reduce z-fighting.
* Remove click-label-to-edit-name feature for now.
* Handle peer-to-peer nodes simultaneous attempting to initiate connection.
* Add option when editing a map to display the grid overlay on the tabletop.
* Make some improvements to multicast communication.
* Do not show movement paths for miniatures that are attached.
* Fix for Edge: grid alignment pushpin now moves grid.
* Fix for iOS: add "iNoBounce" to disable elastic page bouncing at the edges.
* New look for the main UI.
* When GM is disconnected, disabled various menu options which change the tabletop.
* Add mini menu option to hide/show the base of standee minis.
* Add mini menu option to recolour the base of standee minis.
* Add tutorial scenario/tabletop, automatically created when a user first creates the gTove folders in their Drive or
    starts Offline mode.
* Make the up/down map level buttons preserve the viewing angle.
* When clicking overlapping Maps or Minis/Templates, only bring up disambiguation menu if they're close together.
* Add map menu options to raise and lower maps to the next "level" up or down.
* Give on-screen guidance when aligning grids on maps, and only show active bumper arrows when scaling.
* Don't show "Save Current Tabletop over this Scenario" button when first creating a scenario.
* Add a button to toggle the mini editor between standee and counter view.
* Bug fix: multicast mode was sometimes displaying hidden minis and maps to players.
* When editing a scenario, also show a preview of the saved tabletop.
* Support displaying a tabletop on multiple devices physically laid next to one another.  Access the configuration via
    the menu under your avatar.  Drag multiple connected clients together and arrange the devices in the UI to reflect
    their physical layout.
* Add button to enter and leave full-screen mode.
* Don't send multicast messages addressed to no-one.
* Button on tabletop and menu item on tabletop browser to copy URLs to clipboard, for users using the app fullscreen.
* Disable access to Scenarios when connected as a Player.
* Add GM-only option to "Lock/Unlock position" on minis/templates.
* Make Templates display their movement path like minis do when free move is off.
* Detaching minis/templates always set a movement path, even if "free movement" was on.  Also, the path was incorrect.
* Make Cancel Movement also reset elevation.
* Make mini/template context menu scroll if it exceeds the available height.
* Make fullscreen background colour white.
* Fix "detach device" button not working on touchscreens.
* Animate camera movement when resetting camera or changing focus level.
* Add "Replace map image" option to map context menu, preserving fog of war.  Useful when you want to re-import a map at
    a different resolution, or have several versions of the same map with different information shown (e.g. secret doors)
* When a player adds a mini/template/map to tabletop from their Drive, make it automatically revealed.
* Show an indicator to GMs while the tabletop needs to be saved, and a spinner when it's being saved.
* Make clients continuously check that they're in sync with one another.
* Allow players with gTove Drive files to "bookmark" tabletops they don't own in the Tabletops section.
* Seek confirmation from the user before covering/uncovering a map with detailed fog-of-war.
* New option in mini context menu for attached minis: "Move attachment point"
* Detect failing p2p connections and send messages manually via httprelay.io (psuedo-TURN)
* Show explicit "back" navigation icon in file browser when in sub-directories (navigating using the breadcrumbs
    is awkward on touchscreens).
* Make "Refresh" button in file browser remove files/folders that are no longer present.
* Add top-level button to mini browser, "Pick All Here", to place one of each mini in the current directory on the
    tabletop.
* Fix issues with combined device layouts when no maps are on the tabletop.
* Share current device layouts with new clients when they join the tabletop.
* Option to set the default scale of a mini image.
* Don't reset Grid Snap or Free Move when user Clears a tabletop.
* Show toast when signal server (httprelay.io) is responding with errors, saying clients can't connect.
* Show pending peer connections before they complete, to aid with troubleshooting.
* Clients are aware of their version, and offer to force-refresh if connected to newer clients.
* Add debug button which opens a log of messages, enabled by adding query parameter ?debug=1 to URL.
* Time-out peers that haven't signalled in a while.
* Prevent actions which result in a revealed mini/template being attached to a hidden mini/template.
* Prevent negative elevations.
* Add close button to map/mini context menu.
* Add a palette of colours in the colour picker, modifiable and saved per-tabletop.
* Use the colour picker for changing grid colour in Map Editor. 
* Set page title to tabletop name.
* Switch to using gtove-relay-server on Heroku instead of httprelay.io (which has closed down)
* Support non-square grids (by stretching the map on the tabletop to make the grid square again).
* Support hexagonal grids (without Fog of War yet)
* Make some improvements to fallback relay-based peer-to-peer connections.
* Show the "load scenario?" confirmation only if there are maps or minis on the tabletop.
* Show a busy spinner while loading scenarios.
* Convert gTove from react-three-renderer to react-three-fibre and upgrade to React 16.
* Improve image quality by scaling up images to the next largest power of two, rather than leaving three.js to handle
    the scaling (which downscales).
* Fix styling of pop-up toasts.
* Set the background colour of miniatures, defaulting to top left pixel of the image.
* If the GM logs in multiple times, one GM client is nominated as the "primary" one.
* Make the p2p network a star topology, with the primary GM client at the hub having the definitive version.
* When missing actions can't be resolved, GM client will assert the current tabletop state.
* Make clients use the missing action system to automatically check for missing actions when they first connect, to pick
    up any activity that occurred since the tabletop was last saved.
* Show "tabletop needs saving" icon on all clients, not just GM's.
* Time out idle multicast nodes
* Improve the look of the placeholder used when a user has no avatar image set for their Google account.
* Make the snap-to-grid rotation of minis and templates on hexagonal grids snap to 60° rather than 45°.
* Allow players to rename minis, and prevent them from raising/lowering maps.
* Ignore "Lock position"-ed things when panning/rotating/zooming minis.
* Add physics-based 3D dice rolling.
* Make shift-left-click an alternative to middle-click to zoom/elevate things, for people using laptop touchpads.
* Long-press somewhere on the tabletop to "ping" it, showing an icon that others can click to zoom to that place.
* Bugfix: adding minis with the same name could rename the wrong mini to ensure unique names.
* Bugfix: would ping when rotating with two fingers on a touchscreen
* Improve reloading in the version mismatch dialog to explicitly update the cache.
* Show app version number in Avatars menu.
* Make dice rolls occur wherever the client's camera is pointing when the roll starts.
* Remove any dice when tabletop is cleared.
* Skip uniqueness test for minis with blank names (rather than creating mini names which are just numbers).
* Implement workaround to remove requirement for read-only access to user's Drive!
* Make hidden circle templates show a circle, without radial segments.
* Support renaming shortcuts (i.e. local file name overrides original).
* Make copying Tabletop URL remain in file browser if no Tabletop is selected.
* Add "Find by name" in Map, Mini and Template browsers.
* Add the option to add a scenario to the tabletop without clearing the tabletop first.
* Show current gTove version on the login screen.
* Repositioning a revealed map will move and rotate all pieces on that map as well.
* Repositioning a hidden map will move and rotate hidden pieces (only) on the map.
* Tabletop setting: Toggle whether everyone or only GM may ping a location by long-pressing.
* Make context menu close button larger, for touchscreens.
* Have 3 visibility states for pieces: always hidden, fogged (i.e. hidden or revealed by Fog of War) or always revealed.
* When repositioning a map, only adjust the bottom piece of a stack of "attached" pieces, since the position/rotation
    of the pieces higher up are relative to the bottom piece already.
* Add "Copy from..." menu option to the map editor, which copies the grid parameters from one map to another.
* Add undo/redo mechanism.
* Add a GM-only "lock" button to lock out other clients (even other GM clients) from performing actions (you can't
    undo/redo when others are connected without first locking).
* Add the ability to set the point on a map/level that the camera focuses on when going up/down or when resetting the
    camera.  Also change going up/down so that if there is no explicit focus point set on the destination level, the
    camera just moves vertically.
* Update the tutorial scenario text, set a camera focus on the upper level, add some monsters with "Fog" visibility.
* Fix bug: movement paths on "straight line" distance tabletops could fail to clear when confirmed.
* Make control-left-click an alternative to right-click to rotate, for people using laptop touchpads.
* Add a tabletop option to control which players can join.  A whitelist and blacklist can be preconfigured with email
    addresses, or anyone who is on neither list prompts the GM: "X is trying to join, allow/deny".
* Always enable dropping/raising map one level.  If it's already at the bottom/top, move by the default vertical offset. 
* Add an error boundary to report errors to users, rather than just displaying a white screen.
* Bug fix: handle maps and minis whose menu is open being deleted.
* Improve the handling of new gTove versions - detect if the service worker has cached a new version and prompt user.
* Redirect from HTTP to HTTPS in non-dev environments.
* Fix issue with users connecting to multicast tabletops.
* Make removing a map prompt to remove any pieces on it as well.
* Removing a map while leaving behind pieces now reveals any fogged pieces.
* Improve "undo grouping" so various changes caused by a single action undo/redo together.
* Improve the user experience after clicking "ignore" on the outdated version dialog.

## Plans/TODO

* Change ambient light levels (affect only maps)?  (E.g. light a daytime map to with dim blue light to make it look like
    night).  Is this worth doing without also adding point lights?
* Nominate an "entry point" for a scenario, where the camera first focuses on load.
* Cog button in LHS menu to open the current tabletop's settings?
* Style options for movement paths.  Option to use the grid colour of the starting map?
* A customizable hotbar or something to load in some often-used minis or templates for status effects.
* Animated map/mini textures?  Video element might be able to use "poster" tag for animated gifs?
* Right-click drag rotation is a bit flaky in direction rotated (e.g. click above the midpoint of a map and rotate) 
* Hide/show mini name
* Make a pass through the UI's text to consistently use "piece" to mean miniature or template.
* New template type: GM Note.  Just a coloured icon on the map, clicking opens full text, rich text editor? eg. https://github.com/jodit/jodit-react?  Include folds for collapsing content?
* Repositioning map - drop shadow on next map below
* Find by name on tabletop (could be combined with "Miniature list" feature).
* Elastic band selection tool, to select multiple minis/templates at once.
* Sanity checks for rootFolder, to protect against moving things in the Drive UI.
* Custom avatars
* Support for decks of cards?
* Bobby: Weird bug that happens sometimes: I click a mini and make it flat, then, leaving the context menu open, I click rename and the entire screen goes white.
* Try to optimise the order of auth vs anonymous GAPI calls (e.g. when I'm a player, try anonymous first).
* "Pull selected minis here"?  "All (visible) minis"?
* Add some way for GMs for force-zoom player cameras to their ping?
* Add (experimental?) option to toggle transparency on maps
* Toggle grid snap and free move per-mini/template (aka "piece")?
* Allow players to remove minis that they added (owner of the file)
* Change colour of mini/template name?  Formatting?
* Should store mini background colour swatches in tabletop
* Support Fog of War on hexagonal grids
    * Hexagonal fog of war shaders
    * Hexagonal fog of war mouse clicks/elastic drag
* Dice enhancements:
    * Ability for players to customise the colour of "their" dice.
    * Identify who made the dice roll.
    * Ability to have more than one person roll at once?
    * Ability to colour individual dice within a pool (so 4d6 in white, 3d6 in red, 2d6 in black)
    * Ability to hold (pin) some dice and reroll the rest (die context menu?)
    * Ability to customise dice faces (text, or uploaded image)
    * For games with complex dice pool mechanics, some way to save set-up pools for later re-use
* Do a pass through reducers, enforcing action.fromPeerId === undefined for most (make a localReducer() wrapper?)
* Try to re-establish WebRTC after sleeping?  Handler for onError?
* Investigate Dropbox API as a possible alternative to Google Drive.
* Zig-zag "straight paths" across the grain of hex grids don't always pass through the hexes a human would choose.
* Check for any props assigned to anonymous functions, which will cause unnecessary re-rendering. https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-bind.md
* Fog of War elastic rect selection doesn't show up well against rendered grid (since they're the same colour).
* Settable ownership of minis, so only certain people can manipulate them?
* Drive 403 error fetching images not re-trying in file browser?
* Ross was trying to navigate with the browser forward/back buttons.
* Need some way to move files/folders in file browser.
* Andrew requests a way to draw a multi-line polygon to select an area to clear fog of war.
* Bundles don't support templates.
* "Miniature list" feature, which pops up a table with the mini names.  "+ column" button to add a new column of
    editable fields to the table, and make it that you can sort the table ascending/descending by clicking a column
    heading, and you could use it for initiative tracking, hit points or anything else.  You'd also want a way to
    highlight/focus on a mini from its row in the table.  Also, checkbox on columns for "show as bar" for things like
    hitpoint bars.
* Would be nicer if revealed minis could be attached to hidden ones, and the Redux actions are automagically translated
    so that they work for both players and GMs. 
* Mini menu is getting large.  Perhaps have a "Setup" submenu with Hide/Show, Rename, Duplicate, Scale, Hide Base, Color Base
* Additional options for minis: "Possibly, having square and circle flat tokens would be fun. If its possible to allow
    transparency or even change the color of the White "cardboard", we could achieve some really fun effects."
* Add texture to template?  Alternatively, customise mini shape?
* Adaptive adjustment of the throttle on messages being sent if they're coming in faster than they can be processed?
* Multicast mode should have a private GM-only channel for GM-only messages, rather than relying on player clients ignoring them.
* Make side menu take up less room if not needed (e.g. for players without all the buttons)
* If I can get raycast to accurately detect a click on a labelSprite, make clicking name label open the rename UI. 
* Some way to specify fixed mini scales directly from the menu (x0.5, x1, x2, x3, x4, x5)
* Apparently, dragging minis on iDevices pans the camera as well
* Prevent adding bundle contents to bundles of your own?  If it's allowed, need to handle the fact that (because of the
    shortcut hack) selecting a bundled scenario doesn't select the corresponding (shortcuts to) maps and minis.
* When loading a Drive bundle, check if the bundle already exists in the user's Drive.
* Dynamic lighting, auto-removing fog of war?  Pretty hard to implement nicely...
* Should store URL-based image URLs in JSON so the appProperty length limit doesn't apply.  Will still need to support
    the webLink appProperty for backwards compatibility :(
* When extracting a bundle, check if it's owned by you.
* Disable picking files and file menu (and navigating?) when still uploading.
* Handle uploading PDFs.
* PDF- and zip- based bundles.
* Ruler.  Most basic is simply a straight line between the click and drag points.  More fancy uses Bresenham's to
    highlight the squares it passes over, and reports the distance.
* File browser - if user picks a new image, after editing and saving automatically act as if they had picked it again?
* Mini editor - backface configuration: greyscale+mirrored, colour+mirrored, greyscale, colour, another region of this
    image, another image.
* Browser compatibility.  Need to decide what browsers to support... Chrome, Firefox, Safari, Edge?
* It's possible to batch GAPI requests: https://developers.google.com/api-client-library/javascript/features/batch
* When the GM disconnects, ensure the last changes to the tabletop are saved - either show a warning, or delay the
    unload until a final flush has completed, or something.
* Highlight on minis at scale < 1 is barely visible.
* Was seeing something to make me think old PeerNodes were still active when the page reloads, but can't reproduce now.
* Have labels on minis which are GM-only?
* Remove backward-compatibility conversion code: startingPosition to movementPath, _x etc. in buildEuler
* Multi-select in file browser
* Option for infinite grid on the plane of the current map.
* Improve switching between online and offline - ideally, could log in and fetch stuff, then switch to working offline,
    then sync changes when you get online again, as long as you don't close the browser tab/window.
* Improve highlight shader - I'd prefer something that does a coloured outline.
* Adjust image opacity when aligning/scaling grid, in case pushpins or grid don't contrast enough with map.
* Interpolate mini movement actions from the network?
* Shader for minis handles transparency wrong.  Should just LERP the whole image onto 1,1,1,alpha.
* Have a textbox of letters/icons/emojis configurable in Tabletop, which become available to toggle on/off on minis to
    represent statuses or whatever.
* Doesn't seem to handle it well if the same client logs out and in as different users a few times.
* Allow minis with things other than circles for top-down? Square plus both orientations of hexes (or maybe auto-align
    with map if hex-based).
* Split app into separately loadable sections, to speed up initial load?  https://github.com/jamiebuilds/react-loadable
* Fog of War is a monochrome bitmap with one pixel per tile, but takes up 4 bytes per pixel.  Investigate ways to store
    it as a monochrome image, e.g. https://gist.github.com/vukicevic/8112515 (not sure if the browser doesn't just
    convert it to 32 bpp internally when it loads it anyway...)
* Freehand drawing tool?

# Graphics

## Monster Images

Would be nice if there was a way to buy bundles off content creators (such
as A Monster For Every Season from Rich Berlew).  Perhaps support the sharing of
user-generated packs for such commercial products.  If someone set up all the data
for one, they could share that file (it's already on drive) and someone else could
buy the same pack and use it directly.

* https://www.drivethrurpg.com/product/197640/Monster-StandIns-Virtual-Table-Top-Tokens-v1
* http://inkwellideas.com/monster-stand-ins/

Would require the app to be able to handle zip files of images, and extract images
from PDFs.

https://stuk.github.io/jszip/

https://stackoverflow.com/questions/12921052/parsing-pdf-pages-as-javascript-images

https://github.com/mozilla/pdf.js/ PDF.js will let you render the PDF to a canvas. Then you can do something like:
var img = new Image();
img.src = pdfCanvas.toDataURL();

https://stackoverflow.com/questions/18680261/extract-images-from-pdf-file-with-javascript

# Thoughts
* Toggle fog of war between "hide everything" and "hide terrain only" - the latter
useful for overland maps where you might want to place stick-pins and notes in
unexplored territory
* Some way to hide the navigation bar on mobile devices?  Android can "Install to home screen" with React manifest.json
* Draw a grid in WebGL using fragment shader: https://stackoverflow.com/questions/24772598/drawing-a-grid-in-a-webgl-fragment-shader

## View mobile chrome console on PC via USB:
adb forward tcp:9222 localabstract:chrome_devtools_remote

## Tutorial Videos

Would be good to make some short tutorial videos showing some of the app's features.
* Walkthrough of the tutorial.
* Basic usage - adding/configuring minis
* Basic usage - adding/configuring maps
* Basic usage - adding/configuring templates
* Basic usage - fog of war
* Basic usage - free movement, configuring movement params
* Advanced usage - attaching minis (including attaching hidden notes)
* Advanced usage - hidden map features using more than fog of war
* Advanced usage - pasting images, URL-based images
