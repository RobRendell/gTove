
Basic idea: use Google Drive as the data store: images for maps and minis,
JSON data for minis and maps and scenarios.  Have a single top-level folder
that VGT creates, then populate Minis, Maps, Scenarios, Player and GM folders
under that.  Hopefully with Drive being file-ID based, it won't matter if
the user subsequently moves the VGT top-level file into a subfolder.

There are two JSON files for every session - GM and player.  They are shared
so the players can see images and the Player JSON file but not the GM's,
ensuring tech-savvy players can't peek at things they shouldn't.  Well, they
can peek at the full map image.

If it doesn't work to make it all file-based in Drive, use PeerJS to allow
multiple browsers to share the session data.  Still use Drive to store data
and JSON, so a player can load the player map when the GM isn't around
(although prevent changes in this mode?) 

* Draw map on 3D plane which can be tilted, panned, zoomed.  Grid overlay
or not.
* Have minis which can be placed on the map, moved, deleted.  They have
text names, size, facing?  Also controls to duplicate (or spawn N), toggle
visible to all vs. GM only.
* Adjustable elevation on a mini, as if on a telescoping stalk.
* Allow cropping/selecting of area of image for minis.  Have stand and
top-down versions - drag/zoom the frame over the image to select what is
shown.  Allow minis with things other than circles for top-down? Square,
either orientation of hex (or maybe auto-align with map if hex-based)
* Maps with layers at different z depths, to have multiple levels in one map?
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
* React multi-touch library: https://github.com/AlloyTeam/AlloyFinger
* Some way to hide the navigation bar on mobile devices?  Android can "Install to home screen" with React manifest.json
* Draw a grid in WebGL using fragment shader: https://stackoverflow.com/questions/24772598/drawing-a-grid-in-a-webgl-fragment-shader
* Instead of reading in all the files and then trying to infer the root folder, could mark the root folder with a
specific appProperty (e.g. "rootFolder"), then search for it using files.list("appProperties has rootFolder") and work down from there.

## View mobile chrome console on PC via USB:
adb forward tcp:9222 localabstract:chrome_devtools_remote
