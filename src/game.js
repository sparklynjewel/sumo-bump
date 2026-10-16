import * as THREE from 'three';
import { buildCharacter, animateCharacter, normaliseStyle, randomStyle, DEFAULT_STYLE } from './character.js';
import { ON_START_NG, CHOSE_GUEST, getPlayer, onPlayerChange, signIn, saveRun, getLeaderboard } from './platform.js';
import { sfx, toggleMute, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);

// --- Who is playing ------------------------------------------------------------
const GUEST = { signedIn: false, id: 'guest', name: 'Guest', account: '', style: DEFAULT_STYLE, face: '' };
let me = { ...GUEST };
let choseGuest = CHOSE_GUEST;

function setIdentity(player) {
  if (player?.user) {
    const u = player.user;
    me = { signedIn: true, id: u.id, name: u.name || 'Player', account: u.account || '', style: normaliseStyle(u.style), face: u.face || '' };
  } else {
    const g = player?.guest;
    me = { ...GUEST, style: normaliseStyle(g?.style ?? DEFAULT_STYLE), face: g?.face || '', name: g?.name || 'Guest' };
  }
  refreshIdentityUI();
  rebuildPlayerModel();
}

function refreshIdentityUI() {
  $('profile').hidden = false;
  $('profile-face').src = me.face;
  $('profile-name').textContent = me.name;
  $('profile-account').textContent = me.signedIn ? (me.account ? `@${me.account}` : 'Signed in') : 'Not signed in';
  $('profile-sign-in').hidden = me.signedIn || !ON_START_NG;

  const signedOutChoice = ON_START_NG && !me.signedIn && !choseGuest;
  $('menu-signed-out').hidden = !signedOutChoice;
  $('menu-play-row').hidden = signedOutChoice;
  $('menu-greeting').textContent = me.signedIn
    ? `Welcome, ${me.name}! Your fighter is wearing your start.ng character.`
    : 'Bump everyone off the island. Last one standing wins the round.';
  const note = $('menu-note');
  if (!ON_START_NG) {
    note.hidden = false;
    note.textContent = 'Sign-in and the shared leaderboard work when the game is played at sumo-bump.start.ng. Here you play as a guest.';
  } else if (!me.signedIn && choseGuest) {
    note.hidden = false;
    note.textContent = 'Playing as a guest. Sign in to wear your own character and save your score.';
  } else {
    note.hidden = true;
  }
}

$('profile-sign-in').onclick = () => { sfx.click(); signIn(); };
$('menu-sign-in').onclick = () => { sfx.click(); signIn(); };
$('menu-guest').onclick = () => { sfx.click(); choseGuest = true; refreshIdentityUI(); };

// --- Scene -----------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffb36b');
scene.fog = new THREE.Fog('#ffb36b', 22, 48);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
const CAMERA_HOME = new THREE.Vector3(0, 11.5, 11);

scene.add(new THREE.HemisphereLight('#fff4e0', '#1e5c8a', 1.1));
const sun = new THREE.DirectionalLight('#ffffff', 1.7);
sun.position.set(5, 12, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
scene.add(sun);

const WATER_Y = -1.2;
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ color: '#1e88e5', roughness: 0.25, metalness: 0.1 }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_Y;
scene.add(water);

const START_RADIUS = 6.5;
const ROUND_SIZES = [6.5, 5.8, 5.1, 4.5]; // island size for rounds 1-4 (fixed during a round)
const SMALLEST_ISLAND = 4.0; // the final round
const FINAL_ROUND = 5; // one-on-one with the boss; winning it ends the run as Grand Champion
const island = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 1, 48), new THREE.MeshStandardMaterial({ color: '#e8d5a3' }));
island.position.y = -0.5;
island.receiveShadow = true;
scene.add(island);
const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 72), new THREE.MeshBasicMaterial({ color: '#b5462f' }));
rim.rotation.x = Math.PI / 2;
rim.position.y = 0.02;
scene.add(rim);

