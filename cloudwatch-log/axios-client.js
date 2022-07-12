const axios = require('axios').default

module.exports = axios.create({ validityStates: (status) => status >= 200 && status < 600 })
