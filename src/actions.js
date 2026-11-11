// Rovo actions used by the Team Ladder Coach agent.
import api, { route } from '@forge/api';
import { getLadder } from './ladder';
import { graphContext, cloudIdFrom } from './graph';

const cleanKey = (k) => String(k ?? '').trim().toUpperCase();

// The agent passes a project key from chat, so check that the user can browse it.
async function userCanBrowse(project) {
  const res = await api
    .asUser()
    .requestJira(route`/rest/api/3/mypermissions?projectKey=${project}&permissions=BROWSE_PROJECTS`);
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data?.permissions?.BROWSE_PROJECTS?.havePermission);
}

export async function getTeamLadder(payload, context) {
  const project = cleanKey(payload?.projectKey);
  if (!project) return { error: 'projectKey is required' };
  if (!(await userCanBrowse(project))) return { error: 'You do not have access to this project' };
  const ladder = await getLadder(project);
  const accountId = context?.principal?.accountId ?? payload?.context?.accountId;
  const graph = await graphContext(project, cloudIdFrom(payload?.context, context), accountId);
  if (ladder.hidden) {
    return {
      project,
      week: ladder.week,
      hidden: true,
      answers: ladder.count,
      message: `Only ${ladder.count} of ${ladder.minAnswers} needed answers this week. The ladder stays hidden to protect anonymity.`,
      goal: ladder.goal?.text || null,
    };
  }
  return {
    project,
    week: ladder.week,
    sampleData: ladder.sample,
    ...(ladder.sample
      ? { sampleNote: 'Sample mode is on: this is a demo team, not real answers from this project.' }
      : {}),
    goal: ladder.goal?.text || null,
    goalSource: ladder.goal?.source,
    answers: ladder.count,
    averageEnergyOutOf5: ladder.avgEnergy,
    shareWithLowEnergyPercent: ladder.lowShare,
    strainSignal: ladder.strain,
    obstacles: ladder.obstacles,
    teamNotes: ladder.notes,
    energyTrend: ladder.trend,
    ...(graph.linkedTeams.length ? { linkedTeams: graph.linkedTeams } : {}),
    ...(graph.leadGoals.length ? { atlassianGoals: graph.leadGoals } : {}),
  };
}

export async function createStepIssue(payload) {
  const project = cleanKey(payload?.projectKey);
  const summary = String(payload?.summary ?? '').slice(0, 120).trim();
  if (!project || !summary) return { error: 'projectKey and summary are required' };

  const obstacle = String(payload?.obstacle ?? '').trim();
  const text = obstacle
    ? `Small step from Team Ladder. Obstacle: ${obstacle}.`
    : 'Small step from Team Ladder.';

  const body = {
    fields: {
      project: { key: project },
      summary,
      issuetype: { name: 'Task' },
      labels: ['team-ladder'],
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      },
    },
  };

  const res = await api.asUser().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { error: 'Jira did not create the task', details: data?.errors ?? data };
  return { created: true, key: data.key };
}
