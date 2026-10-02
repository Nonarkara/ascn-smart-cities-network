# Overview video showcase

Register: Civic, on the existing white ASCN surface.

Design read: the videos make flood intelligence tangible through a field demonstration, a city operations desk, and a map-based analysis session.

Reference: the YouTube watch page's large player and compact video selector. The player is the dominant element; the ASCN 2026 record is a short band beneath it. Use the existing Source Sans 3 typography, square edges, and neutral colours, with amber for the selected video. A 3px selection marker carries state; 1px rules separate content.

Invariant: all three complete videos remain available, with one selected player and no automatic playback. Leaving Overview pauses playback. The full ASCN 9 record and the existing analytics remain available.

The Desktop originals remain untouched. `npm run prepare:showcase` creates smaller H.264/AAC copies and posters in `media/showcase/`. `npm test` checks selection, playback, navigation, and phone layouts.
