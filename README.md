# Palmera Heat

An original top-down 2D open-world crime game built for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01). Work for fixer Marisol Vega in the fictional coastal city of Palmera: steal cars, run packages, lose the heat, and pull off the bank job — all names, art and code are original, rendered in canvas with WebAudio-synthesised sound and zero external assets.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/syou6/palmera-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/syou6/palmera-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

## Play

Open `game/index.html` in a browser — no build step, no libraries, no network requests. Walk and sprint on foot, punch, enter or carjack any non-police car (5 models with distinct physics, drift and handbrake, crash damage), and take on a 5-mission story chain plus repeatable odd jobs. The wanted system runs 1–5 stars: patrol cars pursue and box you in, foot officers chase and arrest, and heat only decays while unseen — swap cars unseen or pay Tito $150 for a repaint to wipe it. Money and mission progress save between sessions.

## Build the entry

```
node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json`. Game source lives in `game/src/` split by role (city, config, world, vehicles, police, missions, hud, render, input, audio, random, shots, main).

## License

MIT — see `LICENSE`.
