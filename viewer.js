import {
  Application,
  Asset,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  GSPLAT_RENDERER_RASTER_CPU_SORT,
  RESOLUTION_AUTO,
  Vec3
} from 'playcanvas';

const params = new URLSearchParams(location.search);
const canvas = document.createElement('canvas');
canvas.setAttribute('aria-label', 'Interactive final DART-SLAM Gaussian map');
document.body.prepend(canvas);

const app = new Application(canvas, { graphicsDeviceOptions: { antialias: false } });
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio, 1.5);
window.addEventListener('resize', () => app.resizeCanvas());
app.start();
app.scene.gsplat.renderer = GSPLAT_RENDERER_RASTER_CPU_SORT;

const mapAsset = new Asset('Final connected map', 'gsplat', {
  url: 'assets/kibo_bag2_connected_dart_slam_display_v1.ply'
});
app.assets.add(mapAsset);

const progress = document.querySelector('#progress');
mapAsset.on('progress', value => {
  progress.textContent = `${Math.round(value * 100)}%`;
});
await new Promise((resolve, reject) => {
  mapAsset.once('load', resolve);
  mapAsset.once('error', reject);
  app.assets.load(mapAsset);
});

const map = new Entity('Final connected map');
map.addComponent('gsplat', { asset: mapAsset, unified: false });
app.root.addChild(map);

const camera = new Entity('Camera');
camera.addComponent('camera', {
  clearColor: new Color(0.047, 0.047, 0.063),
  fov: 70,
  nearClip: 0.02,
  farClip: 250
});
app.root.addChild(camera);

const numberParam = (name, fallback) => {
  if (!params.has(name)) return fallback;
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
const target = new Vec3(
  numberParam('x', 11.321),
  numberParam('y', -9.335),
  numberParam('z', 3.444)
);
let distance = numberParam('distance', 3.0);
let yaw = numberParam('yaw', -0.399);
let pitch = numberParam('pitch', 0.973);

function updateCamera() {
  const cp = Math.cos(pitch);
  camera.setPosition(
    target.x + distance * Math.sin(yaw) * cp,
    target.y + distance * Math.sin(pitch),
    target.z + distance * Math.cos(yaw) * cp
  );
  camera.lookAt(target);
}

let pointerId = null;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', event => {
  pointerId = event.pointerId;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== pointerId) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  yaw -= dx * 0.006;
  pitch = Math.max(-1.35, Math.min(1.35, pitch + dy * 0.006));
  updateCamera();
});
const endPointer = event => {
  if (event.pointerId === pointerId) pointerId = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  distance = Math.max(0.6, Math.min(55, distance * Math.exp(event.deltaY * 0.001)));
  updateCamera();
}, { passive: false });

updateCamera();
const loader = document.querySelector('#loader');
if (params.has('capture')) loader.remove();
else {
  progress.textContent = 'Preparing view';
  const started = performance.now();
  const finish = () => {
    const sorter = map.gsplat?.instance?.sorter;
    const sorted = sorter?.orderData?.byteLength > 0 && sorter.pendingSorted === null;
    if (sorted && performance.now() - started > 900) loader.classList.add('done');
    else requestAnimationFrame(finish);
  };
  requestAnimationFrame(finish);
}

window.dartSlam = { app, camera, map, target, updateCamera };
