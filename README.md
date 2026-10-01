# Neon Rift

A finished, self-contained 3D arcade survival shooter. All game visuals and sounds are generated procedurally. Three.js r170 is included locally under its MIT license. No network connection, account, API key, package installation, or server is needed to play.

## Play locally

Open **dist/index.html** in a current desktop browser (Chrome, Edge, or Firefox) with WebGL 2 / hardware acceleration enabled. Click **Play Neon Rift**.

## Controls

| Action | Controls |
| --- | --- |
| Move | WASD or arrow keys |
| Aim | Mouse pointer; without mouse input, the craft aims in its movement direction |
| Fire | Hold left mouse button or Space |
| Pause / resume | Esc or P |
| Toggle sound | M or speaker button |
| Fullscreen | F or fullscreen button |

Keep moving and destroy every enemy to finish a wave. New waves introduce strafers and heavy drones, with gradual increases in speed, health, and numbers.

- Chaser: pursues the player; 100 points.
- Strafer: circles the player and fires; 150 points.
- Heavy: slower, armored, fires projectiles; 300 points.
- Wave bonus: 250 × completed wave.
- Pickups: 50 points each. Health restores 30 hull; rapid fire lasts 10 seconds; shield blocks damage for 8 seconds.

Personal best and sound preference are saved on this browser when local storage is available. The game pauses when focus is lost.

## Deploy

Upload the **contents of dist/** to any static web host. The entry point is index.html. Keep the vendor folder beside it. There are no runtime services or external asset requests.

### Vercel

Import this repository into Vercel. The included `vercel.json` selects the static framework preset, runs `node build.cjs`, and serves `dist/`. No environment variables are required. Use the production URL as the public demo and confirm it opens without signing in.

## Edit

The readable source is **dist/game.js**, **dist/style.css**, **dist/responsive.css**, and **dist/index.html**. After changing game.js, run `node build.cjs` to regenerate game.classic.js. The included build script has no dependencies and converts the pinned Three.js ES module to a classic browser script, allowing direct file opening.

## Verification

See TESTING.md for the browser verification results. The opt-in `?qa=1` URL exposes a test interface; normal play does not expose it. `?qa=1&manual=1` allows deterministic simulation stepping for verification.

## License

Three.js is MIT licensed; see dist/vendor/THREE-LICENSE.txt. All other game code and procedural assets were created for this project.
