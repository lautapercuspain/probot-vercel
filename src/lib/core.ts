import { generateSuggestion, getChangedFiles } from './utils'
import axios from 'axios'
import { Octokit } from '@octokit/core'
import { createAppAuth } from '@octokit/auth-app'
const messageForNewPRs = "We're analyzing the contents of the PR's files in order to create unit tests for it."

export async function handlePullRequestOpened({ payload }) {
  //   console.log(`Received a pull request event for #${payload.pull_request.head.ref}`)
  //   const ghTotken = process.env.PATGH || ''
  //   const installationId = payload.installation.id
  //   clientId: process.env.CLIENT_ID,
  //   clientSecret: process.env.CLIENT_SECRET,
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      installationId: payload.installation.id,
      appId: process.env.APP_ID,
      privateKey: process.env.PRIVATE_KEY,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
    },
  })

  const auth = createAppAuth({
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  })

  // Retrieve JSON Web Token (JWT) to authenticate as app
  const appAuthentication = await auth({ type: 'app' })
  console.log('appAuthentication:', appAuthentication)

  //   console.log(`APP ID, ${process.env.APP_ID}`)
  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const pullRequestNumber = payload.pull_request.number
  const res = await octokit
    .request(`POST /repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`, {
      body: messageForNewPRs,
      headers: {
        'x-github-api-version': '2022-11-28',
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appAuthentication.token}`,
      },
    })
    .then((data) => console.log(data))
  console.log('res:', res)

  // console.log(`Branch Name:`, payload.pull_request.head.ref)
  // console.dir(payload);

  let suggestions
  let prediction
  let depList

  //Get the contents of package json.
  //   octokit.rest.repos
  //     .getContent({
  //       owner,
  //       repo,
  //       path: 'package.json',
  //     })
  //     .then((response) => {
  //       const content = Buffer.from(response.data.content, 'base64').toString('utf-8')

  //       // Parse the package.json content
  //       const dependencies = JSON.parse(content).devDependencies
  //       //Get the keys, A.k.A: The lib names.
  //       depList = Object.keys(dependencies).join(', ')
  //     })
  //     .catch((error) => {
  //       console.error(error)
  //     })

  getChangedFiles({ owner, repo, pullRequestNumber, octokit }).then(async (changedFiles) => {
    // console.log('Changed files:')
    changedFiles.forEach((file) => {
      console.info('File:', file.filename)
      console.log('Status:', file.status)
      console.log('Additions:', file.additions)
      console.log('Deletions:', file.deletions)
      console.log('Changes:', file.changes)
      console.log('Blob URL:', file.blobUrl)
      const rawUrl = file.blobUrl.replace('/blob/', '/raw/')
      // console.log('rawUrl:', rawUrl)

      let relativePath = file.filename.split('/').slice(0, -1).join('/')
      let lastPart = file.filename.split('/').pop()
      let [filename, extension] = lastPart.split('.')

      return axios
        .get(rawUrl)
        .then(async (response) => {
          if (response.status === 200) {
            const fileContents = response.data
            console.log('fileContents:')
            console.info(fileContents)

            suggestions = await generateSuggestion(fileContents, depList)
            console.info(suggestions)
            prediction = suggestions[0].message.content
            console.log('Prediction: ', prediction)
            if (prediction.length > 0) {
              try {
                await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
                  owner: payload.repository.owner.login,
                  repo: payload.repository.name,
                  issue_number: payload.pull_request.number,
                  body: `A test has been generated for the filename: ${file.filename}`,
                  headers: {
                    'x-github-api-version': '2022-11-28',
                  },
                })
              } catch (error) {
                if (error.response) {
                  console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                }
                console.error(error)
              }
              ;(async () => {
                // console.log('lastPart:', lastPart)
                // console.log('extension:', extension)
                // console.log('filename:', filename)
                try {
                  //Ensure aren't creating a test for a test itself.
                  if (extension !== 'test') {
                    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                      owner,
                      repo,
                      path: `${relativePath}/${filename.toLowerCase()}.test.${extension}`,
                      branch: payload.pull_request.head.ref,
                      message: `new test added for the ${filename} component.`,
                      committer: {
                        name: 'Code Genius',
                        email: 'geniuscodeai@gmail.com',
                      },
                      content: btoa(
                        prediction.replace('```', '').replace('javascript', '').replace('jsx', '').replace('```', '')
                      ),
                      headers: {
                        'X-GitHub-Api-Version': '2022-11-28',
                      },
                    })
                    // console.log('PR updated successfully:', response.data)
                  }
                } catch (error) {
                  console.error('Error updating PR:', error)
                }
              })()
            }
          } else {
            console.log(`Failed to retrieve file contents. Status code: ${response.status}`)
          }
        })
        .catch((error) => {
          console.error('An error occurred:', error)
        })
    })
  })
}
