import type { Probot, Context, ApplicationFunctionOptions } from 'probot'
import express from 'express'
import bodyParser from 'body-parser'
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing env var from OpenAI')
}

const openAIKey = process.env.OPENAI_API_KEY

//   //auth

import { handlePullRequestOpened } from './lib/core'

/**
 * @param {import('probot').Probot} app
 */
export default (app: Probot, { getRouter }: ApplicationFunctionOptions) => {
  if (!getRouter) return
  const router = getRouter('/')
  //Middlewares
  // router.use(bodyParser.urlencoded({ extended: true }))
  router.use(express.json())
  router.use(express.urlencoded())
  // Add a new route
  router.post('/api/generate', async (req, res) => {
    const { payload } = req.body

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIKey ?? ''}`,
      },
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    // console.log('data:', data)

    return res.send(data.choices[0].message.content)
  })

  app.on(['pull_request.opened', 'pull_request.reopened'], async (context: Context) => {
    return handlePullRequestOpened({
      payload: context.payload,
      octokit: context.octokit,
    })
    // return context.octokit.issues.createComment(context.issue({ body: 'Hello, World!' }))
  })

  // This logs any errors that occur.
  app.webhooks.onError((error) => {
    if (error.name === 'AggregateError') {
      console.error(`Error processing request: ${error.event}`)
    } else {
      console.error(error)
    }
  })
}
