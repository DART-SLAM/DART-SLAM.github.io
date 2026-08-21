# 3D Anchor-it visualization

This directory restores the approved continuous 3D interaction from
`/tmp/twinanchor-phone.Mn07A3/viewer.{html,js}`. It keeps the same real
HI-SLAM2 Gaussian fragments resident and interpolates their measured relative
similarity transforms from the broken gauges to their anchored placement.
There is no page reload or replacement map during the animation.

## Frozen inputs

- `pre_fragment.ply`
  - source: `/tmp/twinanchor-phone.Mn07A3/assets/kibo_bag2_pre_anchored.ply`
  - SHA-256: `8f77a86fac2c86fa28b64882314d38629f365d4251a7bdad1246b2d1350d5fb5`
- `post_fragment.ply`
  - source: `/tmp/twinanchor-phone.Mn07A3/assets/kibo_bag2_post_anchored.ply`
  - SHA-256: `c23109c93817e5ad5db5a734c56612c513824b05401feeb72af29789038ab7a1`

## Pinned runtime

- `vendor/playcanvas-2.21.0.esm.js`
  - source: `https://cdn.jsdelivr.net/npm/playcanvas@2.21.0/+esm`
  - SHA-256: `eaa0800fd0eb55768364b22cc57117b27d40805182f3821b2dcde0e24c0b6634`
  - vendored locally so the viewer does not depend on a third-party CDN at run time
- `vendor/PLAYCANVAS-LICENSE.txt`
  - source: PlayCanvas 2.21.0 package `LICENSE`
  - SHA-256: `42fa51ddd556be151a29f381fb97ee975825dcc454e805ea3ea9c079cca04d34`

## Claim boundary

This is a measured fragment-transform visualization retained for explaining
the gauge failure and correction. It is not the current causal KIBO trajectory
evaluation and must not be used to replace the reported `0.222 m / 2.17°`
sequence-level result. The current two-run output remains the final connected
map and is evaluated separately.

## Presentation-only camera change

`viewer.js` applies a 90-degree local camera roll so the ISS module's long
axis reads horizontally. A narrow-viewport camera-fit multiplier keeps that
horizontal view inside phone screens. Neither operation changes a Gaussian,
fragment pose, metric scale, or the measured Sim(3).

## Teaser regeneration

- live-scene capture: `/home/jungil/exp1/data_v2/scripts/capture_anchor_scene.py`
- capture schedule: 26 broken + 62 anchoring + 26 anchored frames at 24 fps
- final patch pipeline:
  `/home/jungil/exp1/data_v2/scripts/patch_legacy_teaser_final.py`
- replaced range only: teaser frames 965--1078; the approved scene order,
  timing, concept captions, and Anchor-it button are retained
- final `/assets/teaser.mp4` SHA-256:
  `7d69a5b8820d38d3546cb9f61f606a6a388829a7a145d38337f0716d1617b042`

The capture was also reproduced with all non-local host resolution disabled;
the 114 PNG frames were byte-identical to the frames used for the teaser.

## KIBO occlusion graph

`kibo-error-occlusion.svg` uses the locked audited KIBO series loaded by
`patch_legacy_teaser_final.py`. It explicitly marks the f50--f199 occlusion
interval and f200 anchor. The displayed POST RMSE values are HI-SLAM2
`8.131 m` and DART-SLAM `0.222 m`; both curves begin at f200.
SHA-256: `7751f4b1948a5357bc73feccdca6f026e5c7b16061032dfb1c56aec34812fa9f`.

## Embed

```html
<iframe
  src="assets/anchor-3d/index.html?embed=1"
  title="Interactive 3D Anchor-it reconstruction"
  loading="lazy">
</iframe>
```

Use `?state=anchored`, `?progress=0.5`, or `?autoplay=1` for deterministic
captures. `window.dartAnchor3D.setCorrection(0..1)` is also available after
load.
