// Everything that talks to start.ng lives here (see https://start.ng/docs.md).
// The game never sees passwords, tokens or emails: it asks start.ng's hidden
// connect page who is playing, and saves runs through the same page.

export const START_NG = 'https://start.ng';

// start.ng's connect page only answers games served from *.start.ng.
export const ON_START_NG = location.hostname.endsWith('.start.ng');

// The start.ng homepage opens games with ?guest when the player chose "play as guest".
export const CHOSE_GUEST = new URLSearchParams(location.search).has('guest');

let frame;

function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
async function askStartNg(message, replyType, timeoutMs = 5000) {
  if (!ON_START_NG) return null;
  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      // Only trust replies from start.ng's own connect frame.
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

// Who is playing. Resolves to { user, guest }, where user is null for guests,
// or null if start.ng didn't answer (or the game isn't on start.ng).
export async function getPlayer() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  if (!reply) return null;
  return { user: reply.user ?? null, guest: reply.guest ?? null };
}

// Calls fn with the new { user, guest } whenever the player may have signed in or
// out on start.ng (they come back to this tab). Checks with no answer are ignored.
export function onPlayerChange(fn) {
  let lastId;
  const check = async () => {
    const player = await getPlayer();
    if (!player) return;
    const id = player.user?.id ?? null;
    if (id !== lastId) {
      lastId = id;
      fn(player);
    }
  };
  addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  return (player) => { lastId = player?.user?.id ?? null; };
}

export function signIn() {
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

// Saves a finished run for a signed-in player. stats must match startng.json.
export function saveRun(stats) {
  return askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved');
}

// The shared top players, for everyone (guests included).
export async function getLeaderboard(limit = 10) {
  const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData');
  return reply?.ok ? reply.entries : null;
}