// A few palm trees in the distance for atmosphere
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.4;
  const tree = new THREE.Group();
  tree.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.6, 6), new THREE.MeshStandardMaterial({ color: '#8d6e63' })));
  tree.children[0].position.y = 1.3;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1, 0.6, 7), new THREE.MeshStandardMaterial({ color: '#2e7d32' }));
  leaves.position.y = 2.7;
  tree.add(leaves);
  const islet = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16), new THREE.MeshStandardMaterial({ color: '#e8d5a3' }));
  islet.position.y = -0.1;
  tree.add(islet);
  tree.position.set(Math.cos(a) * 17, WATER_Y + 0.1, Math.sin(a) * 17 - 4);
  scene.add(tree);
}

// --- Effects -------------------------------------------------------------------------
const effects = [];
function splash(x, z) {
  for (let i = 0; i < 3; i++) {
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(x, WATER_Y + 0.02, z);
    scene.add(ringMesh);
    effects.push({ mesh: ringMesh, life: 1 + i * 0.25, age: -i * 0.12, grow: 3 + i });
  }
}
function puff(x, z) {
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.8 }));
    p.position.set(x + (Math.random() - 0.5) * 0.4, 0.15, z + (Math.random() - 0.5) * 0.4);
    scene.add(p);
    effects.push({ mesh: p, life: 0.5, age: 0, grow: 2, rise: 0.8 });
  }
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.age += dt;
    if (e.age < 0) continue;
    const k = e.age / e.life;
    e.mesh.scale.setScalar(1 + k * e.grow);
    e.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (e.rise) e.mesh.position.y += e.rise * dt;
    if (k >= 1) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      effects.splice(i, 1);
    }
  }
}

let shake = 0;
const popups = [];
function popup(text, x, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.font = '900 64px system-ui, sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 10;
  c.strokeStyle = '#292a23';
  c.strokeText(text, 128, 70);
  c.fillStyle = '#d8fd71';
  c.fillText(text, 128, 70);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  sprite.scale.set(2.4, 0.9, 1);
  sprite.position.set(x, 2.6, z);
  scene.add(sprite);
  popups.push({ sprite, age: 0 });
}
function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    p.sprite.position.y += dt * 1.2;
    p.sprite.material.opacity = Math.max(0, 1 - p.age / 1.2);
    if (p.age > 1.2) {
      scene.remove(p.sprite);
      p.sprite.material.map.dispose();
      p.sprite.material.dispose();
      popups.splice(i, 1);
    }
  }
}

// A name tag that floats above the player's fighter
function nameTag(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  c.fillStyle = 'rgba(41,42,35,0.85)';
  c.beginPath();
  c.roundRect(8, 8, 240, 48, 24);
  c.fill();
  c.font = '700 28px system-ui, sans-serif';
  c.fillStyle = '#d8fd71';
  c.textAlign = 'center';
  c.fillText(text.length > 14 ? `${text.slice(0, 13)}…` : text, 128, 42);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.35;
  return sprite;
}

// A flat arrow on the ground showing which way the player will dash.
// It lights up when the aim assist has an opponent locked.
function addDashArrow(model) {
  // Drawn pointing down (-y): once laid flat with rotation.x = -90deg, that's forward (+z)
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.42);
  shape.lineTo(0.3, 0);
  shape.lineTo(0.11, 0);
  shape.lineTo(0.11, 0.3);
  shape.lineTo(-0.11, 0.3);
  shape.lineTo(-0.11, 0);
  shape.lineTo(-0.3, 0);
  shape.closePath();
  const arrow = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  arrow.rotation.x = -Math.PI / 2; // lie flat, pointing forward (+z)
  arrow.position.set(0, 0.04, 0.85);
  model.add(arrow);
  model.userData.arrow = arrow;
}

