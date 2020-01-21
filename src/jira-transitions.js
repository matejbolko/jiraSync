const index = require('./../index')

function updateStatusInJira (jiraHostREST, sourceJiraFieldKey, body) {
  console.log('------------------------- status update---------------------------------------')
  let itemField
  let itemFieldToString
  let itemFieldToId
  let transitionExists = '0'

  // remove null objects
  index.removeNull(body)

  // read all items from array
  body.changelog.items.forEach(function (item, index) {
    if (item.field === 'status') {
      itemField = item.field.toString()
      itemFieldToString = item.toString
      itemFieldToId = item.to
    } else if (item.field === 'resolution') {
      console.log('Need to set resolution')
    } else {
      console.log('This transition is unknown ' + item.field + ' ' + itemField)
    }
  })

  // get all transitions possible
  // on possible transitions -> check for all transitions if the name of transition on one side is same on other
  // if true -> do the transition
  // else return that transition is not possible
  jiraHostREST.issue.getTransitions({
    issueKey: body.issue.fields[sourceJiraFieldKey]
  })
    .then(value => {
      let transItem
      value.transitions.forEach(function (item, index) {
        if (item.name === itemFieldToString) {
          itemFieldToId = item.id

          // update transition of the issue
          transItem = jiraHostREST.issue.transitionIssue({
            issueKey: body.issue.fields[sourceJiraFieldKey],
            transition: {
              id: itemFieldToId
            }
          })
            .then(value => {
              transitionExists = '1'
              console.log('Transition was successfully made')
              return item
            })
            .catch(error => {
              console.log('Error while setting transitions in jira')
              console.log(error)
            })
        }
      })
      if (transItem == null) {
        return value
      } else {
        return transItem
      }
    })
    .then(value => {
      if (transitionExists === '0') {
        console.log('Transition does NOT EXISTS! Check workflow and trasitions')
        console.log('Possible transitions are: ')
        console.log(value)
        console.log('JiraSync wants to set status, that DO NOT EXISTS!: ')
        console.log(body.changelog.items)
      }
    })
    .catch(error => {
      console.log('Transition does NOT EXISTS! Check workflow and trasitions')
      console.log(error)
    })
  console.log('-------------------------status end update---------------------------------------')
}

module.exports.updateStatusInJira = updateStatusInJira
