const jiraSyncAttachments = require('./jira-attachments')
const FieldClient = require('jira-connector')
const index = require('./../index')
const jiraSyncComments = require('./jira-comments')

function getSourceJiraField (jiraHostWH, jiraHostREST) {
  return new Promise((resolve, reject) => {
    let sourceJiraField1
    let sourceJiraField2
    const jiraFieldClient1 = new FieldClient(jiraHostWH)
    const promise1 = jiraFieldClient1.field.getAllFields()
      .then(value => {
        value.forEach(function (item) {
          if (item.name === 'SourceJira') {
            sourceJiraField1 = item.id
          }
        })
        return sourceJiraField1
      })
      .catch(error => {
        console.log(error)
      })

    const jiraFieldClient2 = new FieldClient(jiraHostREST)
    const promise2 = jiraFieldClient2.field.getAllFields()
      .then(value => {
        value.forEach(function (item) {
          if (item.name === 'SourceJira') {
            sourceJiraField2 = item.id
          }
        })
        return sourceJiraField2
      })
      .catch(error => {
        console.log(error)
      })

    Promise.all([promise1, promise2]).then(value => {
      const sourceJiraField = {
        jira1: sourceJiraField1,
        jira2: sourceJiraField2
      }
      resolve(sourceJiraField)
    })
  })
    .then(value => {
      return (value)
    })
    .catch(error => {
      console.log('Error while getting customFields data')
      console.log(error)
    })
}

function createIssueInJira (jiraHostWH, jira, sourceJiraFieldKey, body, issueProjectKey) {
  console.log('Creating JIRA ticket for in jira ' + jira.host + ' projet ' + issueProjectKey + '...')
  // remove null objects
  // call method createIssue -> returns promise.
  jira.issue.createIssue({
    fields: {
      project: {
        key: issueProjectKey
      },
      summary: body.issue.fields.summary,
      issuetype: {
        id: body.issue.fields.issuetype.id
      },
      priority: {
        id: body.issue.fields.priority.id
      },
      description: body.issue.fields.description,
      [sourceJiraFieldKey]: body.issue.key
    }
  })
    .then(value => {
      if (body.issue.fields.attachment.length > 0) {
        body.issue.fields.attachment.forEach(function (item) {
          index.attachmentToTransfer.push(item.id)
        })
      }
    })
    .catch(error => {
      console.log('An error has occurred while creating issue. See log for more data!')
      console.error(error)
    })
}

function deleteIssueInJira (jiraHostREST, sourceJiraFieldKey, body) {
  const issueKey = body.issue.key
  let jiraJQL = 'SourceJira ~ \'' + issueKey + '\''

  if (body.issue.fields[sourceJiraFieldKey] === null) {
    console.log('JQL has 0 results')
    console.log(body.issue.fields[sourceJiraFieldKey])
  } else {
    // get jira key from sourceJira field
    jiraJQL = jiraJQL.concat(' OR key = ' + body.issue.fields[sourceJiraFieldKey])
  }
  console.log('JQL used for deleteIssue: ' + jiraJQL)
  // search for issue with key issueKey OR key found in sourceJiraFieldKey
  jiraHostREST.search.search({
    jql: jiraJQL
  }).then(issue => {
    if (issue.total === 0) {
      console.log('Issue does not exists. Nothing was deleted on jira ' + jiraHostREST.host)
    } else if (issue.total === 1) {
      // returns array
      console.log('Deleting issue: ' + issue.issues[0].key + ' in jira ' + jiraHostREST.host)
      jiraHostREST.issue.deleteIssue({
        issueKey: issue.issues[0].key
      })
        .catch(error => {
          console.log('An error while calling methond deleteIssue!')
          console.error(error)
        })
    } else {
      console.log('Check Jira JQL - I find more then 1 issue with key ' + issue.issues[0].key)
      console.log(issue)
    }
  })
    .catch(error => {
      console.log('An error while deleting issue. See log for more data!')
      console.error(error)
    })
}

function updateIssueInJira (jira1, jira2, jiraHostWH, jiraHostREST, sourceJiraField, sourceJiraFieldKey, body) {
  console.log('-------------------------update---------------------------------------')
  // remove null objects
  const issueKey = body.issue.key
  body.changelog.items.forEach(function (item) {
    const itemField = item.field.toString()
    console.log('itemField: ' + itemField)
    if (itemField === 'issuetype' || itemField === 'priority') {
      const itemFieldId = item.to.toString()
      jiraHostREST.issue.editIssue({
        issueKey: body.issue.fields[sourceJiraFieldKey],
        issue: {
          fields: {
            [itemField]: {
              id: itemFieldId
            }
          }
        }
      })
        .catch(error => {
          console.log('An error has occurred while updating issueType/priority in jira. See log for more data!')
          console.error(error)
        })
    } else if (itemField === 'assignee') {
      const itemFieldKey = item.to
      jiraHostREST.issue.editIssue({
        issueKey: body.issue.fields[sourceJiraFieldKey],
        issue: {
          fields: {
            [itemField]: {
              name: itemFieldKey
            }
          }
        }
      })
        .catch(error => {
          console.log('An error has occurred while updating asignee in jira. See log for more data!')
          console.error(error)
        })
    } else if (itemField === 'labels') {
      const itemFieldArray = item.toString.split(' ')
      jiraHostREST.issue.editIssue({
        issueKey: body.issue.fields[sourceJiraFieldKey],
        issue: {
          fields: {
            [itemField]: itemFieldArray
          }
        }
      })
        .catch(error => {
          console.log('An error has occurred while updating labels in jira. See log for more data!')
          console.error(error)
        })
    } else if (itemField === 'description' || itemField === 'summary') {
      const itemFieldString = item.toString
      jiraHostREST.issue.editIssue({
        issueKey: body.issue.fields[sourceJiraFieldKey],
        issue: {
          fields: {
            [itemField]: itemFieldString
          }
        }
      })
        .catch(error => {
          console.log('An error has occurred while updating description/summary in jira. See log for more data!')
          console.error(error)
        })
    } else if (itemField === 'Attachment') {
      const issueKeyREST = body.issue.fields[sourceJiraFieldKey]
      jiraSyncAttachments.syncAttachments(jiraHostWH, jiraHostREST, body, sourceJiraFieldKey, issueKey, issueKeyREST, item.to)
    } else {
      console.log('This issue update is unsupported!')
      console.log(body.changelog.items)
    }
  }) // end forEach
  if (Object.prototype.hasOwnProperty.call(body, 'comment')) {
    // write to jiraREST - read from jiraWH
    let sourceJiraFieldKey
    if (jiraHostREST.host === jira1.host) {
      sourceJiraFieldKey = sourceJiraField.jira2
    } else {
      sourceJiraFieldKey = sourceJiraField.jira1
    }
    jiraSyncComments.createCommentInJira(jiraHostREST, sourceJiraFieldKey, body, issueKey)
  }
  console.log('-------------------------end update---------------------------------------')
}

module.exports.createIssueInJira = createIssueInJira
module.exports.deleteIssueInJira = deleteIssueInJira
module.exports.updateIssueInJira = updateIssueInJira
