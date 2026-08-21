import {
  Application,
  Asset,
  AssetListLoader,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  GSPLAT_RENDERER_RASTER_CPU_SORT,
  Quat,
  RESOLUTION_AUTO,
  Vec3
} from 'playcanvas';

const params = new URLSearchParams(location.search);
const canvas = document.createElement('canvas');
canvas.setAttribute('aria-label', 'Interactive Gaussian reconstruction with two fragments moving into one metric frame');
document.body.prepend(canvas);

const app = new Application(canvas, { graphicsDeviceOptions: { antialias: false } });
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio, 1.5);
window.addEventListener('resize', () => app.resizeCanvas());
app.start();
app.scene.gsplat.renderer = GSPLAT_RENDERER_RASTER_CPU_SORT;

const loaderElement = document.querySelector('#loader');
const progressElement = document.querySelector('#progress');
const preAsset = new Asset('Pre-blackout fragment', 'gsplat', { url: 'pre_fragment.ply' });
const postAsset = new Asset('Post-blackout fragment', 'gsplat', { url: 'post_fragment.ply' });
const assets = [preAsset, postAsset];
let loaded = 0;
for (const asset of assets) {
  asset.on('load', () => {
    loaded += 1;
    progressElement.textContent = `${loaded} / ${assets.length}`;
  });
}

try {
  const assetLoader = new AssetListLoader(assets, app.assets);
  await new Promise((resolve, reject) => {
    for (const asset of assets) asset.once('error', reject);
    assetLoader.load(resolve);
  });
} catch (error) {
  loaderElement.classList.add('error');
  loaderElement.querySelector('.spinner')?.remove();
  progressElement.textContent = 'Could not load the Gaussian fragments';
  throw error;
}

const camera = new Entity('Camera');
camera.addComponent('camera', {
  clearColor: new Color(0.047, 0.047, 0.063),
  fov: 48,
  nearClip: 0.02,
  farClip: 250
});
app.root.addChild(camera);

// These are the exact independently reconstructed Gaussian fragments used by
// the approved 3D Anchor-it visualization. Both stay resident; only their
// measured relative similarity transforms change during the animation.
const pre = new Entity('Pre-blackout fragment');
pre.addComponent('gsplat', { asset: preAsset, unified: false });
app.root.addChild(pre);

const post = new Entity('Post-blackout fragment');
post.addComponent('gsplat', { asset: postAsset, unified: false });
app.root.addChild(post);

const identityRotation = new Quat(0, 0, 0, 1);
const fragments = [
  {
    entity: pre,
    anchoredPosition: new Vec3(0, 0, 0),
    brokenPosition: new Vec3(0.357004549236, 0.328218346704, -0.470864621053),
    brokenScale: 0.9917876302465208,
    brokenRotation: new Quat(0.009919599540, -0.026928446437, -0.013271868556, 0.999500033928),
    rotation: new Quat()
  },
  {
    entity: post,
    anchoredPosition: new Vec3(0, 0, 0),
    brokenPosition: new Vec3(24.609931540984, 20.054753182216, -28.175063745517),
    brokenScale: 3.285396226351411,
    brokenRotation: new Quat(-0.199107368844, -0.068137893270, -0.651616870195, 0.728772212457),
    rotation: new Quat()
  }
];

const view = {
  broken: { target: new Vec3(1.6988, -10.1118, 5.3856), distance: 35, yaw: -0.70, pitch: 0.30 },
  anchored: { target: new Vec3(10.97, -8.87, 4.78), distance: 11.2, yaw: -0.70, pitch: 0.30 }
};

