// Teamwork Graph (Preview): teams linked to the Jira project and the lead's Atlassian goals.
// Optional context for the coach. Any failure returns empty lists, the ladder still works.
import api, { route } from '@forge/api';

const TEAMS_QUERY = `
  query teamLadder_projectTeams($spaceAri: ID!) {
    atlassianTeamsBySpace(spaceAri: $spaceAri, first: 5) {
      edges { node { ... on AtlassianTeam { displayName } } }
    }
  }`;

const GOALS_QUERY = `
  query teamLadder_leadGoals($userId: ID!) {
    atlassianUserGoalsAndProjects(userId: $userId, first: 25) {
      edges { node { ... on AtlassianGoal { name url archived } } }
    }
  }`;

export function cloudIdFrom(...contexts) {
  for (const c of contexts) {
    if (c?.cloudId) return c.cloudId;
    const m = String(c?.installContext ?? '').match(/site\/([^/]+)$/);
    if (m) return m[1];
  }
  return null;
}

async function projectId(project) {
  const res = await api.asUser().requestJira(route`/rest/api/3/project/${project}`);
  if (!res.ok) return null;
  return (await res.json())?.id ?? null;
}

async function run(query, variables) {
  const res = await api.asUser().requestTeamworkGraph(query, variables);
  const body = await res.json();
  if (!res.ok || body?.errors?.length) {
    console.warn('teamwork graph', res.status, JSON.stringify(body?.errors ?? '').slice(0, 300));
  }
  return body?.data ?? {};
}

const nodes = (conn) => (conn?.edges ?? []).map((e) => e?.node).filter(Boolean);

export async function graphContext(project, cloudId, accountId) {
  const empty = { linkedTeams: [], leadGoals: [] };
  try {
    const id = cloudId ? await projectId(project) : null;
    const [teams, goals] = await Promise.all([
      id ? run(TEAMS_QUERY, { spaceAri: `ari:cloud:jira:${cloudId}:project/${id}` }) : {},
      accountId ? run(GOALS_QUERY, { userId: `ari:cloud:identity::user/${accountId}` }) : {},
    ]);
    return {
      linkedTeams: nodes(teams.atlassianTeamsBySpace).map((t) => t.displayName).filter(Boolean),
      leadGoals: nodes(goals.atlassianUserGoalsAndProjects)
        .filter((g) => g.name && !g.archived)
        .slice(0, 5)
        .map((g) => ({ name: g.name, url: g.url })),
    };
  } catch (e) {
    console.warn('teamwork graph failed', String(e?.message ?? e).slice(0, 200));
    return empty;
  }
}
