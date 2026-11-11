import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  Heading,
  Inline,
  Lozenge,
  ProgressBar,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  TextArea,
  Textfield,
  xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const ENERGY = [
  { value: 1, label: '1 Empty' },
  { value: 2, label: '2 Low' },
  { value: 3, label: '3 Okay' },
  { value: 4, label: '4 Good' },
  { value: 5, label: '5 Full' },
];

const STRAIN = {
  high: { text: 'High strain signal', appearance: 'removed' },
  watch: { text: 'Watch', appearance: 'moved' },
  steady: { text: 'Steady', appearance: 'success' },
  unknown: { text: 'Not enough data', appearance: 'default' },
};

const step = xcss({
  padding: 'space.150',
  borderRadius: 'border.radius.100',
  backgroundColor: 'color.background.neutral',
});
const goalStep = xcss({
  padding: 'space.150',
  borderRadius: 'border.radius.100',
  backgroundColor: 'color.background.brand.bold',
});

function CheckIn({ obstacles, onDone }) {
  const [energy, setEnergy] = useState(null);
  const [obstacle, setObstacle] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await invoke('submitAnswer', { energy, obstacle: obstacle?.value, note });
      onDone(res.ladder);
    } catch (e) {
      setError('Could not save your answer. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack space="space.200">
      <Heading as="h3">Your check-in this week</Heading>
      <Text>Anonymous. Nobody, including admins, can see who answered what.</Text>
      <Text weight="bold">1. How much energy do you have for work this week?</Text>
      <ButtonGroup>
        {ENERGY.map((e) => (
          <Button
            key={e.value}
            appearance={energy === e.value ? 'primary' : 'default'}
            onClick={() => setEnergy(e.value)}
          >
            {e.label}
          </Button>
        ))}
      </ButtonGroup>
      <Text weight="bold">2. What stands between you and the goal right now?</Text>
      <Select
        inputId="obstacle"
        placeholder="Pick the biggest obstacle"
        options={obstacles.map((o) => ({ label: o.label, value: o.id }))}
        onChange={setObstacle}
        value={obstacle}
      />
      <Text weight="bold">3. Anything to add? (optional, no names please)</Text>
      <TextArea
        name="note"
        maxLength={280}
        placeholder="One sentence is enough"
        onChange={(e) => setNote(e.target.value)}
        value={note}
      />
      {error && <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>}
      <Button appearance="primary" isDisabled={!energy || !obstacle || busy} onClick={submit}>
        Save my answer
      </Button>
    </Stack>
  );
}

function Ladder({ ladder, onGoal }) {
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(ladder.goal?.text ?? '');

  const goalLabel =
    ladder.goal?.source === 'sprint' ? `Sprint goal (${ladder.goal.sprint})` : 'Team goal';

  return (
    <Stack space="space.150">
      <Inline spread="space-between" alignBlock="center">
        <Heading as="h3">Team ladder, week {ladder.week}</Heading>
        <Lozenge>{ladder.count} {ladder.count === 1 ? 'answer' : 'answers'}</Lozenge>
      </Inline>

      <Box xcss={goalStep}>
        <Stack space="space.050">
          <Text color="color.text.inverse" weight="bold">{goalLabel}</Text>
          {editing ? (
            <Inline space="space.100">
              <Textfield name="goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
              <Button
                appearance="primary"
                onClick={async () => {
                  await onGoal(goal);
                  setEditing(false);
                }}
              >
                Save
              </Button>
            </Inline>
          ) : (
            <Inline space="space.100" alignBlock="center">
              <Text color="color.text.inverse">{ladder.goal?.text || 'No goal yet'}</Text>
              <Button appearance="subtle" onClick={() => setEditing(true)}>Edit</Button>
            </Inline>
          )}
        </Stack>
      </Box>

      {ladder.hidden ? (
        <SectionMessage appearance="information" title="The ladder is still hidden">
          <Text>
            {ladder.count} of {ladder.minAnswers} answers so far. The team ladder appears when at
            least {ladder.minAnswers} people answer, so nobody can be identified.
          </Text>
        </SectionMessage>
      ) : (
        <>
          {ladder.obstacles.map((o, i) => (
            <Box key={o.id} xcss={step}>
              <Stack space="space.050">
                <Inline spread="space-between">
                  <Text weight="bold">Obstacle {i + 1}: {o.label}</Text>
                  <Text>{o.count} of {ladder.count}</Text>
                </Inline>
                <ProgressBar value={o.count / ladder.count} />
              </Stack>
            </Box>
          ))}
          <Box xcss={step}>
            <Stack space="space.050">
              <Inline spread="space-between" alignBlock="center">
                <Text weight="bold">We, now: energy {ladder.avgEnergy} of 5</Text>
                <Lozenge appearance={STRAIN[ladder.strain].appearance}>
                  {STRAIN[ladder.strain].text}
                </Lozenge>
              </Inline>
              <Text>{ladder.lowShare}% of the team report low energy (1 or 2).</Text>
            </Stack>
          </Box>
          {ladder.notes.length > 0 && (
            <Stack space="space.050">
              <Text weight="bold">In the team's words</Text>
              {ladder.notes.map((n, i) => (
                <Text key={i}>"{n}"</Text>
              ))}
            </Stack>
          )}
        </>
      )}

      <Stack space="space.050">
        <Text weight="bold">Energy trend, last 4 weeks</Text>
        <Inline space="space.200">
          {ladder.trend.map((t) => (
            <Text key={t.week}>{t.week.slice(5)}: {t.avgEnergy ?? 'hidden'}</Text>
          ))}
        </Inline>
      </Stack>

      <SectionMessage appearance="discovery" title="Next step">
        <Text>
          Ask Team Ladder Coach in Rovo: "Turn the top obstacle into a small task". It suggests one
          step under an hour and creates the Jira task after you agree.
        </Text>
      </SectionMessage>
      <Text size="small">
        Team Ladder shows a strain signal, not a diagnosis. If someone is in crisis, please talk to
        a qualified professional.
      </Text>
    </Stack>
  );
}

const App = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    invoke('getState').then(setState);
  }, []);

  if (!state) return <Spinner label="Loading Team Ladder" />;

  const updateLadder = (ladder) => setState((s) => ({ ...s, answered: true, ladder }));
  const saveGoal = async (goal) => {
    const res = await invoke('setGoal', { goal });
    setState((s) => ({ ...s, ladder: res.ladder }));
  };

  return (
    <Stack space="space.300">
      {!state.answered ? (
        <CheckIn obstacles={state.obstacles} onDone={updateLadder} />
      ) : (
        <SectionMessage appearance="success">
          <Text>Thank you. Your answer for this week is saved. A new check-in opens on Monday.</Text>
        </SectionMessage>
      )}
      <Ladder ladder={state.ladder} onGoal={saveGoal} />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