const numberParam = (name, fallback) => {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
for (const preset of Object.values(view)) {
  preset.yaw = numberParam('yaw', preset.yaw);
  preset.pitch = numberParam('pitch', preset.pitch);
  preset.distance = numberParam('distance', preset.distance);
}

const requestedProgress = numberParam('progress', Number.NaN);
let correction = Number.isFinite(requestedProgress)
  ? Math.max(0, Math.min(1, requestedProgress))
  : (params.get('state') === 'anchored' ? 1 : 0);
let correctionGoal = correction;
let mode = correction >= 0.5 ? 'anchored' : 'broken';
let target = new Vec3();
let distance = view[mode].distance;
let yaw = view[mode].yaw;
let pitch = view[mode].pitch;
let zoomMultiplier = 1;
let transitioning = false;

const panel = document.querySelector('#panel');
const label = document.querySelector('#label');
const state = document.querySelector('#state');
const button = document.querySelector('#anchor-button');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const smoothstep = value => value * value * (3 - 2 * value);
const lerp = (a, b, value) => a + (b - a) * value;
const VIEW_ROLL_DEG = 90;

function setProgressCopy(direction = 1) {
  const eased = smoothstep(correction);
  const scale = Math.exp(lerp(Math.log(fragments[1].brokenScale), 0, eased));
  label.textContent = direction > 0 ? 'ANCHORING' : 'REVERSING';
  panel.classList.toggle('anchored', correction > 0.5);
  state.innerHTML = `Applying recovered pose and scale<br><b>relative scale ${scale.toFixed(2)}× → 1.00×</b>`;
}

function applyCorrection() {
  const eased = smoothstep(correction);
  for (const fragment of fragments) {
    const fragmentScale = Math.exp(lerp(Math.log(fragment.brokenScale), 0, eased));
    fragment.entity.setPosition(
      lerp(fragment.brokenPosition.x, fragment.anchoredPosition.x, eased),
      lerp(fragment.brokenPosition.y, fragment.anchoredPosition.y, eased),
      lerp(fragment.brokenPosition.z, fragment.anchoredPosition.z, eased)
    );
    fragment.entity.setLocalScale(fragmentScale, fragmentScale, fragmentScale);
    fragment.rotation.slerp(fragment.brokenRotation, identityRotation, eased);
    fragment.entity.setLocalRotation(fragment.rotation);
  }
  target.lerp(view.broken.target, view.anchored.target, eased);
  distance = Math.exp(lerp(Math.log(view.broken.distance), Math.log(view.anchored.distance), eased)) * zoomMultiplier;
  if (transitioning) setProgressCopy(correctionGoal > correction ? 1 : -1);
}

function setCopy() {
  const anchored = mode === 'anchored';
  panel.classList.toggle('anchored', anchored);
  label.textContent = anchored ? 'ANCHORED' : 'BROKEN';
  state.innerHTML = anchored
    ? 'Shared metric frame<br><b>the same Gaussian fragments connect</b>'
    : 'Independent gauges after blackout<br><b>the same module appears as disconnected fragments</b>';
  button.textContent = anchored ? 'Break it again' : 'Anchor it';
  button.setAttribute('aria-pressed', String(anchored));
}

function showMode(next, immediate = false) {
  mode = next;
  correctionGoal = next === 'anchored' ? 1 : 0;
  if (immediate) {
    correction = correctionGoal;
    transitioning = false;
    applyCorrection();
  }
  setCopy();
  button.disabled = false;
}

function toggleMode() {
  if (transitioning) return;
  const next = mode === 'broken' ? 'anchored' : 'broken';
  if (reducedMotion.matches) {
    showMode(next, true);
    return;
  }
  transitioning = true;
  button.disabled = true;
  correctionGoal = next === 'anchored' ? 1 : 0;
  mode = next;
  button.textContent = next === 'anchored' ? 'Anchoring…' : 'Reversing…';
}

button.addEventListener('click', toggleMode);
applyCorrection();
if (correction === 0 || correction === 1) setCopy();
else {
  setProgressCopy();
  button.textContent = 'Anchoring…';
}
button.disabled = false;
if (params.has('capture')) loaderElement.remove();
else loaderElement.classList.add('done');

function updateCamera() {
  const cp = Math.cos(pitch);
  const viewportAspect = app.graphicsDevice.width / app.graphicsDevice.height;
  // Preserve the horizontal presentation on narrow phones without touching
  // fragment geometry: widen the camera fit only when the viewport requires it.
  const narrowViewportFit = Math.max(
    1,
    Math.min(2.2, 0.52 * (16 / 9) / viewportAspect)
  );
  const presentationDistance = distance * narrowViewportFit;
  camera.setPosition(
    target.x + presentationDistance * Math.sin(yaw) * cp,
    target.y + presentationDistance * Math.sin(pitch),
    target.z + presentationDistance * Math.cos(yaw) * cp
  );
  camera.lookAt(target);
  // Presentation-only camera roll: keep every Gaussian and Sim(3) untouched
  // while placing the ISS module's long axis horizontally in the viewport.
  camera.rotateLocal(0, 0, VIEW_ROLL_DEG);
}

const pointers = new Map();
let lastPinchDistance = 0;
canvas.addEventListener('pointerdown', event => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture(event.pointerId);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    lastPinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', event => {
  const previous = pointers.get(event.pointerId);
  if (!previous) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastPinchDistance > 0 && pinchDistance > 0) {
      zoomMultiplier = Math.max(0.35, Math.min(3, zoomMultiplier * lastPinchDistance / pinchDistance));
      applyCorrection();
    }
    lastPinchDistance = pinchDistance;
    return;
  }
  yaw -= (event.clientX - previous.x) * 0.006;
  pitch = Math.max(-1.35, Math.min(1.35, pitch + (event.clientY - previous.y) * 0.006));
});
const endPointer = event => {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) lastPinchDistance = 0;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  zoomMultiplier = Math.max(0.35, Math.min(3, zoomMultiplier * Math.exp(event.deltaY * 0.001)));
  applyCorrection();
}, { passive: false });

let placementInitialized = false;
app.on('update', dt => {
  if (!placementInitialized) {
    placementInitialized = true;
    applyCorrection();
  }
  if (transitioning && correction !== correctionGoal) {
    const step = dt / 2.6;
    correction = correctionGoal > correction
      ? Math.min(correctionGoal, correction + step)
      : Math.max(correctionGoal, correction - step);
    applyCorrection();
    if (correction === correctionGoal) {
      transitioning = false;
      button.disabled = false;
      setCopy();
    }
  }
  updateCamera();
});
updateCamera();

if (params.has('capture') || params.has('embed')) document.querySelector('.back').hidden = true;
if (params.has('autoplay') && mode === 'broken') setTimeout(toggleMode, 1600);

function setCorrection(value) {
  correction = Math.max(0, Math.min(1, Number(value)));
  correctionGoal = correction;
  transitioning = false;
  mode = correction >= 1 ? 'anchored' : 'broken';
  applyCorrection();
  updateCamera();
  if (correction === 0 || correction === 1) setCopy();
  else {
    setProgressCopy();
    button.textContent = 'Anchoring…';
  }
  button.disabled = correction > 0 && correction < 1;
}

window.dartAnchor3D = { toggleMode, showMode, setCorrection, app, camera, pre, post };
// Backward-compatible capture hook used by the approved teaser pipeline.
window.twinAnchor = window.dartAnchor3D;