// Markers that make the player easy to spot: a glowing ring under the feet,
// and a bouncing "YOU" sign above the head at the start of each round.
function addPlayerMarkers(model) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 40),
    new THREE.MeshBasicMaterial({ color: '#d8fd71', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  model.add(ring);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.font = '900 64px system-ui, sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 10;
  c.strokeStyle = '#292a23';
  c.fillStyle = '#d8fd71';
  c.strokeText('YOU', 128, 60);
  c.fillText('YOU', 128, 60);
  c.strokeText('▼', 128, 118);
  c.fillText('▼', 128, 118);
  const you = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  you.scale.set(1.2, 0.6, 1);
  you.position.y = 3;
  model.add(you);

  model.userData.ring = ring;
  model.userData.you = you;
}

// --- Fighters --------------------------------------------------------------------------
const BODY_R = 0.45;
let fighters = [];

// The final round's boss: bigger, heavier and harder-hitting, wearing a crown.
const BOSS = { name: 'The Yokozuna', size: 1.35, mass: 2.0, power: 1.4 };
const bossStyle = () => ({ ...randomStyle(), body: 'male', hat: 'crown', primaryColor: '#b71c1c', secondaryColor: '#1b1b1b' });

function makeFighter(style, isPlayer, angle, distance = 3.6, boss = false) {
  const model = buildCharacter(style);
  if (isPlayer) {
    model.add(nameTag(me.name));
    addDashArrow(model);
    addPlayerMarkers(model);
  }
  if (boss) {
    const tag = nameTag(BOSS.name);
    tag.position.y = 2.1; // inside the scaled-up model this lands above the crown
    model.add(tag);
  }
  scene.add(model);
  return {
    model, isPlayer, boss, alive: true, falling: false, splashed: false,
    x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, y: 0,
    vx: 0, vz: 0, vy: 0, dashCooldown: 0, dashing: 0, lastHit: null,
    think: 0.6 + Math.random(), target: null, retarget: 0,
    charging: false, charge: 0, releaseAt: 0, hitBonus: 4.5,
    size: boss ? BOSS.size : 1, // drawn size
    radius: BODY_R * (boss ? BOSS.size : 1), // collision size
    mass: boss ? BOSS.mass : 1, // heavier fighters are knocked back less
    power: boss ? BOSS.power : 1, // and hit harder
  };
}
function clearFighters() {
  for (const f of fighters) scene.remove(f.model);
  fighters = [];
}
const player = () => fighters.find((f) => f.isPlayer);

function rebuildPlayerModel() {
  const p = player();
  if (!p) return;
  scene.remove(p.model);
  p.model = buildCharacter(me.style);
  p.model.add(nameTag(me.name));
  addDashArrow(p.model);
  addPlayerMarkers(p.model);
  scene.add(p.model);
}

// --- Run and round state -------------------------------------------------------------------
const game = { mode: 'menu', round: 1, knockouts: 0, radius: START_RADIUS, time: 0, skill: 1 };

function showOnly(id) {
  for (const s of ['menu', 'result', 'board']) $(s).hidden = s !== id;
  $('hud').hidden = id !== null;
  $('touch').hidden = !(id === null && isTouch);
}

function showMenuScene() {
  clearFighters();
  game.radius = START_RADIUS;
  fighters.push(makeFighter(me.style, true, 0, 0));
  game.mode = 'menu';
  showOnly('menu');
}

function startRun() {
  game.round = 1;
  game.knockouts = 0;
  startRound();
}

function startRound() {
  clearFighters();
  game.mode = 'playing';
  game.time = 0;
  // The island is a fixed size for the whole round, and smaller every round
  game.startRadius = ROUND_SIZES[game.round - 1] ?? SMALLEST_ISLAND;
  game.radius = game.startRadius;
  // Big crowd first, then fewer but tougher bots as the island gets smaller,
  // and a one-on-one with the boss in the final round
  game.skill = 1 + (game.round - 1) * 0.3;
  const final = game.round === FINAL_ROUND;
  const spawn = game.startRadius * 0.55; // start well inside the edge, whatever the island size
  fighters.push(makeFighter(me.style, true, Math.PI / 2, spawn));
  if (final) {
    fighters.push(makeFighter(bossStyle(), false, -Math.PI / 2, spawn, true));
  } else {
    const bots = 6 - game.round; // 5, 4, 3, 2
    const total = bots + 1;
    for (let i = 1; i < total; i++) fighters.push(makeFighter(randomStyle(), false, Math.PI / 2 + (i * Math.PI * 2) / total, spawn));
  }
  updateHud();
  showOnly(null);
  if (final) popup('BOSS!', 0, 0);
}

function updateHud() {
  $('hud-round').textContent = game.round === FINAL_ROUND ? 'Final round' : `Round ${game.round} of ${FINAL_ROUND}`;
  $('hud-left').textContent = `Left: ${fighters.filter((f) => f.alive && !f.falling).length}`;
  $('hud-ko').textContent = `KOs: ${game.knockouts}`;
}

function roundWon() {
  if (game.round === FINAL_ROUND) {
    finishRun(true);
    return;
  }
  game.mode = 'between';
  sfx.win();
  const next = game.round + 1;
  $('result-title').textContent = `🏆 Round ${game.round} cleared!`;
  $('result-text').textContent = next === FINAL_ROUND
    ? `Knockouts so far: ${game.knockouts}. Next: the final boss, ${BOSS.name}! Big, heavy and hard to move.`
    : `Knockouts so far: ${game.knockouts}. Next round: a smaller island and tougher fighters.`;
  $('result-save').textContent = '';
  $('result-board').replaceChildren();
  $('result-next').textContent = next === FINAL_ROUND ? 'Face the boss' : `Start round ${next}`;
  $('result-next').onclick = () => { sfx.click(); game.round = next; startRound(); };
  showOnly('result');
}

const runOver = () => finishRun(false);

// End of a run: won = beat the boss (Grand Champion), otherwise the player fell in.
async function finishRun(won) {
  game.mode = 'over';
  if (won) sfx.win();
  else sfx.lose();
  const stats = { rounds: won ? FINAL_ROUND : game.round - 1, knockouts: game.knockouts };
  $('result-title').textContent = won ? '🏆 Grand Champion!' : '💦 Splash! You fell in';
  $('result-text').textContent = won
    ? `You beat ${BOSS.name} and won all ${FINAL_ROUND} rounds, with ${stats.knockouts} knockouts.`
    : `Rounds won: ${stats.rounds} of ${FINAL_ROUND} · Knockouts: ${stats.knockouts}`;
  $('result-next').textContent = 'Play again';
  $('result-next').onclick = () => { sfx.click(); startRun(); };
  $('result-board').replaceChildren();
  showOnly('result');

  saveLocalBest(stats);
  const saveNote = $('result-save');
  if (me.signedIn) {
    saveNote.textContent = 'Saving your run…';
    const saved = await saveRun(stats);
    if (saved?.ok) {
      const r = saved.result;
      saveNote.textContent = r.improved ? `New personal best! You're #${r.rank}.` : `Saved. Your best is still ${r.best} rounds (#${r.rank}).`;
    } else {
      saveNote.textContent = saved?.error || "Couldn't reach start.ng, so this run wasn't saved.";
    }
  } else if (ON_START_NG) {
    saveNote.textContent = 'Sign in with start.ng to save your score on the leaderboard.';
  } else {
    saveNote.textContent = 'Saved on this device. The shared leaderboard works at sumo-bump.start.ng.';
  }
  renderBoard($('result-board'), await loadBoard());
}

$('result-menu').onclick = () => { sfx.click(); showMenuScene(); };
$('menu-play').onclick = () => { sfx.click(); startRun(); };

// --- Leaderboard ------------------------------------------------------------------------------
const LOCAL_KEY = 'sumo-bump:local-board';
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
}
const better = (a, b) => a.rounds - b.rounds || a.knockouts - b.knockouts;
function saveLocalBest(stats) {
  const list = readLocal();
  const row = list.find((r) => r.id === me.id);
  const entry = { id: me.id, name: me.name, color: me.style.primaryColor, ...stats };
  if (!row) list.push(entry);
  else if (better(entry, row) > 0) Object.assign(row, entry);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

async function loadBoard() {
  const shared = await getLeaderboard(10);
  if (shared) {
    return {
      shared: true,
      rows: shared.map((e) => ({ rank: e.rank, id: e.player_id, name: e.name, color: e.color, rounds: e.stats?.rounds ?? e.score ?? 0, knockouts: e.stats?.knockouts ?? 0 })),
    };
  }
  const rows = readLocal().sort((a, b) => better(b, a)).slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
  return { shared: false, rows };
}

function renderBoard(list, board) {
  list.replaceChildren(...board.rows.map((r) => {
    const li = document.createElement('li');
    if (r.id === me.id) li.className = 'me';
    const rank = Object.assign(document.createElement('span'), { className: 'rank', textContent: `#${r.rank}` });
    const dot = Object.assign(document.createElement('span'), { className: 'dot' });
    dot.style.background = r.color || '#999';
    const name = Object.assign(document.createElement('span'), { className: 'name', textContent: r.name });
    const stat = Object.assign(document.createElement('span'), { className: 'stat', textContent: `${r.rounds} rounds · ${r.knockouts} KOs` });
    li.append(rank, dot, name, stat);
    return li;
  }));
}

$('menu-board').onclick = async () => {
  sfx.click();
  showOnly('board');
  $('board-note').textContent = 'Loading…';
  const board = await loadBoard();
  $('board-note').textContent = board.shared ? 'Best runs on start.ng: rounds won, then knockouts.' : 'Best runs on this device. The shared board is on sumo-bump.start.ng.';
  renderBoard($('board-list'), board);
};
$('board-close').onclick = () => { sfx.click(); showMenuScene(); };

// --- Controls -----------------------------------------------------------------------------------
const keys = new Set();
const isTouch = matchMedia('(pointer: coarse)').matches;
const touchAxis = { x: 0, z: 0 };

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') {
    e.preventDefault();
    if (game.mode === 'playing' && !e.repeat) startCharge(player());
  }
  if (e.code === 'Enter') {
    if (game.mode === 'menu' && !$('menu-play-row').hidden) startRun();
    else if ((game.mode === 'over' || game.mode === 'between') && !$('result').hidden) $('result-next').click();
  }
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space' && game.mode === 'playing') releaseCharge(player());
});
addEventListener('blur', () => {
  keys.clear();
  const p = player();
  if (p) { p.charging = false; p.charge = 0; } // switching away cancels a charge
});

