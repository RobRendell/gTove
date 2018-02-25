# Virtual Gaming Tabletop

This project is a lightweight web application to simulate a virtual tabletop
on which can sit maps and miniatures.  To make the hosting costs as low as
possible and to allow other people to fork the project, Google Drive is used
to store shared resources such as the images for miniatures and maps, and to
persist data for things like scenarios.

## Plans

At the moment, most of the below is planned but not yet implemented.

There are two JSON files for every session - GM and player.  They are shared
so the players can see images and the Player JSON file but not the GM's,
ensuring tech-savvy players can't peek at things they shouldn't.  Well, they
can peek at the full map image.

If it doesn't work to make it all file-based in Drive, use PeerJS to allow
multiple browsers to share the session data.  Still use Drive to store data
and JSON, so a player can load the player map when the GM isn't around
(although prevent changes in this mode?) 

* Draw map(s) on 3D plane which can be tilted, panned, zoomed.  Grid overlay
or not.
* Have minis which can be placed on the map, moved, deleted.  They have
text names, size, facing?  Also controls to duplicate (or spawn N), toggle
visible to all vs. GM only.
* Adjustable elevation on a mini, as if on a telescoping stalk.
* Try to make gesture controls as consistent as possible - re-use the
gestures to control the camera (pan/zoom/rotate), control minis (pan X/Z,
scale or maybe move Y, change facing), control selected maps (pan X/Z,
move Y, rotate).
* Allow cropping/selecting of area of image for minis.  Have stand and
top-down versions - drag/zoom the frame over the image to select what is
shown.  Allow minis with things other than circles for top-down? Square,
either orientation of hex (or maybe auto-align with map if hex-based)
* Scenarios.  Can have equivalent with map IDs with unique URLs, but that
means getting everyone to switch to a different URL rather than just loading
up a new scenario mid-session.
* Overlays - images which blend with the map to cover up secret doors and
suchlike, or which can be added to reveal those secret areas (to protect
against players who look at the underlying map image)
* Templates for spells etc.
* Ruler.  Most basic is simply a straight line between the click and drag
points.  More fancy uses Bresenham's to highlight the squares it passes over,
and reports the distance.  Requires the map (or game settings?) to nominate
how distances are calculated in this game/map ("every 2nd diagonal costs 2",
"count squares", "Pythagoras").  Maps could include an option of setting the
scale.
* Default "tutorial" scenario which uses some of the advanced features.
Requires the ability to put text down on the map to explain the features.

# Objects
List of data needed for each object type.  Put them in the order of
importance - later ones imply non-essential features.

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
* When in the "Maps" UI, have a radio-button-like selection of what you're doing:
replace current map, add as tile to current map, edit, delete
* Some way to hide the navigation bar on mobile devices?  Android can "Install to home screen" with React manifest.json
* Draw a grid in WebGL using fragment shader: https://stackoverflow.com/questions/24772598/drawing-a-grid-in-a-webgl-fragment-shader
* Instead of reading in all the files and then trying to infer the root folder, could mark the root folder with a
specific appProperty (e.g. "rootFolder"), then search for it using files.list("appProperties has rootFolder") and work down from there.

## View mobile chrome console on PC via USB:
adb forward tcp:9222 localabstract:chrome_devtools_remote

## Behaviour of Scenarios and Multiplayer

For Scenarios, the app should work like an exe working with files on a desktop... GM will explicitly save the current
state of the tabletop (either "save as" or "save" if loaded from an existing scenario file) and load previously saved
scenario files.

In addition, each GM will have a single "current scenario" file which is hidden from the scenarios UI, and is constantly
auto-saved as they make changes.  When a scenario is loaded, its contents are copied to current_scenario; when it is
saved, the contents of current_scenario are written to a new or existing file (overwriting it in the 2nd case).

For peer-to-peer to work, everyone needs a shared key.  The key appears in the URL, and thus everyone accessing the same
URL are in the same game.  Ideally, a GM should be able to load a new scenario mid-session without having to distribute
new URLs to everyone, so the shared key would therefore be tied to a GM and potentially a campaign but not a specific
scenario. 

The peerJS key could also be a Drive file metadata ID, since those are globally unique.  That means that a given URL
both defines who is in the game, and points to a Drive file with info in it.  Two possible ways it could work:
* If there is information in current_scenario which only the GM knows, players should not be given permission to read
it.  That means that the clients of players only get their scenario data (maps/minis including position etc) via peerJS
from the GM, and thus can't view anything when rejoining a game until the GM is connected.  The clients don't use the
peerJS key for anything other than establishing the P2P session (so the fact that it's a Drive metadata ID is
irrelevant).
* If GM secrets and player-visible info is separated out into two different files, then players could be given
permission to read the player file.  Players could view (but not edit) the current scenario when the GM is not around by
loading the Drive file with the metadata ID in the URL, as well as using that ID to set up P2P.  In fact, only the
current scenario would need to be split into two files like this; saved scenarios would have everything, but on loading
the system would divide information up into the player-only stuff in the shared current_scenario file and the complete
information in a current_scenario_GM file.

(Nice-to-have would be for a GM to be able to work on preparing a scenario sight unseen while players are currently
connected.)