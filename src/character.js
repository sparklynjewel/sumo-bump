// A low-poly fighter drawn from a start.ng character style.
// Fields and values follow https://start.ng/docs.md ("Character style fields").
// Anything missing or unknown falls back to a default, since start.ng may add options later.
import * as THREE from 'three';

export const DEFAULT_STYLE = {
  body: 'female',
  primaryColor: '#4b7bec',
  secondaryColor: '#2b2f4a',
  skinColor: '#8d5524',
  hairColor: '#17120f',
  hair: 'short',
  hat: 'none',
  accessory: 'none',
};

const OPTIONS = {
  body: ['female', 'male'],
  hair: ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'],
  hat: ['none', 'cap', 'beanie', 'tophat', 'crown'],
  accessory: ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'],
};
const COLORS = ['primaryColor', 'secondaryColor', 'skinColor', 'hairColor'];
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export function normaliseStyle(style) {
  const s = { ...DEFAULT_STYLE };
  if (!style || typeof style !== 'object') return s;
  for (const key of COLORS) if (COLOR_RE.test(style[key] ?? '')) s[key] = style[key];
  for (const key of Object.keys(OPTIONS)) if (OPTIONS[key].includes(style[key])) s[key] = style[key];
  return s;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e', '#3b2412'];
const HAIRS = ['#17120f', '#3b2416', '#6b3e1f', '#b8860b', '#d9d0c1', '#8e2a2a'];
const randomColor = () =>
  '#' + new THREE.Color().setHSL(Math.random(), 0.5 + Math.random() * 0.35, 0.42 + Math.random() * 0.2).getHexString();

export function randomStyle() {
  return {
    body: pick(OPTIONS.body),
    primaryColor: randomColor(),
    secondaryColor: randomColor(),
    skinColor: pick(SKINS),
    hairColor: pick(HAIRS),
    hair: pick(OPTIONS.hair),
    hat: pick(OPTIONS.hat),
    accessory: pick(OPTIONS.accessory),
  };
}

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function part(geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// The group's origin is at the feet, facing +z.
export function buildCharacter(rawStyle) {
  const s = normaliseStyle(rawStyle);
  const g = new THREE.Group();
  const m = {
    top: material(s.primaryColor),
    bottom: material(s.secondaryColor),
    skin: material(s.skinColor),
    hair: material(s.hairColor),
    dark: material('#1b1b1b'),
    gold: material('#f5c518', { metalness: 0.6, roughness: 0.3 }),
  };
  const female = s.body === 'female';

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.75, 0);
    hip.add(part(new THREE.BoxGeometry(0.2, 0.72, 0.22), m.bottom, 0, -0.36, 0));
    hip.add(part(new THREE.BoxGeometry(0.22, 0.1, 0.3), m.dark, 0, -0.72, 0.04));
    g.add(hip);
    legs.push(hip);
  }
  if (female) g.add(part(new THREE.CylinderGeometry(0.24, 0.36, 0.32, 10), m.bottom, 0, 0.72, 0));

  g.add(part(new THREE.BoxGeometry(female ? 0.48 : 0.58, 0.62, 0.3), m.top, 0, 1.08, 0));

  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (female ? 0.32 : 0.37), 1.34, 0);
    shoulder.add(part(new THREE.BoxGeometry(0.15, 0.5, 0.17), m.top, 0, -0.22, 0));
    shoulder.add(part(new THREE.SphereGeometry(0.085, 10, 8), m.skin, 0, -0.52, 0));
    g.add(shoulder);
    arms.push(shoulder);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  head.add(part(new THREE.BoxGeometry(0.12, 0.1, 0.12), m.skin, 0, -0.12, 0));
  head.add(part(new THREE.SphereGeometry(0.22, 16, 12), m.skin, 0, 0.08, 0));
  for (const side of [-1, 1]) head.add(part(new THREE.SphereGeometry(0.028, 8, 6), m.dark, side * 0.08, 0.11, 0.2));
  head.add(part(new THREE.BoxGeometry(0.1, 0.02, 0.02), material('#5a2a2a'), 0, 0, 0.21));
  addHair(head, s.hair, m);
  addHat(head, s.hat, m);
  addAccessory(g, head, s.accessory, m);
  g.add(head);

  g.userData = { legs, arms, head, style: s };
  return g;
}

