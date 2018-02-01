const GITHUB_DASHBOARD_API = process.env.GITHUB_DASHBOARD_API
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GH_AC_CHANNEL = process.env.GH_AC_CHANNEL

const _ = require('lodash');
const request = require('request');
const randomColor = require('randomcolor');
const CronJob = require('cron').CronJob;

const getEvent = async () => {
  return new Promise((resolve, reject) => {
    let options = {
      url: `${GITHUB_DASHBOARD_API}?access_token=${GITHUB_TOKEN}`,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Hubot',
      },
      json: true
    }

    request(options, (err, res, body) => {
      if (err) {
        reject(err);
        return
      };
      resolve(body)
    });
  });
};

const formatAtt = (event) => {
  const colorPrimary = "#00d1b2";
  const colorLink = "#3273dc";
  const colorInfo = "#209cee";
  const colorSuccess = "#23d160";
  const colorWarning = "#ffdd57";
  const colorDanger = "#ff3860";
  const colorDark = "#363636";

  let att = {
    color: colorDark,
    mrkdwn_in: ["text", "fields"]
  };

  let repoURL = event.repo.url.replace("api.github.com/repos", "github.com");
  let repoTag = `*<${repoURL}|${event.repo.name}>*`;
  let [branchURL, branchTag] = ["", ""];

  if (_.isString(event.payload.ref)) {
    branchURL = `${event.repo.url.replace("api.github.com/repos", "github.com")}/tree/${event.payload.ref.replace("refs/heads/", "")}`;
    branchTag = `\`<${branchURL}|${event.payload.ref.replace("refs/heads/", "")}>\``;
  }

  let text = ''
  switch (event.type) {
    case "CommitCommentEvent":
      let sha = event.payload.comment.commit_id.slice(0, 7);
      let commitTag = `*<${event.payload.comment.html_url}|${event.repo.name}@${sha}>*`;
      text = `commented on commit ${commitTag}`;
      att.fields = [{
        value: `> ${event.payload.comment.body}`
      }]
      att.color = colorInfo;
      break;
    case "CreateEvent":
      if (event.payload.ref === null) {
        text = `created a ${event.payload.ref_type} at ${repoTag}`;
      } else {
        text = `created a ${event.payload.ref_type} ${branchTag} at ${repoTag}`;
      }
      att.color = colorSuccess;
      break;
    case "DeleteEvent":
      if (event.payload.ref === null) {
        text = `deleted ${event.payload.ref_type} at ${repoTag}`;
      } else {
        text = `deleted ${event.payload.ref_type} ${event.payload.ref.replace("refs/heads/", "")} at ${repoTag}`;
      }
      att.color = colorDanger;
      break;
    case "ForkEvent":
      let forkBranchTag = `*<${event.payload.forkee.html_url}|${event.payload.forkee.full_name}>*`;
      text = `forked ${forkBranchTag} from ${repoTag}`;
      att.color = colorLink;
      break;
    case "IssuesEvent":
      text = `${event.payload.action} an issue in ${repoTag}`;
      att.fields = [{
        value: `*<${event.payload.issue.html_url}|#${event.payload.issue.number} ${event.payload.issue.title}>*`
      }]

      if (event.payload.action === "opened") {
        att.color = colorSuccess;
      } else if (event.payload.action === "reopened") {
        att.color = colorInfo;
      } else {
        att.color = colorDanger;
      }
      break;
    case "IssueCommentEvent":
      let issueCommentTag = `*<${event.payload.comment.html_url}|${event.repo.name}#${event.payload.issue.number}>*`;

      let evType = "issue";
      if (event.payload.issue.html_url.includes("/pull/")) {
        evType = "PR";
      }

      text = `commented on ${evType} ${issueCommentTag}`;
      att.fields = [{
        value: `> ${event.payload.comment.body}`
      }];
      att.color = colorWarning;
      break;
    case "MemberEvent":
      text = `${event.payload.action} *<${event.payload.member.html_url}|${event.payload.member.login}>* to ${repoTag}`;
      att.color = colorInfo;
      break;
    case "PullRequestEvent":
      text = `${event.payload.action} an pull request in ${repoTag}`;
      att.fields = [{
        value: `*<${event.payload.pull_request.html_url}|#${event.payload.pull_request.number} ${event.payload.pull_request.title}>*`
      }]

      if (event.payload.action === "opened") {
        att.color = colorSuccess;
      } else if (event.payload.action === "reopened") {
        att.color = colorInfo;
      } else {
        att.color = colorDanger;
      }
      break;
    case "PushEvent":
      text = `pushed to ${branchTag} in ${repoTag}`;
      att.fields = _.map(_.reverse(event.payload.commits), (c) => {
        let sha = c.sha.slice(0, 7);
        let shaURL = c.url.replace("api.github.com/repos", "github.com").replace("commits", "commit");
        let shaTag = `\`<${shaURL}|${sha}>\``;
        return {
          value: `${shaTag}  ${c.message}`
        };
      });
      att.color = colorLink;
      break;
    case "ReleaseEvent":
      let releaseTag = `*<${event.payload.html_url}|${event.payload.release.name}>*`;
      text = `released  at ${repoTag}`;
      att.fields = [{
        value: `*<${repoURL}/archive/${event.payload.release.tag_name}.zip|Source code (zip)>*`
      }];
      att.color = colorPrimary;
      break;
    default:
      text = "拾いきれてないイベントだよ!!報告してください" + event.type;
      break;
  }
  att.fallback, att.text = text, text;

  return att;
};

module.exports = robot => {
  if (!(GITHUB_DASHBOARD_API && GITHUB_TOKEN && GH_AC_CHANNEL)) {
    return;
  }

  let cache = [];

  new CronJob('0 */1 * * * *', () => {
    robot.logger.debug("Get github dashboard");
    getEvent()
      .then(eventList => {
        if (cache.length === 0) {
          cache = _.map(eventList, (d) => d.id);
          return;
        }

        let idList = _.difference(_.map(eventList, (d) => d.id), cache);
        robot.logger.debug("idList");
        robot.logger.debug(idList);
        let notifyList = _.reverse(_.filter(eventList, (ev) => {
          if (_.includes(idList, ev.id)) {
            return true;
          }
          return false;
        }))

        cache = _.map(eventList, (d) => d.id);
        robot.logger.debug("notifyList");
        robot.logger.debug(notifyList);

        robot.messageRoom(GH_AC_CHANNEL, ...(_.map(notifyList, (event) => {
          return {
            "username": event.actor.display_login,
            "icon_url": event.actor.avatar_url,
            "attachments": [formatAtt(event)],
            "as_user": false
          };
        })));
      }).catch(err => {
        robot.logger.error(err);
      });
  }, null, true, 'Asia/Tokyo');
}