# Team Ladder privacy policy

Last updated: November 11, 2026

Team Ladder is a Forge app for Jira made by Aizhan Li, author of the Ladder method.

## What the app stores

- Weekly check-in answers: an energy score from 1 to 5, one obstacle chosen from a fixed list, and an optional note of up to 280 characters.
- The team goal text for a project, up to 200 characters.
- A one-way hash made from a random salt, the project key, the week and the account ID. It only stops a person from answering twice in the same week. The account ID itself is never stored.

## Where it is stored

All data stays in Forge storage on the Atlassian platform. The app has no external egress and sends nothing to other services.

## Who can see it

The team ladder appears only when at least 3 people answer in a week. Nobody, including site admins and the app author, can see who gave which answer. Notes are shown without names and in shuffled order.

## Rovo agent

Team Ladder Coach reads only the anonymous weekly summary. It creates a Jira task only after the user confirms it.

## Deleting data

Uninstalling the app removes its storage according to Atlassian Forge rules. To ask a question or request deletion, write to liaizhan@108psy.com.

Team Ladder shows a strain signal, not a medical diagnosis.
