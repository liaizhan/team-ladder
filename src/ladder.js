// Team Ladder core: anonymous weekly check-ins, aggregate, strain signal.
import { kvs } from '@forge/kvs';
import api, { route } from '@forge/api';
import { createHash, randomUUID } from 'node:crypto';

export const MIN_ANSWERS = 3;

export const OBSTACLES = [
  { id: 'unclear', label: 'Unclear priorities' },
  { id: 'meetings', label: 'Too many meetings' },
  { id: 'waiting', label: 'Waiting on others' },
  { id: 'scope', label: 'Too much work in progress' },
  { id: 'fear', label: 'Fear of making a mistake' },
  { id: 'tired', label: 'Low energy, tired' },
  { id: 'tools', label: 'Broken tools or process' },
  { id: 'other', label: 'Something else' },
];

const labelOf = (id) => OBSTACLES.find((o) => o.id === id)?.label ?? 'Something else';

// ISO week, for example 2026-W46
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function previousWeeks(count, from = new Date()) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(weekKey(new Date(from.getTime() - i * 7 * 86400000)));
  }
  return out;
}

async function salt() {
  let s = await kvs.get('install-salt');
  if (!s) {
    s = randomUUID();
    await kvs.set('install-salt', s);
  }
  return s;
}

// One answer per person per week, but we never store the accountId itself.
async function voterId(accountId, project, week) {
  const s = await salt();
  return createHash('sha256').update(`${s}:${project}:${week}:${accountId}`).digest('hex').slice(0, 24);
}

const answersKey = (project, week) => `answers:${project}:${week}`;
const goalKey = (project) => `goal:${project}`;
const sampleKey = (project) => `sample:${project}`;

// Sample mode: a clearly labelled demo team, so a lead (or a judge) working alone
// can see the full ladder and try the Rovo coach. Real answers are never touched
// and never mixed with sample data.
export async function isSample(project) {
  return Boolean(await kvs.get(sampleKey(project)));
}

export async function setSample(project, on) {
  if (on) await kvs.set(sampleKey(project), true);
  else await kvs.delete(sampleKey(project));
  return Boolean(on);
}

const SAMPLE_GOAL = 'Launch the new onboarding flow this sprint';
const SAMPLE_ANSWERS = [
  { energy: 4, obstacle: 'waiting', note: 'Code reviews wait two or three days before anyone picks them up.' },
  { energy: 2, obstacle: 'waiting', note: '' },
  { energy: 3, obstacle: 'waiting', note: 'Design sign-off is blocking two of my tickets.' },
  { energy: 2, obstacle: 'meetings', note: 'Three status meetings on Tuesday, no time left to build.' },
  { energy: 3, obstacle: 'meetings', note: '' },
  { energy: 3, obstacle: 'unclear', note: 'Not sure which of the two launches comes first.' },
  { energy: 3, obstacle: 'fear', note: '' },
];
const SAMPLE_TREND = [3.6, 3.4, 3.1];

export async function saveAnswer({ accountId, project, energy, obstacle, note }) {
  const e = Number(energy);
  if (!Number.isInteger(e) || e < 1 || e > 5) throw new Error('Energy must be 1 to 5');
  if (!OBSTACLES.some((o) => o.id === obstacle)) throw new Error('Unknown obstacle');
  const week = weekKey();
  const id = await voterId(accountId, project, week);
  const all = (await kvs.get(answersKey(project, week))) ?? {};
  all[id] = { energy: e, obstacle, note: String(note ?? '').slice(0, 280).trim() };
  await kvs.set(answersKey(project, week), all);
  return { week };
}

export async function hasAnswered({ accountId, project }) {
  const week = weekKey();
  const id = await voterId(accountId, project, week);
  const all = (await kvs.get(answersKey(project, week))) ?? {};
  return Boolean(all[id]);
}

export async function setGoal(project, text) {
  const goal = String(text ?? '').slice(0, 200).trim();
  await kvs.set(goalKey(project), goal);
  return goal;
}

