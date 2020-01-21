const AttachmentClient = require('jira-connector')
const fs = require('fs')
const fetch = require('node-fetch')

const index = require('./../index')

const attLocation = index.attachmentsLocation
console.log("attachmentsLocation: "+attLocation)
function syncAttachments (jiraHostWH, jiraHostREST, body, sourceJiraFieldKey, issueKey, issueKeyREST, attId) {
  console.log('Downloading attachment!')
  const jiraAttachmentClient = new AttachmentClient(jiraHostWH)
  jiraAttachmentClient.attachment.getAttachment({
    attachmentId: attId
  })
    .then(value => {
      // create directory, if does not exists
      const dirpath = attachmentsLocation + issueKey + '/'
      fs.mkdirSync(dirpath, { recursive: true })
      const filename = attachmentsLocation + issueKey + '/' + value.filename
      // get attachment URL
      const attachmentURL = new URL(value.content)
      // create header for connection to jira
      const options = {
        headers: {
          Authorization: 'Basic ' + jiraHostWH.basic_auth.base64
        },
        responseType: 'blob'
      }
      // get file from jira and save it to disk
      return fetch(attachmentURL, options)
        .then(response => {
          return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(filename, {
              autoclose: true
            })
            response.body.pipe(fileStream)
            response.body.on('error', (error) => {
              fileStream.close()
              reject(error)
            })
            fileStream.on('finish', () => {
              fileStream.close()
              resolve(filename)
            })
          })
        })
        .catch(error => {
          console.log('There was error while fetching attachment from jira')
          console.log(error)
        })
    })
    .then(attFilename => {
      jiraHostREST.issue.addAttachment({
        issueKey: issueKeyREST,
        filename: attFilename,
        headers: {
          Authorization: 'Basic ' + jiraHostWH.basic_auth.base64,
          'X-Atlassian-Token': 'nocheck'
        }
      }).catch(error => {
        console.log('Error while addingAttachment')
        console.log(error)
      })
    })
    .catch(error => {
      console.log('Error while gettingAttachment')
      console.log(error)
    })
}

module.exports.syncAttachments = syncAttachments
