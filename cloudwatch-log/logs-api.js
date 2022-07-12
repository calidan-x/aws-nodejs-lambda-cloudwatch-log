// @ts-check
const axios = require('./axios-client.js')
const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-08-15/logs`

async function subscribe(extensionId, subscriptionBody) {
  const res = await axios.put(baseUrl, subscriptionBody, {
    headers: {
      'Content-Type': 'application/json',
      'Lambda-Extension-Identifier': extensionId
    }
  })

  if (res.status === 200) {
    console.info('logs subscription ok: ', res.data)
  } else {
    console.error('logs subscription failed: ', res.data)
  }
}

module.exports = {
  subscribe
}
