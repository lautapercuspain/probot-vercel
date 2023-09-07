import OpenAI from 'openai'

const openAIKey = process.env.OPENAI_API_KEY

// console.log('openAIKey:', openAIKey)

const openai = new OpenAI({
  apiKey: openAIKey,
})

export async function generateSuggestion(context, depList) {
  console.log('Generating suggestions:')

  const completion = await openai.chat.completions.create({
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
          Create at least three unit tests, using the following libs: ${depList}, for the following code: ${context}.
          But don't add explanations or triple backtick to the output.`,
      },
    ],
    model: 'gpt-4',
    temperature: 0.9,
  })
  return completion.choices
}

// These are the dependencies for this file.
export const getChangedFiles = async ({ owner, repo, pullRequestNumber, octokit }) => {
  try {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
    })

    const changedFiles = response.data.map((file) => {
      return {
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        blobUrl: file.blob_url,
      }
    })

    return changedFiles
  } catch (error) {
    console.error('Error fetching changed files:', error)
    return []
  }
}
