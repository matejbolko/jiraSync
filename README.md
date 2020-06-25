# JiraSync

Simple app using [Express](https://expressjs.com/) for syncing two jira project, using REST API and webhooks

## Prerequisites
- [nodeJS](https://nodejs.org/en/)
- [Express](https://expressjs.com/)
- Jira API wrapper [jira-connector](https://www.npmjs.com/package/jira-connector)

## Running Locally
Make sure you have [Node.js](https://nodejs.org/) installed.

```sh
git clone git@github.com:matejbolko/jiraSync.git # or clone your own fork
cd jiraSync
npm install
npm start
```

Your app should now be running on [localhost:8080](http://localhost:8080/).

## How to set up
1. edit ./config/config.json
- template is found here at config_template.json
- create base64 string username:password - you can use online program: https://www.base64encode.org/
- on both jira's create field named **"sourceJira"** and get ID from jira1 and jira2
- put location for attachments @ attachmentsLocation.
2. make sure that user, which you are using it to connect to jira1/jira2, has appropriate rights on the project, you are syncing
3. create webhooks on jiras you want to connect.
-  @jira1: create webook that point to localhost:8080/**jira1** _(change localhost:8080 with other name/port, where you run this program)_
- @jira1: create webook that point to localhost:8080/**jira1** _(change localhost:8080 with other name/port, where you run this program)_
- for DEV purpose you can use ngrok
