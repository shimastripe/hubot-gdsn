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
  let att = {
    color: randomColor(),
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
    case "CreateEvent":
      if (event.payload.ref === null) {
        text = `created a ${event.payload.ref_type} at ${repoTag}`;
      } else {
        text = `created a ${event.payload.ref_type} ${branchTag} at ${repoTag}`;
      }
      att.fallback, att.text = text, text;
      break;
    case "PushEvent":
      text = `pushed to ${branchTag} in ${repoTag}`;
      att.fallback, att.text = text, text;
      att.fields = _.map(_.reverse(event.payload.commits), (c) => {
        let sha = c.sha.slice(0, 7);
        let shaURL = c.url.replace("api.github.com/repos", "github.com").replace("commits", "commit");
        let shaTag = `\`<${shaURL}|${sha}>\``;
        return { value: `${shaTag}  ${c.message}` };
      });
      break;
    case "IssuesEvent":
      text = `${event.payload.action} an issue in ${repoTag}`;
      att.fallback, att.text = text, text;
      att.fields = [
        { value: `*<${event.payload.issue.html_url}|#${event.payload.issue.number} ${event.payload.issue.title}>*` }
      ]
      break;
    case "MemberEvent":
      text = `${event.payload.action} *<${event.payload.member.html_url}|${event.payload.member.login}>* to ${repoTag}`;
      att.fallback, att.text = text, text;
      break;
    case "CommitCommentEvent":
      let sha = event.payload.comment.commit_id.slice(0, 7);
      let commitTag = `*<${event.payload.comment.html_url}|${event.repo.name}@${sha}>*`;
      text = `commentd on commit ${commitTag}`;
      att.fallback, att.text = text, text;
      att.fields = [
        { value: `> ${event.payload.comment.body}` }
      ]
      break;
    case "PullRequestEvent":
      text = `${event.payload.action} an pull request in ${repoTag}`;
      att.fallback, att.text = text, text;
      att.fields = [
        { value: `*<${event.payload.pull_request.html_url}|#${event.payload.pull_request.number} ${event.payload.pull_request.title}>*` }
      ]
      break;
    case "IssueCommentEvent":
      let issueCommentTag = `*<${event.payload.comment.html_url}|${event.repo.name}#${event.payload.issue.number}>*`;
      text = `commentd on pull request ${issueCommentTag}`;
      att.fallback, att.text = text, text;
      att.fields = [
        { value: `> ${event.payload.comment.body}` }
      ]
      break;
    case "DeleteEvent":
      if (event.payload.ref === null) {
        text = `deleted ${event.payload.ref_type} at ${repoTag}`;
      } else {
        text = `deleted ${event.payload.ref_type} ${event.payload.ref.replace("refs/heads/", "")} at ${repoTag}`;
      }
      att.fallback, att.text = text, text;
      break;
    // case "WatchEvent":
    //   break;
    default:
      text = "拾いきれてないイベントだよ!!報告してください"
      att.fallback, att.text = text, text;
      break;
  }

  return att;
};

module.exports = robot => {
  if (!(GITHUB_DASHBOARD_API && GITHUB_TOKEN && GH_AC_CHANNEL)) {
    return;
  }

  let cache = [];

  new CronJob('0 */5 * * * *', () => {
    robot.logger.debug("Get github dashboard");
    getEvent()
      .then(eventList => {
        if (cache.length === 0) {
          cache = eventList;
          return;
        }

        let notifyList = _.reverse(_.differenceWith(eventList, cache, _.isEqual));
        robot.logger.debug(notifyList);
        cache = eventList;

        robot.messageRoom(GH_AC_CHANNEL, ...(_.map(notifyList, (event) => {
          return {
            "username": event.actor.display_login,
            "icon_url": event.actor.avatar_url,
            "attachments": [formatAtt(event)],
            "as_user": false
          };
        })));
      }).catch(err => {
        console.error(err)
      });
  }, null, true, 'Asia/Tokyo');
}