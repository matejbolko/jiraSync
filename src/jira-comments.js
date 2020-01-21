function createCommentInJira (jiraHostREST, sourceJiraFieldKey, body) {
  const issueKey = body.issue.key
  const jiraJQL = 'SourceJira ~ \'' + issueKey + '\''
  if (body.issue.fields[sourceJiraFieldKey] === null) {
    console.log('JQL has 0 results')
    console.log(body.issue.fields[sourceJiraFieldKey])
  }
  console.log('JQL used for createCommentInJira: ' + jiraJQL)

  // search for issues with issueKey -> returns array
  jiraHostREST.search.search({
    jql: jiraJQL
  }).then(issue => {
    if (issue.total === 0) {
      console.log('Issue does not exists')
    } else if (issue.total === 1) {
      console.log('Add comment to issue: ' + issue.issues[0].key + ' in jira ' + jiraHostREST.host)
      const timestamp = body.comment.updated
      const datum = timestamp.split('T')[0]
      const time = timestamp.split('T')[1].split('.')[0]
      // we want to add first line: *(i)#i<id_number>#* *<username> wrote at <date> <time>*
      const komentar = '*(i)#id' + body.comment.id + '#* *' + body.comment.author.displayName + ' wrote at ' + datum + ' ' + time + '* \r\n' + body.comment.body
      jiraHostREST.issue.addComment({
        issueKey: issue.issues[0].key,
        body: komentar
      }).catch(error => {
        console.log('An error has occurred while calling method addComment!')
        console.error(error)
      })
    } else {
      console.log('Check Jiri JQL - I find more then 1 jira with key ' + issue.issues[0].key)
      console.log(issue)
    }
  }).catch(error => {
    console.log('An error has occurred while creating comment in jira. See log for more data!')
    console.error(error)
  })
}

function deleteCommentInJira (jiraHostREST, sourceJiraFieldKey, body, issueKey, commentIDSource, commentBodySource) {
  // check how comment starts - search for string: *(i)#id[1-20 numbers]#*
  // exclude groups with ?:
  let commentDeleted = 0
  const re = new RegExp('\\*\\((?:[i])\\)\\#id[0-9]{1,20}\\#\\*')
  const firstCommentLine = commentBodySource.match(re)
  // we have two scenarios: first one - we are deleting comment made by jiraSynx, second one - we are deleting comment made by user
  // 1. read first line of comment - if it starts with regex string then it is copied over by JiraSync.
  // 2. just read comment ID, connect to other jira and delete it

  // 1. if first line is without regex string - then you need to connect to other jira, and get all the comments from issue
  // 2. read all comments and search for matching commentID from the first line of every comment
  // 3. when found, delete comment
  if (!Array.isArray(firstCommentLine)) {
    // if firstCommentLine is not array - comment was not created by jiraSync.
    // get all comments from other jira for issueKey
    jiraHostREST.issue.getComments({
      issueKey: body.issue.fields[sourceJiraFieldKey]
    }).then(value => {
      // read first line from each comment searching for regex (made by jiraSync) and matching ID
      value.comments.forEach(comment => {
        const firstCommentLine = comment.body.match(re)
        if (!Array.isArray(firstCommentLine)) {
          // read first line - we are searching for comment made by JiraSync.
          // If it was not made by jiraSync - we can ignore comment
        } else {
          // found comment made by jiraSync
          let syncCommentID = firstCommentLine[0].toString()
          syncCommentID = syncCommentID.substring(0, syncCommentID.length - 2) // remove last two #*
          syncCommentID = syncCommentID.substring(7)
          if (syncCommentID === commentIDSource) {
            // found mathing commentID -> delete comment.
            jiraHostREST.issue.deleteComment({
              issueKey: body.issue.fields[sourceJiraFieldKey],
              commentId: comment.id
            })
              .then(value => {
                commentDeleted = 1
                console.log('Comment ' + comment.id + ' in issue ' + body.issue.fields[sourceJiraFieldKey] + ' from jira ' + jiraHostREST.host + ' has been deleted!')
              })
              .catch(error => {
                console.log('Error has occurred while deleting comment in jira. See log for more details!')
                console.error(error)
              })
          }
        }
      }) // end of forEach
    }).catch(error => {
      console.log('Error has occurred while getting comment list - delete!')
      console.error(error)
    })
  } else {
    // selected comment for deletion was made by jiraSync
    // we can just read ID from first line of comment and delete comment
    let syncedCommentID = firstCommentLine[0].toString()
    syncedCommentID = syncedCommentID.substring(0, syncedCommentID.length - 2) // remove last two #*
    syncedCommentID = syncedCommentID.substring(7) // remove frist 7: *(i)#id
    jiraHostREST.issue.deleteComment({
      issueKey: body.issue.fields[sourceJiraFieldKey],
      commentId: syncedCommentID
    })
      .then(value => {
        commentDeleted = 1
        console.log('Comment ' + syncedCommentID + ' in issue ' + body.issue.fields[sourceJiraFieldKey] + ' from jira ' + jiraHostREST.host + ' has been deleted!')
      })
      .catch(error => {
        console.log('Error has occurred while deleting comment in jira. See log for more details!')
        console.error(error)
      })
  }
  if (commentDeleted === '0') {
    console.log('JiraSync didn\'t found matching comment for comment ' + commentIDSource + '. Please check issue ' + body.issue.fields[sourceJiraFieldKey])
  }
}

