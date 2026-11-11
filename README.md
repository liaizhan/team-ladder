# Team Ladder for Jira

Anonymous weekly check-ins that show a team's energy and the obstacles between the team and its goal, as one ladder inside the Jira project. A Rovo agent turns the top obstacle into one small Jira task.

Built on Atlassian Forge for Codegeist 2026 by Aizhan Li, author of the Ladder method (108psy.com).

## What it does

1. **Check-in (Jira project page "Team Ladder").** Each teammate answers three questions once a week: energy from 1 to 5, the biggest obstacle (8 options), and an optional one-sentence note.
2. **Anonymity by design.** The app never stores an accountId. A salted SHA-256 hash only prevents double answers in the same week. The ladder stays hidden until at least 3 people answer. Notes are shuffled.
3. **The ladder.** Goal at the top (the team's own words, or the active sprint goal read from Jira Software), ranked obstacles in the middle, "We, now" at the bottom with average energy and a strain signal (Steady, Watch, High). Energy trend for the last 4 weeks.
4. **Team Ladder Coach (Rovo agent).** Reads the aggregate through the `get-team-ladder` action, summarises it, proposes one step under an hour for the top obstacle and, after a clear yes, creates the Jira task through `create-step-issue` (label `team-ladder`).

The app shows a strain signal, not a diagnosis.

## Forge modules

- `jira:projectPage` with UI Kit (`render: native`) and a resolver
- `rovo:agent` with 2 `action` modules
- Forge KVS storage (`@forge/kvs`), no external egress
- Jira Software Agile API for the active sprint goal, Jira REST API v3 for task creation

## Run it yourself

```
npm install
forge register        # once, creates your app id in manifest.yml
forge deploy
forge install --product jira --site <your-site>.atlassian.net
```

## Testing instructions for judges

1. Open the installation link and install Team Ladder on your Jira Cloud site.
2. Open any Jira Software project. In the project sidebar choose **Team Ladder**.
3. Answer the check-in. To see the full ladder you need 3 answers: ask 2 colleagues, or log in as 2 more test users.
4. Optional: click **Edit** next to the goal to type a team goal. Without it the app shows the active sprint goal.
5. Open Rovo chat, pick **Team Ladder Coach** and ask: "Show our team ladder for project KEY", then "Turn the top obstacle into a small task". Answer yes and check the new task with label `team-ladder`.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

MIT