// Goal: the team's own words first, then the active sprint goal from Jira.
export async function getGoal(project) {
  const own = await kvs.get(goalKey(project));
  if (own) return { text: own, source: 'team' };
  try {
    const boards = await api
      .asApp()
      .requestJira(route`/rest/agile/1.0/board?projectKeyOrId=${project}&maxResults=1`);
    if (!boards.ok) return { text: '', source: 'none' };
    const board = (await boards.json()).values?.[0];
    if (!board) return { text: '', source: 'none' };
    const sprints = await api
      .asApp()
      .requestJira(route`/rest/agile/1.0/board/${board.id}/sprint?state=active`);
    if (!sprints.ok) return { text: '', source: 'none' };
    const sprint = (await sprints.json()).values?.[0];
    if (sprint?.goal) return { text: sprint.goal, source: 'sprint', sprint: sprint.name };
  } catch (e) {
    console.warn('Sprint goal lookup failed', e?.message);
  }
  return { text: '', source: 'none' };
}

function summarise(answers) {
  const list = Object.values(answers ?? {});
  const count = list.length;
  if (count === 0) return { count, avgEnergy: null, lowShare: null };
  const avgEnergy = list.reduce((s, a) => s + a.energy, 0) / count;
  const lowShare = list.filter((a) => a.energy <= 2).length / count;
  return { count, avgEnergy: Math.round(avgEnergy * 10) / 10, lowShare: Math.round(lowShare * 100) };
}

export function strainSignal(avgEnergy, lowShare) {
  if (avgEnergy === null) return 'unknown';
  if (lowShare >= 40 || avgEnergy < 2.5) return 'high';
  if (lowShare >= 20 || avgEnergy < 3.3) return 'watch';
  return 'steady';
}

export async function getLadder(project) {
  const weeks = previousWeeks(4);
  const sample = await isSample(project);
  let goal = await getGoal(project);
  let current;
  const trend = [];

  if (sample) {
    if (!goal.text) goal = { text: SAMPLE_GOAL, source: 'sample' };
    current = Object.fromEntries(SAMPLE_ANSWERS.map((a, i) => [`sample-${i}`, a]));
    const now = summarise(current).avgEnergy;
    [...weeks].reverse().forEach((w, i) => {
      trend.push({ week: w, avgEnergy: i < SAMPLE_TREND.length ? SAMPLE_TREND[i] : now });
    });
  } else {
    current = (await kvs.get(answersKey(project, weeks[0]))) ?? {};
    for (const w of [...weeks].reverse()) {
      const s = summarise((await kvs.get(answersKey(project, w))) ?? {});
      // Past weeks are shown only when they also met the anonymity threshold.
      trend.push({ week: w, avgEnergy: s.count >= MIN_ANSWERS ? s.avgEnergy : null });
    }
  }
  const base = summarise(current);

  if (base.count < MIN_ANSWERS) {
    return { week: weeks[0], goal, count: base.count, hidden: true, minAnswers: MIN_ANSWERS, trend, sample };
  }

  const counts = {};
  const notes = [];
  for (const a of Object.values(current)) {
    counts[a.obstacle] = (counts[a.obstacle] ?? 0) + 1;
    if (a.note) notes.push(a.note);
  }
  const obstacles = Object.entries(counts)
    .map(([id, n]) => ({ id, label: labelOf(id), count: n }))
    .sort((a, b) => b.count - a.count);

  // Shuffle notes so their order says nothing about who wrote them.
  for (let i = notes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [notes[i], notes[j]] = [notes[j], notes[i]];
  }

  return {
    week: weeks[0],
    goal,
    count: base.count,
    hidden: false,
    sample,
    avgEnergy: base.avgEnergy,
    lowShare: base.lowShare,
    strain: strainSignal(base.avgEnergy, base.lowShare),
    obstacles,
    notes,
    trend,
  };
}
