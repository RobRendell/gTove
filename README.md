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

## Google+ Community
I've created a G+ Community for gTove where people can discuss the application, including discussing bugs before raising
then on Github and making feature suggestions.

[https://plus.google.com/u/0/communities/117392923845044055773](https://plus.google.com/u/0/communities/117392923845044055773)

## Basic User Guide

You can access gTove by going here: [https://illuminantgames.com/gtove](https://illuminantgames.com/gtove)

### Getting Started

After giving permission to the app to access your Google Drive (see [Permissions](#permissions) below), it will create
an empty folder structure at the top level of your Drive (which you can move elsewhere in your Drive if you like).  You
will be prompted to create your first "tabletop", which is a shared virtual gaming space that can contain maps and
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
controls on the left.  These controls allow you to toggle various tabletop-wide options like snap-to-grid and fog of
war, as well as allowing you to switch to a "player view" where fog of war is opaque and hidden maps and miniatures are
hidden, so you can see what your players will see.

The left-hand menu can be toggled on and off by clicking the ☰ menu symbol.

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
* Single finger tap or left mouse click to bring up a menu relating to the thing you clicked or tapped.  The options
available depend on whether you own the tabletop or not.
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
* Right click and drag, or rotate with two fingers, to rotate.
  * Rotating a miniature will rotate it on its base.
  * Rotating a map or on the background will orbit the camera around the point it's currently looking at, and also elevate
  between an oblique view or looking top-down on the tabletop.
  * If you are repositioning a map, rotating will rotate it around its centre.
* Middle click and drag, or two finger pinch, to zoom.
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

* You need Node.js installed.  I'm currently running version 8.11.1
* Check out the repository using your preferred git tool.
* (Optional) Install yarn: `npm install -g yarn`
* Change into the top level gTove directory: `cd gTove`
* Run `yarn install` (or `npm install` if you use npm) to install dependencies.  I use yarn, and therefore the repo has
    a yarn.lock and not a package.lock.
* After dependencies are installed, you can start a development server by running `yarn start` or `npm start`.

## Styling

At this stage, the app is quite minimally styled.  Many UI elements are just default HTML buttons, laid out in columns.
Once the major functionality is implemented, I'll try get someone who's good at graphic design to come up with a style
for the app and add the styling.  For now, the emphasis is on functionality.

That said, there are certain user interactions which I'm very happy with.  I like the unified mouse/gesture interface
with the virtual tabletop, and the way users align the grid when editing a map is most of the way to something I reckon
is intuitive and easy to use. 

## Permissions

One thing that I'm unhappy about with the current implementation is the level of access the app currently needs to
request from the user.  In order to work, the app currently has to ask for read access to every file in the user's
Google Drive ("drive.readonly"), even though it only needs to read the files that it itself creates.

There is a much more appropriate level of access that apps can request ("drive.file"), which is defined as "Per-file
access to files created or opened by the app. File authorization is granted on a per-user basis and is revoked when the
user deauthorizes the app."  Since the app creates all the files it needs to access, this seems like a perfect fit, and
is in fact what the app uses to allow GMs to create and modify files in Drive.

Unfortunately, the "granted on a per-user basis" piece is the killer... if the GM uploads a map image using the app (and
therefore the app created it), and then invites a player to the tabletop to view the map (by getting the app to share
the file), the *player's* Drive permissions say they can't see the file, because the player hasn't given the app
permission to open this new file that was just shared with them.  Getting the player to manually grant permission to the
app for every map image, monster image and JSON data file is not an acceptable user experience.

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
* Give the GM options with what to do when tabletop images fail to load - continue without the image (minis/maps will show black), remove anything that uses the image from the tabletop, or use a different image.
* Make larger flat or top down minis slightly thinner than smaller ones, so when overlapping the smaller mini remains visible.
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

## Plans/TODO

* Menu item on tabletop browser (and when in a tabletop?) to copy URL to clipboard, for users using the app fullscreen.
* Start side menu open for GMs, closed for players?
* If I can get raycast to accurately detect a click on a labelSprite, make clicking name label open the rename UI. 
* Add texture to template?  Alternatively, customise mini shape?
* Some way to specify fixed mini scales directly from the menu (x0.5, x1, x2, x3, x4, x5)
* Button to toggle between flat and standee mini in the miniature editor screen.
* Apparently, dragging minis on iDevices pans the camera as well
* Support players dropping maps and minis onto the tabletop?
* Prevent adding bundle contents to bundles of your own?  If it's allowed, need to handle the fact that (because of the
    shortcut hack) selecting a bundled scenario doesn't select the corresponding (shortcuts to) maps and minis.
* When loading a Drive bundle, check if the bundle already exists in the user's Drive.
* Dynamic lighting, auto-removing fog of war?  Pretty hard to implement nicely...
* Should store URL-based image URLs in JSON so the appProperty length limit doesn't apply.  Will still need to support
    the webLink appProperty for backwards compatibility :(
* When extracting a bundle, check if it's owned by you.
* Bug: removing a map doesn't trigger saving the tabletop file.  Also, covering an area with Fog of War.
* Disable picking files and file menu (and navigating?) when still uploading.
* Handle uploading PDFs.
* PDF- and zip- based bundles.
* Option to set the default scale of a mini image.
* Make the menu open by default only on empty tabletops (intended behaviour, but not working because the tabletop loads
    after gTove decides whether to open the menu or not)
* Ruler.  Most basic is simply a straight line between the click and drag points.  More fancy uses Bresenham's to
    highlight the squares it passes over, and reports the distance.
* File browser - if user picks a new image, after editing and saving automatically act as if they had picked it again?
* Mini editor - backface configuration: greyscale+mirrored, colour+mirrored, greyscale, colour, another region of this
    image, another image.
* Browser compatibility.  Need to decide what browsers to support... Chrome, Firefox, Safari, Edge?
* Google verification.
* It's possible to batch GAPI requests: https://developers.google.com/api-client-library/javascript/features/batch
* When the GM disconnects, ensure the last changes to the tabletop are saved - either show a warning, or delay the
    unload until a final flush has completed, or something.  Could also show a busy spinner in general when changes are
    pending to be saved.
* Highlight on minis at scale < 1 is barely visible.
* When offline, creating a tabletop never progresses from progress bar to cloud.
* Was seeing something to make me think old PeerNodes were still active when the page reloads, but can't reproduce now.
* Have labels on minis which are GM-only?
* Remove backward-compatibility conversion code: startingPosition to movementPath, _x etc. in buildEuler
* Multi-select in file browser
* Option for infinite grid on the plane of the current map.
* Refresh of folder contents should also detect files that have been removed.
* If GM logs in multiple times, all of their clients upload the tabletop data to Drive, potentially causing problems.
    Should nominate one GM client as the "primary".
* Improve switching between online and offline - ideally, could log in and fetch stuff, then switch to working offline,
    then sync changes when you get online again, as long as you don't close the browser tab/window.
* Improve highlight shader - I'd prefer something that does a coloured outline.
* Additional visibility mode for minis - "Hidden by Fog of War".  Perhaps default to this instead of hidden?
* Remember the name of other tabletops you've connected to, and show them in the Tabletops UI somehow?  Easy enough to
    do if they have the gTove files on Drive, but for non-GMs it might have to be something browser-specific like local
    storage.
* Adjust image opacity when aligning/scaling grid, in case pushpins or grid don't contrast enough with map.
* Define unstable_handleError() method on a top-level component to catch errors?
* Interpolate mini movement actions from the network?
* Shader for minis handles transparency wrong.  Should just LERP the whole image onto 1,1,1,alpha.
* Have a textbox of letters/icons/emojis configurable in Tabletop, which become available to toggle on/off on minis to
    represent statuses or whatever.
* Doesn't seem to handle it well if the same client logs out and in as different users a few times.
* Make nodes tell each other the number of peers they have, so any with less than others can invite connections?
* Allow minis with things other than circles for top-down? Square plus both orientations of hexes (or maybe auto-align
    with map if hex-based).
* Overlays - images which overlay the map to cover up secret doors and suchlike, or which can be added to reveal those
    secret areas (to protect against players who look at the underlying map image).
* Default "tutorial" scenario which uses some of the advanced features. Requires the ability to put text down on the map
    to explain the features - could just be templates with labels.
* Split app into separately loadable sections, to speed up initial load?  https://github.com/jamiebuilds/react-loadable
* Fog of War is a monochrome bitmap with one pixel per tile, but takes up 4 bytes per pixel.  Investigate ways to store
    it as a monochrome image, e.g. https://gist.github.com/vukicevic/8112515 (not sure if the browser doesn't just
    convert it to 32 bpp internally when it loads it anyway...)

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
