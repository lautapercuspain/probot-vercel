import OpenAI from 'openai'
import { getChangedFiles } from './utils'

// import { Octokit } from '@octokit/core'
// import { createAppAuth } from '@octokit/auth-app'
const messageForNewPRs = `The files' contents are under analysis for test generation.`

export async function handlePullRequestOpened({ context, payload, octokit, openai }) {
  // let fileRes
  let rawUrl: string
  let payloadOpenAI: OpenAI.Chat.ChatCompletionCreateParams
  let relativePath: string
  let fileContents: string
  let filename: string
  let extension: string
  let depList: string = 'Jest, React Testing Library'

  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const pullRequestNumber = payload.pull_request.number

  await context.octokit.issues.createComment(context.issue({ body: messageForNewPRs }))

  // console.log(`Branch Name:`, payload.pull_request.head.ref)

  //Get the contents of package json.
  await octokit.rest.repos
    .getContent({
      owner,
      repo,
      path: 'package.json',
    })
    .then((response) => {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      // console.log('content:', content)

      // Parse the package.json content
      const dependencies = JSON.parse(content).devDependencies
      //Get the keys, A.k.A: The lib names.
      depList = Object.keys(dependencies).join(', ')
    })
    .catch((error) => {
      console.error(error)
    })

  // console.log('depList:', depList)

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

    const fileRes = await fetch(rawUrl)
    if (!fileRes.ok) {
      throw new Error('Error fetching data from the API')
    }
    await fileRes.text().then(async (contents) => {
      // console.log('contents:', contents)
      fileContents = contents
      let payloadB = (payloadOpenAI = {
        messages: [
          {
            role: 'system',
            content: `You are an expert software agent in unit test.
                Follow these guilines to the letter:
                - Output code only.
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
                Create at least one unit test, using the following libs: ${depList}, for the following code: ${fileContents}.`,
          },
        ],
        model: 'gpt-4',
        temperature: 0.9,
      })
      const completion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(payloadB)

      //Ensure we aren't creating a test for a test itself.
      const path = `${relativePath}/${filename.toLowerCase()}.demo.${extension}`

      await context.octokit.repos.createOrUpdateFileContents({
        repo,
        owner,
        path, // the path to your config file
        message: `Test added for filename: ${filename}.`,
        // content: Buffer.from('My new file is awesome!').toString('base64'),
        content: Buffer.from(completion.choices[0].message.content).toString('base64'),
        // the content of your file, must be base64 encoded
        branch: payload.pull_request.head.ref, // the branch name we used when creating a Git reference
      })
      await context.octokit.issues.createComment(
        context.issue({ body: `A demo test has been generated for the filename: ${filename}` })
      )
    })

    // console.log('File contents:', fileContents)

    payloadOpenAI = {
      messages: [
        {
          role: 'system',
          content: `You are an expert software agent in unit test.
              Follow these guilines to the letter:
              - Output code only.
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
              Create at least one unit test, using the following libs: ${depList}, for the following code: ${fileContents}.`,
        },
      ],
      model: 'gpt-4',
      temperature: 0.9,
    }

    const completion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(payloadOpenAI)

    //Ensure we aren't creating a test for a test itself.
    const path = `${relativePath}/${filename.toLowerCase()}.test.${extension}`

    // create a new file
    await context.octokit.repos.createOrUpdateFileContents({
      repo,
      owner,
      path, // the path to your config file
      message: `Test added for filename: ${filename}.`,
      // content: Buffer.from('My new file is awesome!').toString('base64'),
      content: Buffer.from(completion.choices[0].message.content).toString('base64'),
      // the content of your file, must be base64 encoded
      branch: payload.pull_request.head.ref, // the branch name we used when creating a Git reference
    })
    await context.octokit.issues.createComment(
      context.issue({ body: `A test has been generated for the filename: ${filename}` })
    )
  })
}
