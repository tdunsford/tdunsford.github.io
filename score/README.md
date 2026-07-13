# MeepleKeeper

Offline web app for tracking game scores on mobile.

## What It Does

- Create a new game and select players from a saved list
- Reuse game names from a dropdown or add a new one
- Add new players with a name and emoji
- Save players permanently in `localStorage`
- Track scores during a game with add/subtract controls
- Keep a scoring timeline and allow undo of the last event
- Save finished games to local history
- Replay a history entry with the same game and players preselected
- Archive players, export/import data, and clear local data

## How It Works

This is a static no-build app made from:

- `index.html`
- `styles.css`
- `script.js`

All data is stored locally in the browser using `localStorage`. Nothing is sent to a server.

Storage keys:

- `scorekeeper.players.v1`
- `scorekeeper.activeGame.v1`
- `scorekeeper.history.v1`
- `scorekeeper.settings.v1`

## Main Flows

### Start a Game

1. Open the app.
2. Pick or add a game name.
3. Tap `Add Player` to create a player if needed.
4. Pick at least two players from the Saved Players list.
5. Tap `Start Game`.

### Score a Game

1. Tap `+` beside a player.
2. Choose `Add` or `Subtract`.
3. Enter points and submit.

The app highlights the last updated player and keeps that row in view.

### Finish a Game

1. Tap `Finish Game`.
2. The game is saved to History.

Recent history entries can be deleted for 30 minutes after completion, which is useful for testing.

## Player Management

- Players can be renamed from the Players section
- Players can be archived/unarchived from the Players section
- If a player has never appeared in a finished game, archiving deletes them instead

## Notes

- Designed primarily for iPhone/mobile use
- Works offline once the files are available locally
- Asset URLs use version query strings to help with mobile browser caching
- The visible app version starts at `v1.1`; bump it with each app change
