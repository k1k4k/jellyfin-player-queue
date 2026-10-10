# Changelog

What's new in each version, as shown in Jellyfin's plugin catalog.

## 0.7.0

- Works with SyncPlay: everything you do in the panel applies to the whole group.
- The panel updates by itself when someone else changes the queue.
- "Play next" and "Add to end of queue" now work during a SyncPlay session.

## 0.6.0

- The panel opens instantly, even for series with many seasons.
- The list no longer reloads or jumps after you add, move or remove an episode.
- Adding a big selection to the pending queue stops as soon as it's full, instead of making you wait.
- "Play all from here" on a season now really starts at that season.

## 0.5.1

- A message now tells you when the pending queue is full (200 items).
- "Play next" always works, even when the pending queue is full.

## 0.5.0

- Build a queue without playing anything: "Add to play queue" and "Play next" now work from the library when nothing is playing.
- Episodes, movies, seasons, whole series and collections pile up in a pending queue: review it, remove what you don't want, then play.
- Movies show proper artwork in the list.

## 0.4.1

- One "⋮" menu per episode (Play next, Add to end of queue, Remove) instead of several buttons.

## 0.4.0

- Reorder the queue by drag and drop.
- Remove items from the queue.
- "Play next" and "Add to end of queue" on any episode of the season.

## 0.3.2

- New name: Jellyfin Player Queue.

## 0.3.1

- Collections now play in release order instead of the order they were added to the library.

## 0.3.0

- First release as a Jellyfin plugin.
- Series view: the current season with previous episodes, and buttons to switch seasons.
- Click any episode to play it; playback continues into the following seasons.
