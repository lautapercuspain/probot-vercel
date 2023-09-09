import OpenAI from 'openai'
import { getChangedFiles, getOpenAIPayload } from './utils'

// import { Octokit } from '@octokit/core'
// import { createAppAuth } from '@octokit/auth-app'
const messageForNewPRs = "We're analyzing the contents of the PR's files in order to create unit tests for it."

export async function handlePullRequestOpened({ payload, octokit, openai }) {
  let fileRes
  let rawUrl: string
  let relativePath: string
  let fileContents: string
  let filename: string
  let extension: string
  let depList = 'Jest, React Testing Library'

  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const pullRequestNumber = payload.pull_request.number
  await octokit.request(`POST /repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`, {
    body: messageForNewPRs,
    headers: {
      'x-github-api-version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      // Authorization: `Bearer ${appAuthentication.token}`,
    },
  })

  // console.log('res:', res)

  // console.log(`Branch Name:`, payload.pull_request.head.ref)
  // console.dir(payload);

  //Get the contents of package json.
  // await octokit.rest.repos
  //   .getContent({
  //     owner,
  //     repo,
  //     path: 'package.json',
  //   })
  //   .then((response) => {
  //     const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
  //     // console.log('content:', content)

  //     // Parse the package.json content
  //     const dependencies = JSON.parse(content).devDependencies
  //     //Get the keys, A.k.A: The lib names.
  //     depList = Object.keys(dependencies).join(', ')
  //   })
  //   .catch((error) => {
  //     console.error(error)
  //   })

  await getChangedFiles({ owner, repo, pullRequestNumber, octokit }).then(async (changedFiles) => {
    changedFiles.forEach(async (file) => {
      rawUrl = file.blobUrl.replace('/blob/', '/raw/')
      // console.log('rawUrl:', rawUrl)

      relativePath = file.filename.split('/').slice(0, -1).join('/')
      const lastPart = file.filename.split('/').pop()
      const [fname, ext] = lastPart.split('.')
      filename = fname
      extension = ext
    })

    fileRes = await fetch(rawUrl)
    if (!fileRes.ok) {
      throw new Error('Error fetching data from the API')
    }

    fileContents = await fileRes.text()

    // console.log('File contents:', fileContents)

    const payloadOpenAI = getOpenAIPayload(depList, fileContents)

    // console.log('payloadOpenAI:', payloadOpenAI)

    const completion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(payloadOpenAI)

    console.log('completion:', completion)

    if (completion) {
      // try {
      //   await octokit.request(`POST /repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`, {
      //     body: `A test has been generated for the filename: ${filename}`,
      //     headers: {
      //       'x-github-api-version': '2022-11-28',
      //       Accept: 'application/vnd.github+json',
      //     },
      //   })
      // } catch (error) {
      //   if (error.response) {
      //     console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
      //   }
      //   console.error(error)
      // }

      // console.log('lastPart:', lastPart)
      // console.log('extension:', extension)
      // console.log('filename:', filename)
      try {
        //Ensure we aren't creating a test for a test itself.
        const path = `${relativePath}/${filename.toLowerCase()}.test.${extension}`
        if (extension !== 'test') {
          await octokit.request(`PUT /repos/${owner}/${repo}/contents/${path}`, {
            branch: payload.pull_request.head.ref,
            message: `Add test for ${filename}.`,
            committer: {
              name: 'Lautaro Gruss',
              email: 'lautapercuspain@gmail.com',
            },
            content: btoa(
              completion.choices[0].message.content
              // prediction.replace('```', '').replace('javascript', '').replace('jsx', '').replace('```', '')
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
    }
  })
}
