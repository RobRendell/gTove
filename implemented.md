# Implemented features of gTove

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
### Version 313
* Make dice rolls occur wherever the client's camera is pointing when the roll starts.
* Remove any dice when tabletop is cleared.
* Skip uniqueness test for minis with blank names (rather than creating mini names which are just numbers).
* Implement workaround to remove requirement for read-only access to user's Drive!
* Make hidden circle templates show a circle, without radial segments.
* Support renaming shortcuts (i.e. local file name overrides original).
* Make copying Tabletop URL remain in file browser if no Tabletop is selected.
* Add "Find by name" in Map, Mini and Template browsers.
### Version 321
* Add the option to add a scenario to the tabletop without clearing the tabletop first.
* Show current gTove version on the login screen.
* Repositioning a revealed map will move and rotate all pieces on that map as well.
* Repositioning a hidden map will move and rotate hidden pieces (only) on the map.
* Tabletop setting: Toggle whether everyone or only GM may ping a location by long-pressing.
### Version 325
* Make context menu close button larger, for touchscreens.
* Have 3 visibility states for pieces: always hidden, fogged (i.e. hidden or revealed by Fog of War) or always revealed.
* When repositioning a map, only adjust the bottom piece of a stack of "attached" pieces, since the position/rotation
    of the pieces higher up are relative to the bottom piece already.
* Add "Copy from..." menu option to the map editor, which copies the grid parameters from one map to another.
### Version 333
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
### Version 336
* Always enable dropping/raising map one level.  If it's already at the bottom/top, move by the default vertical offset. 
* Add an error boundary to report errors to users, rather than just displaying a white screen.
* Bug fix: handle maps and minis whose menu is open being deleted.
### Version 339
* Improve the handling of new gTove versions - detect if the service worker has cached a new version and prompt user.
* Redirect from HTTP to HTTPS in non-dev environments.
### Version 340
* Fix issue with users connecting to multicast tabletops.
### Version 343
* Make removing a map prompt to remove any pieces on it as well.
* Removing a map while leaving behind pieces now reveals any fogged pieces.
* Improve "undo grouping" so various changes caused by a single action undo/redo together.
* Improve the user experience after clicking "ignore" on the outdated version dialog.
### Version 346
* Make the highlight glow around a template when it is selected slightly larger than the template itself.
* Fix bug: GM clients couldn't claim a tabletop lock on a locked tabletop.
### Version 351 
* Support animated mp4 or webm map/mini textures.
* Ensure grid configuration pushpins remain the same size, independent of map resolution or zoom.
* Make unpinned grid configuration pushpins pulse.
* Support meta keys on Macs, so undo/redo can be done with meta-Z/Y instead of ctrl-Z/Y.
* Allow bumping grid configuration pushpins via keyboard arrow keys, in addition to using the on-screen bump arrows.
* Fix some regressions with Offline mode.
* Reduce the "same level" vertical offset to 1.5 tiles (was 2.0)
* Always focus on the the highest elevation map(s) on a given level when going up/down or resetting the camera.
### Version 354
* Don't re-focus the camera when starting to reposition a map.
* Only change the camera's distance from the point it's looking at when resetting the camera.
* Make fixed-size grid pushpins work with smaller screens.
* Add hide/fog/show control to mini and template editors to control their default visibility when added to the tabletop.
### Version 358
* Implement custom tooltips, made visible by hovering the mouse or long-pressing on touchscreens.
### Version 361
* Fix bug: adjusting the position of animated minis in their frames caused a crash.
### Version 362
* Add the ability to select multiple files and folders in the file browser, which can then be moved to a different
    folder or all be "picked" (for maps, minis and templates).  Choose "Select" from a file or folder's menu, or drag a
    rubber band around items to select.  Touchscreen users can start the rubber band by long-pressing (to distinguish
    rubber banding from scrolling the file list.)
* Remove the "Pick all here" button from the Miniatures file browser, since rubber-band select is much more versatile.
### Version 373
* Create movable window wrapper, which starts as a draggable element, but can pop out into a separate window.
* Add button to show a roster of pieces on the tabletop in a movable window.  For players, this only shows revealed pieces.
* Change dice bag to appear in a movable window.
* Tweak dice initial velocities and spins to be less likely to equal zero in any axis.  If you roll dice, make sure
    everyone on the tabletop is on the same version!
* Fix bug: could no longer paste images or URLs into the file browser (broke in version 362)
* Add "focus" column to pieces roster, with icons which focus the camera on a particular mini when clicked.
* Fix bug: with grid snap on when rotating/elevating mini, could fail to snap back to the grid at gesture end.
### Version 376
* Make movable window resize better, and preserve the current state of what's inside when it's popped out.
* Make dice bag remain open if popped out, unless explicitly closed.
### Version 380
* Upgrade to newer versions of some of the dependent libraries.
* Allow the GM to customise the pieces roster columns: adding, rearranging and deleting columns (the Name and Focus
    columns are fixed).  A column can show a built-in value taken from the piece (prone, flat, visible etc.), or a
    custom value: string, number, bonus (i.e. a number that is always signed) or fraction (e.g. hit points).  Columns
    can be marked as visible to everyone or only the GM.  Custom values can be edited by anyone who can see them by
    clicking/tapping on the value in the pieces roster table. 
