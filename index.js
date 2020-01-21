const express = require('express')
const bodyParser = require('body-parser')
// read config file
const fs = require('fs')
// https://www.npmjs.com/package/jira-connector
const JiraClient = require('jira-connector')

const jiraSyncComments = require('./src/jira-comments')
const jiraSyncIssues = require('./src/jira-issues')
const jiraSyncAttachments = require('./src/jira-attachments')
const jiraSyncTransitions = require('./src/jira-transitions')

const app = express()
const config = './config/config.json'
const hosts = ['/jira1/', '/jira2/']
let jira1
let jira2
let jira1Project
let jira2Project
let sourceJiraField
let attachmentsLocation

// promise for two webhooks
let commentDeleteID
let attachmentToTransfer = []

const commentEdit = {
  get commentID () {
    return this._commentID
  },
  set commentID (value) {
    this._commentID = value
  },

  get commentBody () {
    return this._commentBody
  },
  set commentBody (value) {
    this._commentBody = value
  }
}

function readConfigFile (filename, callback) {
  fs.readFile(filename, function (error, data) {
    if (error) {
      callback(error)
      return
    }
    try {
      callback(null, JSON.parse(data))
    } catch (error) {
      console.log('ERROR - Error found in JSON config file. Please check config file ' + filename)
      console.log()
      callback(error)
    }
  })
}

function removeNull (o) {
  for (const key in o) {
    if (o[key] === null) o[key] = ''
    if (typeof o[key] === 'object') removeNull(o[key])
  }
}

function syncJira (req, res, jiraHostWH, jiraProject) {
  console.log('------------------ START sync ------------------------')
  console.log(attachmentsLocation)
  const body = req.body
  let jiraHostREST
  let sourceJiraFieldREST
  let sourceJiraFieldKey
  // set jiraHostREST
  if (jiraHostWH.host === jira1.host) {
    jiraHostREST = jira2
    sourceJiraFieldREST = sourceJiraField.jira2
    sourceJiraFieldKey = sourceJiraField.jira1
  } else {
    jiraHostREST = jira1
    sourceJiraFieldREST = sourceJiraField.jira1
    sourceJiraFieldKey = sourceJiraField.jira2
  }

  // ignore webhooks that are createdy by copy user BUT update JiraSync field
  if ((req.query.user_id === 'copycat') || (req.query.user_key === 'copycat')) {
    res.status(200)
    res.send('OK')
    console.log('copycat! :) ')
    if (Object.prototype.hasOwnProperty.call(body, 'webhookEvent') === true) {
      // update JiraSync field
      if (body.webhookEvent === 'jira:issue_created') {
        console.log('Edit issue made by copycat')
        jiraHostREST.issue.editIssue({
          issueKey: body.issue.fields[sourceJiraFieldKey],
          issue: {
            fields: {
              [sourceJiraFieldREST]: body.issue.key
            }
          }
        })
          .then(value => {
            const issueKey = body.issue.key
            if (attachmentToTransfer.length > 0) {
              attachmentToTransfer.forEach(item => {
                const attId = item
                const issueKeyREST = body.issue.fields[sourceJiraFieldKey]
                jiraSyncAttachments.syncAttachments(jiraHostREST, jiraHostWH, body, sourceJiraFieldKey, issueKeyREST, issueKey, attId)
              })
            }
            return attachmentToTransfer
          }).then((value) => {
            attachmentToTransfer = []
          })
          .catch(error => {
            console.log('An error has occurred while setting value in field sourceJira in jira. See log for more data!')
            console.error(error)
          })
      }
    }
    return
  } else {
    // console.log('----------------------sync-----------------------------')
    // console.dir(req.hostname)
    // console.dir(req.originalUrl)
    // console.log()
    // console.log('------------------ JSON HEADER -----------------------)
    // console.log(JSON.stringify(req.headers))
    // console.log('------------------ start JSON REQBODY ----------------')
    // console.log(body)
    // console.log('------------------ end JSON REQBODY ------------------')
    // write to jiraREST - read from jiraWH
    let sourceJiraFieldKey
    if (jiraHostREST.host === jira1.host) {
      sourceJiraFieldKey = sourceJiraField.jira2
    } else {
      sourceJiraFieldKey = sourceJiraField.jira1
    }
    switch (body.webhookEvent) {
      case 'jira:issue_updated': {
        if (Object.prototype.hasOwnProperty.call(body, 'issue_event_type_name')) {
          switch (body.issue_event_type_name) {
            case 'issue_commented': {
              console.log('Webhook to update ' + body.issue.key + ' issue_commented')
              jiraSyncComments.createCommentInJira(jiraHostREST, sourceJiraFieldKey, body)
              break
            }
            case 'issue_updated': {
              console.log('Webhook to update ' + body.issue.key + ' issue_updated')
              jiraSyncIssues.updateIssueInJira(jira1, jira2, jiraHostWH, jiraHostREST, sourceJiraField, sourceJiraFieldKey, body)
              break
            }
            case 'issue_generic': {
              console.log('Webhook to update ' + body.issue.key + ' issue_generic')
              jiraSyncTransitions.updateStatusInJira(jiraHostREST, sourceJiraFieldKey, body)
              break
            }
            case 'issue_assigned': {
              console.log('Webhook to update ' + body.issue.key + ' issue_assigned')
              jiraSyncIssues.updateIssueInJira(jira1, jira2, jiraHostWH, jiraHostREST, sourceJiraField, sourceJiraFieldKey, body)
              break
            }
            case 'issue_comment_edited': {
              console.log('Webhook to update ' + body.issue.key + ' issue_comment_edited')
              jiraSyncComments.updateCommentInJira(jiraHostREST, sourceJiraFieldKey, body, commentEdit.commentID, commentEdit.commentBody)
              break
            }
            case 'issue_comment_deleted': {
              console.log('Webhook to delete ' + body.issue.key + ' issue_comment_deleted')
              let commentDeleteBody = new Promise((resolve, reject) => {
                const commentData = {
                  jiraHostREST: jiraHostREST,
                  body: body,
                  key: body.issue.key
                }
                resolve(commentData)
              })
                .catch(error => {
                  console.log('Error while deleting comment')
                  console.log(error)
                })

              Promise.all([commentDeleteID, commentDeleteBody]).then(values => {
                jiraSyncComments.deleteCommentInJira(values[1].jiraHostREST, sourceJiraFieldKey, values[1].body, values[1].key, values[0].id, values[0].body)
                return 'deleted'
              })
                .then(value => {
                  commentDeleteID = ''
                  commentDeleteBody = ''
                })
                .catch(error => {
                  console.log('Error while deleting comment. PromiseALL failed!')
                  console.log(error)
                })
              break
            }
            // body.issue_event_type_name
            default: {
              console.log('Issue update is not supported! ' + body.issue_event_type_name)
            }
          }
        } else {
          console.log('Cannot find webhookEvent issue_event_type_name. Unsupported!')
        }
        console.log(body.issue.key + ' issue has been UPDATED!')
        // end of case 'jira:issue_updated'
        break
      }
      case 'jira:issue_created': {
        let sourceJiraFieldCreate
        if (jiraHostREST.host === jira1.host) {
          sourceJiraFieldCreate = sourceJiraField.jira1
        } else {
          sourceJiraFieldCreate = sourceJiraField.jira2
        }
        jiraSyncIssues.createIssueInJira(jiraHostWH, jiraHostREST, sourceJiraFieldCreate, body, jiraProject)
        console.log('Webhook to update ' + body.issue.key + ' issue has been CREATED!')
        break
      }
      case 'jira:issue_deleted': {
        jiraSyncIssues.deleteIssueInJira(jiraHostREST, sourceJiraFieldKey, body)
        console.log('Webhook to update ' + body.issue.key + ' issue DELETED!')
        break
      }
      case 'comment_created': {
        // ignore webhook - all data is sent with issue_updated. see createCommentInJira function
        break
      }
      case 'comment_updated': {
        commentEdit.commentID = body.comment.id
        commentEdit.commentBody = body.comment.body
        console.log('Webhook to update comment ' + commentEdit.commentID)
        break
      }
      case 'comment_deleted': {
        commentDeleteID = new Promise((resolve, reject) => {
          const commentData = {
            id: body.comment.id,
            body: body.comment.body
          }
          resolve(commentData)
        }).catch(error => {
          console.log('Error while deleting comment in commentDeleteID promise')
          console.log(error)
        })
        console.log('Webhook to delete comment ' + commentDeleteID.id)
        break
      }
      default: {
        console.log('Webhook - action NOT DEFINED! ' + body.webhookEvent)
      }
    }
  }
  res.status(200)
  res.send('OK')
  console.log('------------------ END sync ----------------------------')
}
// parse JSON
app.use(bodyParser.json())