const stick = $('stick');
const knob = $('knob');
let stickId = null;
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touchAxis.x = dx / max;
  touchAxis.z = dy / max;
}
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
const releaseStick = (e) => {
  if (e.pointerId !== stickId) return;
  stickId = null;
  touchAxis.x = 0;
  touchAxis.z = 0;
  knob.style.transform = '';
};
stick.addEventListener('pointerup', releaseStick);
stick.addEventListener('pointercancel', releaseStick);
const dashBtn = $('dash-btn');
dashBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  dashBtn.setPointerCapture(e.pointerId);
  if (game.mode === 'playing') startCharge(player());
});
for (const type of ['pointerup', 'pointercancel']) {
  dashBtn.addEventListener(type, () => { if (game.mode === 'playing') releaseCharge(player()); });
}

$('mute').textContent = isMuted() ? '🔇' : '🔊';
$('mute').onclick = () => { $('mute').textContent = toggleMute() ? '🔇' : '🔊'; };

// Local testing only: try random start.ng looks without signing in
if (!ON_START_NG) {
  $('style-test').hidden = false;
  $('style-test').onclick = () => {
    me = { ...me, style: normaliseStyle(randomStyle()) };
    rebuildPlayerModel();
  };
}

// The way a fighter is heading: where it's moving, or where it's facing when still.
function heading(f) {
  const speed = Math.hypot(f.vx, f.vz);
  return speed > 0.2 ? [f.vx / speed, f.vz / speed] : [Math.sin(f.model.rotation.y), Math.cos(f.model.rotation.y)];
}