### Version 381
* Make pieces roster Name and Focus columns configurable as well. 
### Version 387
* Pieces roster improvements:
    * Prevent crash when sorting column is hidden/deleted.
    * Render un-edited numerator of fraction columns in a different colour, and with a tooltip.
    * Add a control to drag up or down to adjust number fields without typing.
* Fix undo/redo to require control-z/control-y, rather than happening when the z or y key is hit.
* Fix bug: parameter calculation for URL-based miniatures was incorrect, causing top-down view to show a single colour.
### Version 394
* Prevent a crash when a user starts a ping and then disconnects.
* Pieces roster improvements:
    * Clean up roster column values in minis for deleted columns
    * Send roster column values to players when existing GM-only columns become player-visible.
* Make mini scale only snap if you're adjusting scale, allowing you to give a mini a non-integer scale with grid snap
    off and then move it with grid snap on without scale suddenly snapping too.
### Version 398
* Pieces roster improvements:
    * Add option to display custom roster column values near minis.  Can also choose to hide mini names on the tabletop.
    * Add style to columns which are not visible to everyone.
* Remove the code to show up and down arrows when a client is partially connected - it didn't make anything clearer.
### Version 401
* Actually prevent the crash when a user starts a ping and then disconnects.
* Prevent crash when uploading new minis.
### Version 404
* Fix layout of roster column values near minis that are rotated, or scaled and flat.
* Reposition not-popped-out movable windows to the centre again if they end up outside the viewable area.
### Version 410
* Fix bug: set GM flag correctly when opening a saved tabletop belonging to another GM.
* Make other GM's saved tabletops use their Google Avatar as their thumbnail in tabletop browser. 
* Pieces roster improvement: show a fraction with a denominator of 0 as "full" or "up/down X".
### Version 415
* Pieces roster values: setting the denominator of fractions to/from 0 treats the numerator as an adjustment (i.e. if a
    piece has a fraction of -10/0 and then the denominator is set to 50, the value becomes 40/50).
* Make fractions default to a denominator of 0.
* Make pieces roster read-only when GM is not connected.
* Make pieces roster column sort order ignore case differences.
* Display dice pool total in dice bag.
### Version 419
* Freehand drawing tool.  A button on the tabletop opens a floating window with brush options.  When a brush is
    selected, mouse/touch will draw to an overlay on the touched map.  Original image will be unmodified.
### Version 420
* Fix crash when adding new maps or loading old scenarios due to missing paint layers.
### Version 422
* Give a player who owns a mini (i.e. added it to the tabletop) some of the same options as a GM (visibility control,
    un/mute video, un/lock position, hide/show base, colour base, rename, scale, duplicate, remove)
### Version 425
* Allow editing mini name directly in pieces roster.
* Add checkboxes to pieces roster to disable/hide custom pieces roster column values for certain minis.
* Add "Icon" template type - can select icon from a drop-down list, and select a colour.
* Add ability to set GM Notes on pieces: editable GM-only rich text which is shown just in the GM's client when
    opened from the menu.  Only one GM note can be open at once.
### Version 427
* Fix bug: scenario preview could hide elevated levels.
* Handle very large maps better - use map dimensions to inform the values of camera far plane, default camera position
    and max zoom out.
### Version 431
* Change "un/mute video" and "duplicate" back to GM-only on minis placed by players.
* Block tabletop-level undo/redo keyboard shortcuts when editing a GM note.
## Version 435
* Prevent crash when removing a piece with a visible GM Note.
* Scroll the editable area of the GM Note rich text editor if it gets too large.
## Version 438
* Limit the dimensions of the paint tool texture overlay, and only create it if there's some painting to render.
* Add Ruler tool for GMs and players to measure distances.
## Version 443
* Added more keyboard shortcuts, and documented them: https://github.com/RobRendell/gTove#keyboard-shortcuts
* Elastic band selection tool, to select multiple pieces at once.  Multi-selection can be moved, elevated or rotated.
## Version 448
* Add "Copy Tabletop..." menu item in tabletops browser to create a new tabletop which copies tabletop settings (grid
	scale details, pieces roster columns etc) from an existing tabletop.
* Fix bug: keyboard shortcuts remained disabled after editing pieces roster fields.
* Fix bug: zooming using the mouse wheel was unusably slow when Windows mouse wheel settings were set to scroll "one
	screen at a time". 
## Version 454
* Add the option to enable transparency on maps (marked as experimental).  Can cause visual glitches when other things
    with transparency (like hidden minis, or labels) are near the map.
* Save user preferences per-tabletop.
* Add user preference: select the colour of the dice they roll.
## Version 457
* Identify who made each dice roll.
* Allow more than one person to roll dice at once - dice from different people don't collide.
* Allow each person's collection of dice to be dragged, rotated or elevated, to separate them.
## Version 462
* Change dice physics to use a fixed time-step (duh), so the results are deterministic.  Everyone's dice rolls will be
    the same, and there's no need to wait for the GM's dice to settle to get the "definitive" result.
* Fade the text colour on dice faces that aren't the result after they settle. 
* Show which dice types were rolled in the dice bag.
* Add a toggle to the dice bag button to control whether it automatically closes or not after rolling/clearing.
