import OpenAI from 'openai'
import { getChangedFiles } from './utils'

// import { Octokit } from '@octokit/core'
// import { createAppAuth } from '@octokit/auth-app'
const messageForNewPRs = "We're analyzing..."

export async function handlePullRequestOpened({ payload, octokit, openai }) {
  // let fileRes
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

  // console.log(`Branch Name:`, payload.pull_request.head.ref)

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
      console.log('rawUrl:', rawUrl)

      relativePath = file.filename.split('/').slice(0, -1).join('/')
      const lastPart = file.filename.split('/').pop()
      const [fname, ext] = lastPart.split('.')
      filename = fname
      extension = ext
    })

    const fileRes = await fetch(rawUrl)
    if (!fileRes.ok) {
      throw new Error('Error fetching data from the API')
    }
    fileContents = await fileRes.text()

    // console.log('File contents:', fileContents)
  })

  const payloadOpenAI: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: [
      {
        role: 'system',
        content: `You are an expert software agent in unit test.
              Please follow these guilines:
              - Always pass all the props that the component in expecting in all tests.
              - Consistently presume that the component to be tested resides within the identical directory as the generated test.
              - Don't use getByTestId if the passed component don't support it.
              - Always use the waitFor method from the testing-library/react package, and don't forget to import that in the testing code.
              - Try to use the getByRole method, if target element is a generic role, other wise use the getByText method to find elements when you see fit.
                Examples: Given the following html: <a href="/about">About</a>, if could do this inside a test:
                import {render, screen} from '@testing-library/react'
                render(<MyComponent />)
                const aboutAnchorNode = screen.getByText(/about/i, {exact: false}). // Use the i or the second argument with exact equal to false to make it more flexible to find the element.
                // Or use a custom function: screen.getByText((content, element) => content.startsWith('Hello'))
              - Make sure to avoid this error in tests: Matcher error: received value must be a mock or spy function.
                Use mock functions in tests, for example, use the jest.spyOn to create a mock for clearInterval on the window object.
                For the case of clearInterval, it would be something like this: const clearIntervalMock = jest.spyOn(window, 'clearInterval');
              - Always use fireEvent instead of userEvent i.e: fireEvent.change(input, { target: { value: newValue }});
              - Avoid using the rerender method to test that some state changes, intead use the mentioned fireEvent method to do that.
              - It's important to ensure that each test case starts with a clean and isolated state.
              - Ensure that each test is isolated from the others. One test's behavior shouldn't affect another test's outcome.
              - If you use the act method, don't forget to import it from the react testing library lib.
              - To implment clean up after each test you could use, cleanup from react testing library in conjuntion with the afterEach method.
              `,
      },
      {
        role: 'user',
        content: `
              Create at least three unit tests, using the following libs: ${depList}, for the following code: ${fileContents}.
              But don't add explanations or triple backtick to the output.`,
      },
    ],
    model: 'gpt-4',
    temperature: 0.9,
  }

  // console.log('payloadOpenAI:', payloadOpenAI)

  const completion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(payloadOpenAI)

  console.log('completion:', completion)

  if (completion) {
    try {
      await octokit.request(`POST /repos/${owner}/${repo}/issues/${pullRequestNumber}/comments`, {
        body: `A test has been generated for the filename: ${filename}`,
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
}
