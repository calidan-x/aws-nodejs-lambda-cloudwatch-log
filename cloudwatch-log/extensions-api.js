// @ts-check
const axios = require('./axios-client.js')
const { basename } = require('path')

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`

async function register() {
  const res = await axios.post(
    `${baseUrl}/register`,
    {
      events: ['INVOKE', 'SHUTDOWN']
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Lambda-Extension-Name': basename(__dirname)
      }
    }
  )
  if (res.status === 200) {
    return res.headers['lambda-extension-identifier']
  } else {
    return null
  }
}

async function next(extensionId) {
  try {
    const res = await axios.get(`${baseUrl}/event/next`, {
      headers: {
        'Content-Type': 'application/json',
        'Lambda-Extension-Identifier': extensionId
      }
    })

    return res.data
  } catch (error) {
    console.error('next failed', error.response.data)
    return null
  }
}

module.exports = {
  register,
  next
}
