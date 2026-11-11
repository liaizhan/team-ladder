import Resolver from '@forge/resolver';
import { OBSTACLES, saveAnswer, hasAnswered, getLadder, setGoal, setSample, MIN_ANSWERS } from './ladder';

const resolver = new Resolver();

const projectOf = (context) => context?.extension?.project?.key;

resolver.define('getState', async ({ context }) => {
  const project = projectOf(context);
  const [answered, ladder] = await Promise.all([
    hasAnswered({ accountId: context.accountId, project }),
    getLadder(project),
  ]);
  return { project, answered, ladder, obstacles: OBSTACLES, minAnswers: MIN_ANSWERS };
});

resolver.define('submitAnswer', async ({ payload, context }) => {
  const project = projectOf(context);
  if (!project) throw new Error('No project in context');
  const { energy, obstacle, note } = payload ?? {};
  await saveAnswer({ energy, obstacle, note, accountId: context.accountId, project });
  return { ok: true, ladder: await getLadder(project) };
});

resolver.define('setGoal', async ({ payload, context }) => {
  const project = projectOf(context);
  if (!project) throw new Error('No project in context');
  await setGoal(project, payload?.goal);
  return { ok: true, ladder: await getLadder(project) };
});

resolver.define('setSample', async ({ payload, context }) => {
  const project = projectOf(context);
  if (!project) throw new Error('No project in context');
  await setSample(project, Boolean(payload?.on));
  return { ok: true, ladder: await getLadder(project) };
});

export const handler = resolver.getDefinitions();

export { getTeamLadder, createStepIssue } from './actions';
