import Resolver from '@forge/resolver';
import { OBSTACLES, saveAnswer, hasAnswered, getLadder, setGoal, MIN_ANSWERS } from './ladder';

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
  await saveAnswer({ accountId: context.accountId, project, ...payload });
  return { ok: true, ladder: await getLadder(project) };
});

resolver.define('setGoal', async ({ payload, context }) => {
  const project = projectOf(context);
  await setGoal(project, payload?.goal);
  return { ok: true, ladder: await getLadder(project) };
});

export const handler = resolver.getDefinitions();

export { getTeamLadder, createStepIssue } from './actions';