app.post(hosts, function (req, res) {
  try {
    console.log('------------------ START APP.POST ----------------------')
    // check, from where comes webhook - infinite loop!
    let rPath = req.path
    rPath = rPath.replace(/\//g, '') // remove slashes
    if (rPath !== jira1.host) {
      syncJira(req, res, jira2, jira1Project)
    } else {
      syncJira(req, res, jira1, jira2Project)
    }
    // console.log('------------------ END APP.POST ------------------------')
  } catch (error) {
    console.log('Error at app.post')
    console.log(error)
  }
})

app.listen(8080, function () {
  console.log('listening on port 8080')

  readConfigFile(config, function (error, configFileData) {
    // read config and define jira1 connection info
    jira1 = new JiraClient({
      host: configFileData.jira1.host,
      protocol: configFileData.jira1.protocol,
      port: configFileData.jira1.port,
      basic_auth: {
        username: configFileData.jira1.basic_auth.username,
        password: configFileData.jira1.basic_auth.password,
        base64: configFileData.jira1.basic_auth.base64
      }
    })
    // read config and define jira2 connection info
    jira2 = new JiraClient({
      host: configFileData.jira2.host,
      protocol: configFileData.jira2.protocol,
      port: configFileData.jira2.port,
      basic_auth: {
        username: configFileData.jira2.basic_auth.username,
        password: configFileData.jira2.basic_auth.password,
        base64: configFileData.jira2.basic_auth.base64
      }
    })
    // read config and define jira1 project sync info
    jira1Project = configFileData.syncProjects.project1.jira1
    jira2Project = configFileData.syncProjects.project1.jira2
    // read config and define id for field jiraSource for jira1 and jira2
    sourceJiraField = configFileData.sourceJiraField.project1
    // read location - we will save attachments there
    attachmentsLocation = configFileData.attachmentsLocation.location

    if (error) {
      throw error
    }
  })
})

module.exports.attachmentsLocation = attachmentsLocation
module.exports.attachmentToTransfer = attachmentToTransfer
module.exports.removeNull = removeNull