// Aim assist: the nearest opponent roughly in front (within ~70 degrees and 4 metres).
const AIM_RANGE = 4;
const AIM_CONE = Math.cos((70 * Math.PI) / 180);
function aimTarget(f) {
  const [hx, hz] = heading(f);
  let best = null;
  let bestD = AIM_RANGE;
  for (const o of fighters) {
    if (o === f || !o.alive || o.falling) continue;
    const dx = o.x - f.x;
    const dz = o.z - f.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD && (dx * hx + dz * hz) / d > AIM_CONE) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

// Holding dash charges a big push; a quick tap is a short push.
const BIG_PUSH_AFTER = 0.2; // seconds of holding before it counts as a big push
const MAX_CHARGE = 1.3; // seconds to reach a full-strength big push
const CHARGE_COLOR = new THREE.Color('#ff8f00');

function startCharge(f) {
  if (!f || !f.alive || f.falling || f.dashCooldown > 0 || f.charging) return;
  f.charging = true;
  f.charge = 0;
}

function releaseCharge(f) {
  if (!f?.charging) return;
  f.charging = false;
  const held = f.charge;
  f.charge = 0;
  dash(f, held >= BIG_PUSH_AFTER ? Math.min(held / MAX_CHARGE, 1) : 0);
}

// strength 0 = short push; above 0 (up to 1) = big push, stronger the longer it was held.
function dash(f, strength = 0) {
  if (!f || !f.alive || f.falling || f.dashCooldown > 0) return;
  const big = strength > 0;
  let [dirX, dirZ] = heading(f);
  const target = aimTarget(f);
  let power = big ? 6.5 + strength * 3 : 6;
  if (target) {
    const d = Math.hypot(target.x - f.x, target.z - f.z) || 1;
    dirX = (target.x - f.x) / d;
    dirZ = (target.z - f.z) / d;
  } else if (f.isPlayer) {
    // Nobody in front: a gentler move, so you don't launch yourself into the water
    power = big ? 5 + strength * 3 : 4.5;
  }
  f.vx = f.vx * 0.4 + dirX * power;
  f.vz = f.vz * 0.4 + dirZ * power;
  f.dashing = big ? 0.35 + strength * 0.25 : 0.3;
  f.hitBonus = big ? 4.5 + strength * 3 : 4.5; // extra knock given to whoever it hits
  const baseCooldown = f.isPlayer ? 0.8 : Math.max(0.9, 1.6 - game.skill * 0.25);
  f.dashCooldown = big ? baseCooldown + 0.8 + strength * 0.6 : baseCooldown;
  puff(f.x, f.z);
  if (big) puff(f.x, f.z);
  if (f.isPlayer) sfx.dash(big);
}

// --- Bots ------------------------------------------------------------------------------------------
// Bots steer smoothly towards a "wish" direction instead of snapping to it each frame.
function steer(f, wishX, wishZ, dt) {
  const k = Math.min(1, dt * 3);
  f.steerX = (f.steerX ?? 0) + (wishX - (f.steerX ?? 0)) * k;
  f.steerZ = (f.steerZ ?? 0) + (wishZ - (f.steerZ ?? 0)) * k;
  return [f.steerX, f.steerZ];
}

function botControl(f, dt) {
  const fromCentre = Math.hypot(f.x, f.z) || 1;
  // Too close to the edge: step back towards the middle
  if (fromCentre > game.radius - 1.2) return steer(f, -f.x / fromCentre, -f.z / fromCentre, dt);
  const others = fighters.filter((o) => o !== f && o.alive && !o.falling);
  if (!others.length) return steer(f, 0, 0, dt);
  // Free-for-all: pick one of the two nearest fighters at random (the player gets no
  // special treatment) and stick with it for a good while, so bots don't flit about.
  f.retarget -= dt;
  if (!f.target || !f.target.alive || f.target.falling || f.retarget <= 0) {
    const nearest = others
      .map((o) => ({ o, d: Math.hypot(o.x - f.x, o.z - f.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    f.target = nearest[Math.floor(Math.random() * nearest.length)].o;
    f.retarget = 4 + Math.random() * 3;
  }
  const target = f.target;
  const dx = target.x - f.x;
  const dz = target.z - f.z;
  const d = Math.hypot(dx, dz) || 1;
  // Close in, then square up: slow down near the target instead of circling it
  const approach = d > 2 ? 1 : 0.35;
  f.think -= dt;
  if (d < 3 && f.think <= 0 && !f.charging) {
    // Bots sometimes wind up a big push, more often in later rounds
    const bigChance = f.boss ? 0.55 : Math.min(0.5, 0.12 + (game.round - 1) * 0.08);
    if (Math.random() < bigChance) {
      startCharge(f);
      f.releaseAt = 0.35 + Math.random() * 0.55;
    } else {
      dash(f);
    }
    f.think = Math.max(0.5, 1.6 - game.skill * 0.3) + Math.random();
  }
  return steer(f, (dx / d) * approach, (dz / d) * approach, dt);
}

// --- Loop -------------------------------------------------------------------------------------------
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  // Pull the camera back a little on narrow (portrait) screens so the island fits
  camera.fov = camera.aspect < 0.8 ? 68 : 50;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;
  const playing = game.mode === 'playing';

  if (playing) {
    game.time += dt;
  }
  island.scale.set(game.radius, 1, game.radius);
  rim.scale.set(game.radius - 0.15, game.radius - 0.15, 1);
  rim.material.color.set('#b5462f'); // the player's edge warning may turn it red below

  for (const f of fighters) {
    if (!f.alive) continue;
    f.dashCooldown = Math.max(0, f.dashCooldown - dt);
    f.dashing = Math.max(0, f.dashing - dt);
    if (f.charging) {
      if (f.falling || !playing) {
        f.charging = false;
        f.charge = 0;
      } else {
        f.charge = Math.min(MAX_CHARGE, f.charge + dt);
        if (!f.isPlayer && f.charge >= f.releaseAt) releaseCharge(f);
      }
    }

    if (!f.falling && playing) {
      let ax = 0;
      let az = 0;
      if (f.isPlayer) {
        if (keys.has('KeyA') || keys.has('ArrowLeft')) ax -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) ax += 1;
        if (keys.has('KeyW') || keys.has('ArrowUp')) az -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) az += 1;
        ax += touchAxis.x;
        az += touchAxis.z;
        const l = Math.hypot(ax, az);
        if (l > 1) { ax /= l; az /= l; }
      } else {
        [ax, az] = botControl(f, dt);
      }
      // Charging a big push slows you right down: that's the risk
      const accel = (f.isPlayer ? 17 : 11 + game.skill * 2) * (f.charging ? 0.3 : 1);
      f.vx += ax * accel * dt;
      f.vz += az * accel * dt;
    }

    const friction = f.falling ? 0.99 : Math.pow(0.04, dt);
    f.vx *= friction;
    f.vz *= friction;
    f.x += f.vx * dt;
    f.z += f.vz * dt;

    // Safe edge: the player can't simply walk off. Only a push from someone else,
    // or their own dash or lunge, can send them into the water.
    if (f.isPlayer && !f.falling) {
      const pushed = f.lastHit && t - f.lastHit.time < 0.8;
      const r = Math.hypot(f.x, f.z);
      const limit = game.radius - 0.08;
      if (!pushed && f.dashing === 0 && r > limit) {
        const nx = f.x / r;
        const nz = f.z / r;
        f.x = nx * limit;
        f.z = nz * limit;
        const outward = f.vx * nx + f.vz * nz;
        if (outward > 0) {
          f.vx -= outward * nx;
          f.vz -= outward * nz;
        }
      }
      f.nearEdge = r > game.radius - 0.9;
    }

    if (!f.falling && Math.hypot(f.x, f.z) > game.radius) {
      f.falling = true;
      if (!f.isPlayer && playing && f.lastHit?.by?.isPlayer && t - f.lastHit.time < 3) {
        game.knockouts += 1;
        popup('KO!', f.x, f.z);
      }
    }
    if (f.falling) {
      f.vy -= 20 * dt;
      f.y += f.vy * dt;
      f.model.rotation.x += dt * 4;
      if (!f.splashed && f.y < WATER_Y) {
        f.splashed = true;
        splash(f.x, f.z);
        sfx.splash();
      }
      if (f.y < -5) {
        f.alive = false;
        scene.remove(f.model);
      }
    }

    f.model.position.set(f.x, f.y, f.z);
    const speed = Math.hypot(f.vx, f.vz);
    if (speed > 0.3 && !f.falling) f.model.rotation.y = Math.atan2(f.vx, f.vz);
    if (game.mode === 'menu' && f.isPlayer) f.model.rotation.y = Math.sin(t * 0.6) * 0.8;
    animateCharacter(f.model, t, speed / 3);
    if (f.charging) {
      // Wind-up: crouch and wobble, so everyone can see a big push coming
      const k = f.charge / MAX_CHARGE;
      f.model.scale.set(f.size * (1 + k * 0.08), f.size * (1 - k * 0.12), f.size * (1 + k * 0.08));
      f.model.rotation.z = Math.sin(t * 40) * 0.04 * k;
    } else {
      f.model.scale.setScalar(f.size * (f.dashing > 0 ? 1.12 : 1));
      if (!f.falling) f.model.rotation.z = 0;
    }

    const { ring, you } = f.model.userData;
    if (ring) {
      ring.visible = !f.falling;
      // Turns red and pulses faster when the player is close to the edge
      const danger = playing && f.nearEdge;
      const speedUp = danger ? 12 : 5;
      ring.material.color.set(danger ? '#ff3b30' : '#d8fd71');
      ring.material.opacity = 0.65 + Math.sin(t * speedUp) * 0.25;
      ring.scale.setScalar(1 + Math.sin(t * speedUp) * 0.06);
      rim.material.color.set(danger && Math.sin(t * 12) > 0 ? '#ff3b30' : '#b5462f');
    }
    if (you) {
      // Shown for the first 3 seconds of a round (and on the menu), bouncing
      you.visible = !f.falling && (game.mode === 'menu' || (playing && game.time < 3));
      you.position.y = 3 + Math.abs(Math.sin(t * 5)) * 0.25;
    }

    const arrow = f.model.userData.arrow;
    if (arrow) {
      arrow.visible = playing && !f.falling;
      if (arrow.visible) {
        // Point the arrow at the locked target, or straight ahead
        const target = aimTarget(f);
        const locked = !!target && f.dashCooldown === 0;
        if (f.charging) {
          // Charging: the arrow grows and turns from white to orange
          const k = f.charge / MAX_CHARGE;
          arrow.material.color.set('#ffffff').lerp(CHARGE_COLOR, k);
          arrow.material.opacity = 0.95;
          arrow.scale.setScalar(1 + k * 0.9);
        } else {
          arrow.material.color.set(locked ? '#d8fd71' : '#ffffff');
          arrow.material.opacity = locked ? 0.95 : f.dashCooldown > 0 ? 0.2 : 0.45;
          arrow.scale.setScalar(1);
        }
        const yaw = target ? Math.atan2(target.x - f.x, target.z - f.z) - f.model.rotation.y : 0;
        arrow.position.set(Math.sin(yaw) * 0.85, 0.04, Math.cos(yaw) * 0.85);
        arrow.rotation.set(-Math.PI / 2, 0, yaw);
      }
    }
  }

  // Bumps between fighters still on the island
  const standing = fighters.filter((f) => f.alive && !f.falling);
  for (let i = 0; i < standing.length; i++) {
    for (let j = i + 1; j < standing.length; j++) {
      const a = standing[i];
      const b = standing[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const minD = a.radius + b.radius;
      if (d <= 0 || d >= minD) continue;
      const nx = dx / d;
      const nz = dz / d;
      // Separate them; the heavier one gets moved less
      const overlap = minD - d;
      const shareA = b.mass / (a.mass + b.mass);
      a.x -= nx * overlap * shareA;
      a.z -= nz * overlap * shareA;
      b.x += nx * overlap * (1 - shareA);
      b.z += nz * overlap * (1 - shareA);
      const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; // > 0: a is moving into b
      if (Math.abs(rel) < 0.01) continue;
      const [hitter, hit, sx, sz] = rel > 0 ? [a, b, nx, nz] : [b, a, -nx, -nz];
      // Harder hitters push more; heavier fighters are knocked back less
      const push = (Math.abs(rel) * 1.3 + (hitter.dashing > 0 ? hitter.hitBonus : 0)) * hitter.power;
      hit.vx += (sx * push) / hit.mass;
      hit.vz += (sz * push) / hit.mass;
      hitter.vx -= (sx * push * 0.35) / hitter.mass;
      hitter.vz -= (sz * push * 0.35) / hitter.mass;
      hit.lastHit = { by: hitter, time: t };
      if (push > 3) {
        if (a.isPlayer || b.isPlayer) shake = Math.min(0.5, shake + push * 0.04);
        sfx.bump(push / 4);
      }
    }
  }

  if (playing) {
    updateHud();
    const p = player();
    const left = standing.length;
    if (!p || !p.alive || p.falling) runOver();
    else if (left === 1) roundWon();
  }

  updateEffects(dt);
  updatePopups(dt);

  // Camera: fixed and steady (following the player made the island seem to swing around),
  // with only a small shake on big hits
  shake = Math.max(0, shake - dt * 1.5);
  camera.position.set(
    CAMERA_HOME.x + (Math.random() - 0.5) * shake,
    CAMERA_HOME.y + (Math.random() - 0.5) * shake,
    CAMERA_HOME.z,
  );
  camera.lookAt(0, 0, 0);
  water.material.color.setHSL(0.58, 0.75, 0.48 + Math.sin(t * 0.8) * 0.015);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// --- Start up ----------------------------------------------------------------------------------------
refreshIdentityUI();
showMenuScene();
tick();

const remember = onPlayerChange((player) => setIdentity(player));
getPlayer().then((player) => {
  if (player) {
    remember(player);
    setIdentity(player);
  }
});
