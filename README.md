# Sumo Bump

A small three.js party game for [start.ng](https://start.ng). Bump the other fighters off the island and be the last one standing. There are 5 rounds: round one is a big crowd, then each round has fewer but tougher fighters on a smaller island, and round 5 is a one-on-one with the boss, The Yokozuna. Beat him to become Grand Champion.

**Play:** https://sumo-bump.start.ng

## How to play

- **Move:** `W A S D` or the arrow keys. On a phone, drag the stick on the left.
- **Push:** tap `Space` (or the **DASH** button on a phone) for a quick short push. **Hold** it to charge a big push and release to lunge: it knocks harder and goes further, but you move slowly while charging and it takes longer to recharge. The arrow under you turns orange as it charges, and lights up green when an opponent is lined up.
- Each round is on a smaller island. Fall in the water and your run is over.
- Your score is **rounds won** (up to 5), then **knockouts** (fighters you bumped into the water).

## How it uses start.ng

Everything that talks to start.ng is in [`src/platform.js`](src/platform.js), following the [start.ng docs](https://start.ng/docs.md):

- **Who's playing:** the game loads `https://start.ng/connect` in a hidden frame and asks `startng:whoami`. It only trusts replies from `https://start.ng`. The game never sees passwords, tokens or emails.
- **Your character:** signed-in players fight as their start.ng character. Body, top and trouser colours, skin, hair and hair colour, hat and accessory all come from their start.ng style ([`src/character.js`](src/character.js)). Unknown values fall back to a default.
- **Guests:** use start.ng's guest look, and get a "Sign in with start.ng" button. If the start.ng homepage opened the game with `?guest`, it skips the sign-in question.
- **Sign in or out:** when you come back to the tab, the game asks again, so signing in or out on start.ng shows up straight away.
- **Leaderboard:** signed-in players' runs are saved with `startng:score`, using the columns in [`startng.json`](startng.json) (rounds won, then knockouts). Everyone can see the top 10 with `startng:leaderboard`. Away from start.ng, the board shows this device's own best runs.

## Run it locally

It's plain static files with no build step (three.js loads from jsDelivr). Serve the folder and open it:

```sh
python -m http.server 8000
```

Then open http://localhost:8000. Locally there's no start.ng sign-in, so you play as a guest. A **🎲 Try a look** button (local only) dresses your fighter in random start.ng styles, to check the character drawing.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `style.css` | The page, menus and touch controls |
| `src/game.js` | The game: island, fighters, bumps, rounds, scores |
| `src/character.js` | Builds a fighter from a start.ng style |
| `src/platform.js` | Talks to start.ng (player, sign-in, scores, leaderboard) |
| `src/audio.js` | Sound effects made with the Web Audio API |
| `startng.json` | Leaderboard columns |
| `cover.png` | The game's card picture on start.ng |