function updateCommentInJira (jiraHostREST, sourceJiraFieldKey, body, commentIDSource, commentBodySource) {
  const issueKey = body.issue.key
  let commentUpdated = 0
  // check how comment starts - search for string: *(i)#id[1-20 numbers]#*
  // exclude groups with ?:
  const re = new RegExp('\\*\\((?:[i])\\)\\#id[0-9]{1,20}\\#\\*')
  const firstCommentLine = commentBodySource.match(re)
  // read first line of comment - if it starts with regex string then it is copied over with copycat.
  // just read comment ID, connect to other jira and delete it
  // if first line is without regex string - then you need to connect to other issue and get all the comments
  // in look read all comments and search for matching commentID from the first line of every comment
  // when found, delete comment
  if (!Array.isArray(firstCommentLine)) {
    // if firstCommentLine is not array - comment was not created by jiraSync.
    // get comments from issue from other jira
    jiraHostREST.issue.getComments({
      issueKey: body.issue.fields[sourceJiraFieldKey]
    })
      .then(value => {
        const timestamp = body.comment.updated
        const datum = timestamp.split('T')[0]
        const time = timestamp.split('T')[1].split('.')[0]
        value.comments.forEach(function (comment) {
          const firstCommentLine = comment.body.match(re)
          if (!Array.isArray(firstCommentLine)) {
            // read first line - not made by jiraSync - we can ignore comment
          } else {
            // found comment made by jiraSync
            let syncCommentID = firstCommentLine[0].toString()
            syncCommentID = syncCommentID.substring(0, syncCommentID.length - 2) // remove last two #*
            syncCommentID = syncCommentID.substring(7)
            if (syncCommentID === commentIDSource) {
              // found mathing commentID -> delete comment.
              const komentar = '*(i)#id' + commentIDSource + '#* *' + body.comment.author.displayName + ' updated at ' + datum + ' ' + time + '* \r\n' + commentBodySource
              jiraHostREST.issue.editComment({
                issueKey: body.issue.fields[sourceJiraFieldKey],
                commentId: comment.id,
                comment: {
                  body: komentar
                }
              })
                .then(value => {
                  commentUpdated = 1
                  console.log('Comment ' + comment.id + ' in issue ' + body.issue.fields[sourceJiraFieldKey] + ' from jira ' + jiraHostREST.host + ' has been updated!')
                })
                .catch(error => {
                  console.log('Error has occurred while updating comment in jira. See log for more details!')
                  console.error(error)
                })
            }
          }
        }) // end of forEach
      })
      .catch(error => {
        console.log('Error has occurred while getting list of comments in updating issue!')
        console.error(error)
      })
  } else if (firstCommentLine.length >= 1) {
    commentUpdated = 1
    // selected comment for deletion was made by jiraSync -> this scenario is not foreseen and not supported!
    console.log('ERROR! - Issue was NOT updated! - Comment, that was edited, was created by jiraSync')
    console.log('This scenario is not foreseen and not supported!')
  }
  if (commentUpdated === '0') {
    console.log('Comment was NOT updated!')
    console.log('JiraSync didn\'t found matching comment for comment ' + commentIDSource + '. Please check issue ' + body.issue.fields[sourceJiraFieldKey])
  }
}

module.exports.createCommentInJira = createCommentInJira
module.exports.deleteCommentInJira = deleteCommentInJira
module.exports.updateCommentInJira = updateCommentInJira
