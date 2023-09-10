import type { Probot, Context, ApplicationFunctionOptions } from 'probot'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI')
}

const openAIKey = process.env.OPENAI_API_KEY

const openai = new OpenAI({
  apiKey: openAIKey, // defaults to process.env["OPENAI_API_KEY"]
})

//   //auth

import { handlePullRequestOpened } from './lib/core'

/**
 * @param {import('probot').Probot} app
 */
export default (app: Probot) => {
  //Listen to pull requests events
  app.on(['pull_request.opened', 'pull_request.reopened'], async (context: Context) => {
    console.log('context.payload,', context.payload)

    return handlePullRequestOpened({
      context,
      openai,
      payload: context.payload,
      octokit: context.octokit,
    })
  })

  // This logs any errors that occur.
  // app.webhooks.onError((error) => {
  //   if (error.name === 'AggregateError') {
  //     console.error(`Error processing request: ${error.event}`)
  //   } else {
  //     console.error(error)
  //   }
  // })
}