function addHair(head, hair, m) {
  const cap = (scale = 1) =>
    part(new THREE.SphereGeometry(0.235 * scale, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.hair, 0, 0.12, -0.01);
  switch (hair) {
    case 'bald':
      return;
    case 'afro':
      head.add(part(new THREE.SphereGeometry(0.34, 16, 12), m.hair, 0, 0.2, -0.05));
      return;
    case 'bun':
      head.add(cap());
      head.add(part(new THREE.SphereGeometry(0.11, 12, 10), m.hair, 0, 0.32, -0.12));
      return;
    case 'ponytail': {
      head.add(cap());
      const tail = part(new THREE.CylinderGeometry(0.05, 0.03, 0.34, 8), m.hair, 0, 0, -0.27);
      tail.rotation.x = 0.4;
      head.add(tail);
      return;
    }
    case 'braids':
    case 'dreads': {
      head.add(cap(1.02));
      const count = hair === 'braids' ? 8 : 12;
      for (let i = 0; i < count; i++) {
        const a = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.7;
        const r = hair === 'braids' ? 0.025 : 0.035;
        head.add(part(new THREE.CylinderGeometry(r, 0.02, 0.36, 6), m.hair, Math.cos(a) * 0.22, -0.05, -Math.sin(a) * 0.2));
      }
      return;
    }
    default:
      head.add(cap());
  }
}

function addHat(head, hat, m) {
  const dome = (mat, r) => part(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 0.13, 0);
  switch (hat) {
    case 'cap':
      head.add(dome(m.top, 0.245));
      head.add(part(new THREE.BoxGeometry(0.3, 0.03, 0.2), m.top, 0, 0.15, 0.24));
      return;
    case 'beanie':
      head.add(dome(m.bottom, 0.25));
      head.add(part(new THREE.SphereGeometry(0.06, 8, 6), material('#ffffff'), 0, 0.39, 0));
      return;
    case 'tophat':
      head.add(part(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 20), m.dark, 0, 0.24, 0));
      head.add(part(new THREE.CylinderGeometry(0.19, 0.19, 0.36, 20), m.dark, 0, 0.42, 0));
      return;
    case 'crown':
      head.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16, 1, true), m.gold, 0, 0.3, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        head.add(part(new THREE.ConeGeometry(0.04, 0.1, 6), m.gold, Math.cos(a) * 0.19, 0.39, Math.sin(a) * 0.19));
      }
      return;
    default:
  }
}

function addAccessory(g, head, accessory, m) {
  switch (accessory) {
    case 'glasses':
      for (const side of [-1, 1]) head.add(part(new THREE.TorusGeometry(0.055, 0.012, 6, 14), m.dark, side * 0.085, 0.11, 0.215));
      head.add(part(new THREE.BoxGeometry(0.06, 0.012, 0.012), m.dark, 0, 0.11, 0.22));
      return;
    case 'earrings':
      for (const side of [-1, 1]) head.add(part(new THREE.TorusGeometry(0.03, 0.008, 6, 12), m.gold, side * 0.22, -0.02, 0));
      return;
    case 'beard':
      head.add(part(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.hair, 0, 0.02, 0.06));
      return;
    case 'scarf': {
      const scarf = part(new THREE.TorusGeometry(0.17, 0.06, 8, 16), m.bottom, 0, 1.43, 0);
      scarf.rotation.x = Math.PI / 2;
      g.add(scarf);
      return;
    }
    case 'backpack':
      g.add(part(new THREE.BoxGeometry(0.4, 0.46, 0.18), m.bottom, 0, 1.08, -0.24));
      return;
    default:
  }
}

// Walk cycle; speed 0 means standing still.
export function animateCharacter(character, time, speed = 0) {
  const { legs, arms } = character.userData;
  const swing = Math.sin(time * 10) * 0.6 * Math.min(speed, 1);
  legs[0].rotation.x = swing;
  legs[1].rotation.x = -swing;
  arms[0].rotation.x = -swing;
  arms[1].rotation.x = swing;
}
