# Probot & Open AI App

This repository is using [Probot](https://probot.github.io/) and the Open AI API

# Create your Open AI key

You can go [here](https://platform.openai.com/api-keys/) to generate your Open AI key.

## Local setup

Install dependencies

```
yarn install
```

Build the project

```
yarn run build
```

Start the server

```
yarn start
```

Follow the instructions to register a new GitHub app.

## Deployment

The app is continuously deployed using [Vercel's GitHub app](https://github.com/apps/vercel).

### Considerations

- Make sure you configure [the environment variables for your GitHub App](https://probot.github.io/docs/configuration/)

- Vercel [expects to find your lambda functions under `/api` folder](<[url](https://vercel.com/docs/concepts/functions/serverless-functions#deploying-serverless-functions)>). Make sure your functions are placed there and double check Vercel detected your Lambda Functions during the deployment process by checking the logs:

![image](https://user-images.githubusercontent.com/2574275/187179364-b0019f95-be41-462a-97d5-facf4de39095.png)

## How it works

The [api/github/webhooks/index.js](api/github/webhooks/index.js) file is handling requests to `POST /api/github/webhooks`, make sure to configure your GitHub App registration's webhook URL accordingly.

## License

[ISC](LICENSE)
