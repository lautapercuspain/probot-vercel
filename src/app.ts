import type { Probot, Context } from 'probot'
import { handlePullRequestOpened } from './lib/core'

/**
 * @param {import('probot').Probot} app
 */
export default (app: Probot) => {
  app.on(['pull_request.opened', 'pull_request.reopened'], async (context: Context) => {
    //auth
    handlePullRequestOpened({
      payload: context.payload,
    })
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
