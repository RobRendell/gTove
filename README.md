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

## Support me on Pozible

I have a Pozible profile where very keen users can subscribe to this project, paying a monthly donation in exchange for
the ability to participate in monthly polls to determine what features I work on next.  Check it out here:
[https://www.pozible.com/profile/rob-rendell](https://www.pozible.com/profile/rob-rendell)

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
with the virtual tabletop, and the way users align the grid when editing a map is something I believe is very natural
once you get used to it (although it's definitely a bit of a learning curve).

## Permissions

To accesses your Google Drive and store its files, gTove requires "drive.file" access, which is defined as "Per-file
access to files created or opened by the app. File authorization is granted on a per-user basis and is revoked when the
user deauthorizes the app."

What that means is that the app cannot read, modify or delete any files in your Drive it does not create itself.

Note that this means that you cannot upload files or create folders for gTove in the Drive UI - gTove will not be able
to see them.  You need to add things using the app.  However, you can safely use the Google Drive UI to rearrange files
and folders that were created by the app (although moving files into different top-level folders, such as moving a
configured mini image into Maps, will certainly break things). 

# Features

## Implemented

The implemented list is very long, and has been moved into a [separate file](./implemented.md).  This section will now
only list recently completed items which have not yet been released.

* Freehand drawing tool.  A button on the tabletop opens a floating window with brush options.  When a brush is
    selected, mouse/touch will draw to an overlay on the touched map.  Original image will be unmodified.

## Plans/TODO

* Freehand drawing tool improvements:
    * Ability to create a new, blank map image with defined dimensions, background colour.
    * Option in colour picker to reset palette?  Un-select swatch value?
    * Support multiple layers on maps
        * Layer visibility toggle on/off.
        * Select which layer you're drawing to.
        * Create new layer, reorder layers, delete layer
    * Grid snap mode
    * Other tools?  Arcs/circles, rectangles, clone tool?, ...
    * Copy layers between maps.  Rescale layers.
    * Player-specific layer controls: view, draw to
    * "Flatten layers into new image & save" option to generate a new map image with the painted layers baked in, set
        grid params to that of the underlying map, clear the paint layers and replace the current map + paint layers.

* Pieces roster improvements:
    * Add new column - should auto-scroll to the bottom, where the new column appears.
    * Clicking to a new column value after editing doesn't save the value.
    * Toggle button for player-editable?
    * Support Markdown in string columns (possibly in name as well?)
    * Column type: "status" (icons which can be toggled on/off)
    * Click built-in values in column to change?  Especially name?
    * Styling options for "show near" - show fraction as bar, foreground/background colour, ...?
    * Drag individual rows around within sorted list?  For initiative tracking.
    * Prevent sorting rows while editing?  Can be confusing when the column you're editing reorders when you hit enter/tab
    * Might want filter options in columns - filter for "any non-empty" plus specific values?  "Not" checkbox?
        (e.g. if tracking initiative, could hide minis with no initiative value, to limit the table to things in the fight)

Features from the [last Pozible poll](https://www.pozible.com/profile/rob-rendell/activity/poll-finished-june-2020--2937b4d2-ad4d-4abc-8269-65083212f01c):

* New template type: GM Note.  Just a coloured icon on the map, clicking opens full text, rich text editor? eg. https://github.com/jodit/jodit-react?  Include folds for collapsing content?
* Support Fog of War on hexagonal grids (shaders, mouse clicks, elastic drag)
* Support uploading and viewing PDFs.
* Some way to change aspect ratio of standee minis, for things proportioned differently to a humanoid.
* Add Ruler button for GMs and players: click and drag to measure distances.  Use the tabletop distance configuration already being used for the miniature paths.
* Dice enhancements: Identify who made the dice roll. Ability to have more than one person roll at once.  Ability for players to customise the colour of "their" dice.
* Add some way for GMs for force-zoom player cameras to their ping?
* Dice enhancement: Ability to hold (pin) some dice and reroll the rest (die context menu?)
* Allow people to set custom avatar images (overrides their google avatar in the "who's connected" menu and in pings)

---

* Movable window when still freely resizing width can do this thing when clicking on something in it can pop up the
    scrollbar and otherwise ignore your click.
* Turn off grid snap, rotate map to random angle (minis on map move/rotate correctly), turn on grid snap and rotate map so it snaps: minis don't snap to the correct position/rotation. 
* Copy from (or duplicate?) tabletops, getting all the settings.
* Nominate an "entry point" for a scenario, where the camera first focuses on load.
* Change ambient light levels - affect only maps (e.g. light a daytime map with dim blue light to make it look like
    night).  Is this worth doing without also adding point lights?
* Duplicating a mini with visiblity "fog" won't update gmOnly based on the location the duplicates end up.
* Matt's crash during tabletop save caused the player and GM tabletop files to be out of sync.  Should make what's saved
    orthogonal, so only gmOnly data is saved in GM tabletop, and merge them together, so they can't be out of sync.
* Attached minis don't snap elevation/position (sometimes?  start with different elevations?), and can be hidden for going above interest level Y.
* Prevent dice from re-rolling when you re-open tabletop (probably just clear them if they have a result?)
* Adding a scenario with minis with old (i.e. missing) visibility values to a tabletop didn't update to default values.
* In map editor, after setting the grid with the drop-down, it retains focus as you start to move the pushpins, so using
    the arrow keys to bump the pushpins also re-opens/navigates in the dropdown.
* Tabletop permission to disabled "Combine Devices" on the tabletop.
* Make it possible to override the tabletop scale settings on specific scenarios?  Specific maps?
* Give haptic feedback on long press to start rubber band (and other times?): window.navigator.vibrate(200); // vibrate for 200ms
* Change rubberBandGroup context to a set of functions to modify selected, rather than a mutable object.
* Disable "Pick all selected" if none of them can be picked.
* "Select all here" button/control-A on file browser.
* Audio file support.  File browser of audio clips which can be uploaded, configured, picked to add to the tabletop.  On
    the tabletop, have an openable panel for the GM, shows all added audio clips with controls: play/pause, stop, volume
    control, mute/unmute(?), remove from tabletop.  Configuration in file browser could include setting the clip name,
    whether the clip loops, adding an image/icon/colour for how it displays in the tabletop panel, category name.
    Some way to random shuffle all clips in a category?
* Loading an m4v file as a mini caused browser freezes/issues when loaded to tabletop.  Should probably verify mime type
    of newly uploaded files in general (could also check if gif is animated and warn/advise about that too).
* Some mechanism to customise the tabletop background from grey.  "Nice-to-have to fill the tablecloth with either a repeating tile or image or gradient."
* Write a localFileAPI (or enhance the offlineAPI) to use the HTML5 FileSystem API.  To make it fully functional,
    players would need to be able to pull image and json data (currently read directly from Drive) from the GM client...
* Cog button in LHS menu to open the current tabletop's settings?
* Style options for movement paths.  Option to use the grid colour of the starting map?
* A customizable hotbar or something to load in some often-used minis or templates for status effects.
* Right-click drag rotation is a bit flaky in direction rotated (e.g. click above the midpoint of a map and rotate)
* Side-view UI to organise maps vertically, group maps into the same level vs. separate levels.
* Make a pass through the UI's text to consistently use "piece" to mean miniature or template.
* Repositioning map - drop shadow on next map below
* Elastic band selection tool, to select multiple minis/templates at once.
* Sanity checks for rootFolder, to protect against moving things in the Drive UI.
* Add Drive integration to allow "Open With": https://developers.google.com/drive/api/v3/integrate-open
* Support for decks of cards?
* Bobby: Weird bug that happens sometimes: I click a mini and make it flat, then, leaving the context menu open, I click rename and the entire screen goes white.
* Try to optimise the order of auth vs anonymous GAPI calls (e.g. when I'm a player, try anonymous first).
* Add (experimental?) option to toggle transparency on maps
* Toggle grid snap and free move per-mini/template (aka "piece")?
* Allow players to remove minis that they added (owner of the file)
* Change colour of mini/template name?  Formatting?
* Should store mini background colour swatches in tabletop
* Dice enhancement: Ability to colour individual dice within a pool (so 4d6 in white, 3d6 in red, 2d6 in black)
* Dice enhancement: Ability to customise dice faces (text, or uploaded image)
* Dice enhancement: For games with complex dice pool mechanics, some way to save set-up pools for later re-use
* Do a pass through reducers, enforcing action.fromPeerId === undefined for most (make a localReducer() wrapper?)
* Try to re-establish WebRTC after sleeping?  Handler for onError?
* Investigate Dropbox API as a possible alternative to Google Drive.
* Zig-zag "straight paths" across the grain of hex grids don't always pass through the hexes a human would choose.
* Check for any props assigned to anonymous functions, which will cause unnecessary re-rendering. https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-bind.md
* Fog of War elastic rect selection doesn't show up well against rendered grid (since they're the same colour).
* Settable ownership of minis, so only certain people can manipulate them?
* Ross was trying to navigate with the browser forward/back buttons.
* Andrew requests a way to draw a multi-line polygon to select an area to clear fog of war.
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
* Add templates to bundles
* Prevent adding bundle contents to bundles of your own?  If it's allowed, need to handle the fact that (because of the
    shortcut hack) selecting a bundled scenario doesn't select the corresponding (shortcuts to) maps and minis.
* When loading a Drive bundle, check if the bundle already exists in the user's Drive (including if it's owned by you.)
* Dynamic lighting, auto-removing fog of war?  Pretty hard to implement nicely...
* Should store URL-based image URLs in JSON so the appProperty length limit doesn't apply.  Will still need to support
    the webLink appProperty for backwards compatibility :(
* Disable picking files and file menu (and navigating?) when still uploading.
* PDF- and zip- based bundles.
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
* Multi-select in file browser (delete)
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
* Draw a grid in WebGL using fragment shader: https://stackoverflow.com/questions/24772598/drawing-a-grid-in-a-webgl-fragment-shader
* Update to https://github.com/jossef/material-design-icons-iconfont ?

# Graphics

## Monster Images

Would be nice if there was a way to buy bundles off content creators (such
as A Monster For Every Season from Rich Burlew).  Perhaps support the sharing of
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

## View mobile chrome console on PC via USB:
chrome://inspect/#devices


## Tutorial Videos

Tutorial video series showing some of the app's features.
* Introduction - done
* Maps
    * Adding map images to gTove - upload image(s) from disk (multiselect), add URL(s), paste image, paste url
    * "NEW" icon and "Edit" menu option
    * Configuring a map
        * Work through the options (grid type, colour etc.)
        * The pushpins
        * Best way to align a grid on a large map
        * Show grid on tabletop
    * Adding maps to tabletop
        * Maps add at camera focus point
        * Focus on empty space next to existing map - snap to the side
        * Focus on existing map - appears default height above.
    * Different visibility states: hidden/revealed vs. covered/uncovered (also, FoW requires a grid)
    * Manipulating a map on the tabletop
        * Lift/lower
        * Reposition: pan, rotate, elevate
    * Focus points, setting default focus point
    * Replacing a map to show a different map image (for secret or changing stuff)
        * Copy grid from existing map
        * If you mess up, what it looks like, you can replace with original (or use undo)
    * Animated maps
* Miniatures and Templates
    * Collectively known as "pieces"
    * Attaching minis (including attaching hidden notes)
* Tabletops and Scenarios
    * expected workflow - one tabletop per campaign, plus a prep tabletop
    * Prepare scenarios in advance on the prep tabletop and save as scenarios, or do it on the fly away from player eyes.
    * free movement, configuring movement params
