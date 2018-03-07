# hubot-github-dashboard-slack-notifier
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

This is a hubot-script to notify update of github's dashboard.

## Installation

In hubot project repo, run:

`npm install hubot-github-dashboard-slack-notifier --save`

Then add hubot-github-dashboard-slack-notifier to your `external-scripts.json`:

`["hubot-github-dashboard-slack-notifier"]`

## Option(Required)
|Option|Description|Example|
|------|-----------|-------|
|GITHUB_DASHBOARD_API|Dashboard url|https://api.github.com/events https://api.github.com/users/shimastripe/events/orgs/XXXX|
|GITHUB_TOKEN|Access token (repo)|hogehoge|
|GH_AC_CHANNEL|Slack channel|CHOGEHOGE|