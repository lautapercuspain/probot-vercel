import { createNodeMiddleware, createProbot } from 'probot'
import app from './app'

export const config = {
  runtime: 'edge',
}

const probot = createProbot()

export default createNodeMiddleware(app, {
  probot,
  webhooksPath: '/api/github/webhooks',
})
