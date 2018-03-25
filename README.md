# Virtual Gaming Tabletop

This project is a lightweight web application to simulate a virtual tabletop
on which can sit maps and miniatures.  To make the hosting costs as low as
possible and to allow other people to fork the project, Google Drive is used
to store shared resources such as the images for miniatures and maps, and to
persist data for things like scenarios.

## Implemented

* Maps and miniatures can be loaded into the app, and are saved to Google Drive.
* Add map(s) and minis to tabletop.
* Try to make mouse and gesture controls consistent - re-use the same gestures to control the camera, maps and minis as
much as possible.
* Camera can pan, zoom, rotate using mouse or touch gestures.
* By starting the mouse gesture/touch gesture on a mini, mini can be moved, elevated, rotated.
* By selecting a map (by clicking/tapping it), map can be moved, elevated, rotated. 
* The GM has a current tabletop, with a unique URL.  Players going to the URL join the tabletop.
* Peer-to-peer sharing of actions between everyone on the same tabletop.
* Show Google icon for the logged in user, and for other users connected to the tabletop.
* Selecting a different tabletop when one is already selected pops out a new window/tab.
* Clear the tabletop.
* Add a GM-private JSON file per tabletop for saving GM-only data like hidden minis, text notes.
* Hide/reveal minis and maps from/to players.
* Remove minis and maps individually from the tabletop.

## Plans/TODO

* Loading the scenario while events are being dispatched can cause the loading client to crash.
* Interpolate mini movement actions from the network?
* Tip over miniature to represent prone/dead/whatever.
* Probably shouldn't be so easy to pan/rotate/elevate map.  GM should be the only one who can, and they should have to
    unlock it first.
* Align/scale a grid on a map.  Required for fog of war.  Make it optional - a map doesn't have to have a grid.
* Top-down view for minis.
* Fog of war on maps with a grid defined.  Add and remove fog of war per tile.
* Due to httprelay.io relying on cookies, multiple tabs in the same browser are going to have issues.  Its cookie
    doesn't appear to be httpOnly, so we might be able to hack it with javascript.
* Remove textures from the Redux store (breaks redux dev tools)
* Recover from network failure e.g. sleep?  Also doesn't seem to handle it well if the same client logs out and in as
    different users a few times.
* Make nodes tell each other the number of peers they have, so any with less than others can invite connections?
* Optional grid overlay for maps with a grid defined.
* Minis have text names, size.  Also controls to duplicate (or spawn N), toggle visible to all vs. GM only.
* Allow cropping/selecting of area of image for minis.  Have stand and top-down versions - drag/zoom the frame over the
    image to select what is shown.  Allow minis with things other than circles for top-down? Square plus both
    orientations of hexes (or maybe auto-align with map if hex-based).
* Overlays - images which overlay the map to cover up secret doors and suchlike, or which can be added to reveal those
    secret areas (to protect against players who look at the underlying map image).
* Templates for spells etc.
* Ruler.  Most basic is simply a straight line between the click and drag points.  More fancy uses Bresenham's to
    highlight the squares it passes over, and reports the distance.  Requires the map (or game settings?) to nominate
    how distances are calculated in this game/map ("every 2nd diagonal costs 2", "count squares", "Pythagoras").  Maps
    could include an option of setting the scale.
* Default "tutorial" scenario which uses some of the advanced features. Requires the ability to put text down on the map
    to explain the features.

## Permissions

One thing that I'm unhappy about with the current implementation is the level of access the app currently needs to
request from the user.  In order to work, the app currently has to ask for read access to every file in the user's Drive
("drive.readonly"), even though it only needs to read the files that it itself creates.

There is a much more appropriate level of access that apps can request ("drive.file"), which is defined as "Per-file
access to files created or opened by the app. File authorization is granted on a per-user basis and is revoked when the
user deauthorizes the app."  Since the app creates all the files it needs to access, this seems like a perfect fit, and
is in fact what the app uses to allow GMs to create and modify files in Drive.

Unfortunately, the "granted on a per-user basis" piece is the killer... if the GM uploads a map image using the app (and
therefore the app created it), and then invites a player to the tabletop to view the map (by getting the app to share
the file), the *player's* Drive permissions say they can't see the file, because the player hasn't given the app
permission to open this new file that was just shared with them.  Getting the player to manually grant permission to the
app for every map image, monster image and JSON data file is not an acceptable user experience.

# Objects
List of data needed for each object type.  Put them in the order of importance - later ones imply non-essential
features.

## Map
* name
* texture file
* grid size/offset
* toggle: show grid
* toggle: snap to grid
* (optional) scale and units (1 square = ___ (feet/meters/lightyears/whatever))
* grid style (square/hex horizontal/hex vertical)

## Mini
* name
* texture file
* default size
* default flat
* crop size/offset (for top down and side view)
* crop type (top down square/circle/hex/whatever)

## Scenario
* name (current screen is also a scenario, the "current" one)
* map
  * camera position/orientation
  * show grid (override base)
  * snap to grid (override base)
  * fog of war
* minis
  * position/orientation
  * name (override base)
  * size (override base)
  * flat (override base)
  * visible to players
  * condition markers?
* text notes?
  * position
  * styling (colour/size/font/etc.)
  * visible to players

## Templates
* name
* shape (circle, cone, square, ...)
* size
* colour?

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

## Behaviour of Scenarios and Multiplayer

For Scenarios, the app should work like an exe working with files on a desktop... GM will explicitly save the current
state of the tabletop (either "save as" or "save" if loaded from an existing scenario file) and load previously saved
scenario files.

GMs also have tabletops, which show the current scenario being played.  This is where scenarios are loaded and saved -
loading a new scenario into the tabletop is how you move players from one encounter to another.  The GM can make new
tabletops for different campaigns, or as a temporary space for preparing scenarios which can then be saved and then
loaded into the main tabletop that is currently being shared with the players.

A tabletop is essentially the ID of a JSON file which contains the current scenario data, and is constantly auto-saved
as changes occur.  When a scenario is loaded, its contents are copied to this file; when it is saved, the contents of
the tabletop are written to a new or existing scenario file in the Scenarios directory.  The tabletop ID appears in the
URL, and everyone accessing the same URL is in the same tabletop.  The tabletop ID is also be used as the peer-to-peer
shared key.

The tabletop JSON file is readable (but not writable) by anyone who has the ID.  A tabletop also needs a JSON file which
is private to the GM,  where GM-specific data can be saved completely safe from tech-savvy players.

Players can access the tabletop when the GM is not around (loading the public JSON, and joining the peer-to-peer
group), but cannot make any changes to the tabletop until the GM joins (because they don't have permission to update
the file... only by dispatching Redux actions via P2P to the GM's client can players affect the state of the tabletop).
