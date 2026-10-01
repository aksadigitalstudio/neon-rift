# Verification — Neon Rift

Verified in desktop Chrome on October 1, 2026. The browser tests use real keyboard and mouse events plus the opt-in QA interface to arrange targets, power-ups, and deterministic simulation time.

All **37 automated checks passed**, with **zero critical browser console or runtime errors**.

Covered:

- Title screen, no spawning before Play, and first-wave start.
- All WASD and arrow-key directions, boundary containment, acceleration and deceleration.
- Space shooting and mouse aiming / left-button fire.
- Projectile collisions, enemy hit / destruction, score awards.
- Chaser contact damage, strafing movement and projectile attacks, heavy durability and destruction.
- Health restoration and cap, rapid-fire shot rate, shield damage blocking, timed expiration.
- Pause / resume.
- Safe spawn distance, wave bonus, progression through waves 1, 2, and 3.
- Natural death from enemy attacks, Game Over, final results, and complete restart reset.
- Resize at 1280×720, 1920×1080, 900×600, and 507×451.
- Final movement / shooting check and bounded geometry memory across repeated restarts.

The final offline-compatible package was additionally opened directly through file:// and played with real-time movement and shooting. It loads only local assets; there are no external images, models, fonts, APIs, or services.

The arena uses shared geometries and materials, a fixed 500-particle pool, capped enemies, limited lights, and bounded projectile lifetimes. Power-up resources, enemy materials, and shockwave materials are released when removed. Device pixel ratio is capped at 1.6.

For manual verification, open dist/index.html, click Play, test the listed controls, clear waves, collect each pickup, allow the drones to destroy the craft, and click Restart. Esc pauses; moving focus away automatically pauses.
