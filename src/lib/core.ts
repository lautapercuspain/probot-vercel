import { generateSuggestion, getChangedFiles } from './utils'
import 'isomorphic-fetch'
// import { Octokit } from '@octokit/core'
// import { createAppAuth } from '@octokit/auth-app'
const messageForNewPRs = "We're analyzing the contents of the PR's files in order to create unit tests for it."

export async function handlePullRequestOpened({ payload, octokit }) {
  //   console.log(`Received a pull request event for #${payload.pull_request.head.ref}`)
  //   const ghTotken = process.env.PATGH || ''
  //   const installationId = payload.installation.id
  //   clientId: process.env.CLIENT_ID,
  //   clientSecret: process.env.CLIENT_SECRET,
  // const octokit = new Octokit({
  //   authStrategy: createAppAuth,
  //   auth: {
  //     installationId: payload.installation.id,
  //     appId: process.env.APP_ID,
  //     privateKey: process.env.PRIVATE_KEY,
  //     clientId: process.env.CLIENT_ID,
  //     clientSecret: process.env.CLIENT_SECRET,
  //   },
  // })

  // const auth = createAppAuth({
  //   appId: process.env.APP_ID,
  //   privateKey: process.env.PRIVATE_KEY,
  //   clientId: process.env.CLIENT_ID,
  //   clientSecret: process.env.CLIENT_SECRET,
  // })

  // // Retrieve JSON Web Token (JWT) to authenticate as app
  // const appAuthentication = await auth({ type: 'app' })
  // console.log('appAuthentication:', appAuthentication)

  //   console.log(`APP ID, ${process.env.APP_ID}`)
  let suggestions
  let prediction
  let depList

  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const pullRequestNumber = payload.pull_request.number
  await octokit
    .request(`POST /repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`, {
      body: messageForNewPRs,
      headers: {
        'x-github-api-version': '2022-11-28',
        Accept: 'application/vnd.github+json',
        // Authorization: `Bearer ${appAuthentication.token}`,
      },
    })
    .then((data) => console.log(data))
  // console.log('res:', res)

  console.log(`Branch Name:`, payload.pull_request.head.ref)
  // console.dir(payload);

  //Get the contents of package json.
  octokit.rest.repos
    .getContent({
      owner,
      repo,
      path: 'package.json',
    })
    .then((response) => {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      console.log('content:', content)

      // Parse the package.json content
      const dependencies = JSON.parse(content).devDependencies
      //Get the keys, A.k.A: The lib names.
      depList = Object.keys(dependencies).join(', ')
    })
    .catch((error) => {
      console.error(error)
    })

  return getChangedFiles({ owner, repo, pullRequestNumber, octokit }).then(async (changedFiles) => {
    // console.log('Changed files:')
    changedFiles.forEach(async (file) => {
      console.info('File:', file.filename)
      console.log('Status:', file.status)
      console.log('Additions:', file.additions)
      console.log('Deletions:', file.deletions)
      console.log('Changes:', file.changes)
      console.log('Blob URL:', file.blobUrl)
      const rawUrl = file.blobUrl.replace('/blob/', '/raw/')
      console.log('rawUrl:', rawUrl)

      let relativePath = file.filename.split('/').slice(0, -1).join('/')
      let lastPart = file.filename.split('/').pop()
      let [filename, extension] = lastPart.split('.')
      const response = await fetch(rawUrl)
      const fileContents = await response.text()
      console.log('fileContents:', fileContents)

      suggestions = await generateSuggestion(fileContents, depList)
      console.log('suggestions', suggestions)
      prediction = suggestions[0].message.content
      console.log('Prediction: ', prediction)

      if (prediction.length > 0) {
        try {
          await octokit.request(`POST /repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`, {
            body: `A test has been generated for the filename: ${file.filename}`,
            headers: {
              'x-github-api-version': '2022-11-28',
              Accept: 'application/vnd.github+json',
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
            //Ensure we aren't creating a test for a test itself.
            const path = `${relativePath}/${filename.toLowerCase()}.test.${extension}`
            if (extension !== 'test') {
              await octokit.request(`PUT /repos/${owner}/${repo}/contents/${path}`, {
                branch: payload.pull_request.head.ref,
                message: `A new test was added to cover ${filename}.`,
                committer: {
                  name: 'Lautaro Gruss',
                  email: 'lautapercuspain@gmail.com',
                },
                content: btoa(
                  prediction.replace('```', '').replace('javascript', '').replace('jsx', '').replace('```', '')
                ),
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28',
                  Accept: 'application/vnd.github+json',
                },
              })
              // console.log('PR updated successfully:', response.data)
            }
          } catch (error) {
            console.error('Error updating PR:', error)
          }
        })()
      }
    })
  })
}
