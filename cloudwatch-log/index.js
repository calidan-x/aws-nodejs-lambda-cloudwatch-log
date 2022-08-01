#!/usr/bin/env node
const { register, next } = require('./extensions-api')
const { subscribe } = require('./logs-api')
const { listen } = require('./http-listener')
const {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand
} = require('@aws-sdk/client-cloudwatch-logs')

const client = new CloudWatchLogsClient({ region: 'ap-northeast-1' })

const EventType = {
  INVOKE: 'INVOKE',
  SHUTDOWN: 'SHUTDOWN'
}

function handleShutdown(event) {
  console.log('shutdown', { event })
  process.exit(0)
}

function handleInvoke(event) {}

const LOCAL_DEBUGGING_IP = '0.0.0.0'
const RECEIVER_NAME = 'sandbox'

async function receiverAddress() {
  return process.env.AWS_SAM_LOCAL === 'true' ? LOCAL_DEBUGGING_IP : RECEIVER_NAME
}

const FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME

// Subscribe to platform logs and receive them on ${local_ip}:4243 via HTTP protocol.
const RECEIVER_PORT = 4243
const TIMEOUT_MS = 1000 // Maximum time (in milliseconds) that a batch is buffered.
const MAX_BYTES = 262144 // Maximum size in bytes that the logs are buffered in memory.
const MAX_ITEMS = 10000 // Maximum number of events that are buffered in memory.

const SUBSCRIPTION_BODY = {
  destination: {
    protocol: 'HTTP',
    URI: `http://${RECEIVER_NAME}:${RECEIVER_PORT}`
  },
  types: ['platform', 'function'],
  buffering: {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    maxItems: MAX_ITEMS
  }
}

const getLogStreamName = () => {
  const addZero = (n) => {
    if (n < 10) {
      return '0' + n
    }
    return n
  }
  const d = new Date()
  d.setHours(d.getHours() + 9)
  return d.getFullYear() + '-' + addZero(d.getMonth() + 1) + '-' + addZero(d.getDate()) + ' / ' + addZero(d.getHours())
}

;(async function main() {
  process.on('SIGINT', () => handleShutdown('SIGINT'))
  process.on('SIGTERM', () => handleShutdown('SIGTERM'))

  // register
  const extensionId = await register()

  // listen returns `logsQueue`, a mutable array that collects logs received from Logs API
  const { logsQueue, server } = listen(await receiverAddress(), RECEIVER_PORT)

  // subscribing listener to the Logs API
  await subscribe(extensionId, SUBSCRIPTION_BODY, server)

  const LogStreamToken = {}

  // function for processing collected logs
  async function uploadLogs() {
    const logStreamName = getLogStreamName()

    if (!LogStreamToken[logStreamName]) {
      const createLogStreamCmd = new CreateLogStreamCommand({ logGroupName: FUNCTION_NAME, logStreamName })
      try {
        await client.send(createLogStreamCmd)
        LogStreamToken[logStreamName] = ''
      } catch (err) {
        const describeLogStreamsCommand = new DescribeLogStreamsCommand({
          logGroupName: FUNCTION_NAME,
          logStreamNamePrefix: logStreamName
        })
        const res = await client.send(describeLogStreamsCommand)
        res.logStreams.forEach((r) => {
          if (r.logStreamName === logStreamName) {
            LogStreamToken[logStreamName] = r.uploadSequenceToken
          }
        })
      }
    }

    const recordLogCommand = {
      logGroupName: FUNCTION_NAME,
      logStreamName,
      logEvents: []
    }

    while (logsQueue.length > 0) {
      logsQueue.forEach((log) => {
        if (log.type === 'function') {
          const record = log.record.split('\t')
          recordLogCommand.logEvents.push({ message: record[3], timestamp: new Date(record[0]).getTime() })
        }
      })
      logsQueue.splice(0)
    }

    try {
      if (recordLogCommand.logEvents.length > 0) {
        if (LogStreamToken[logStreamName]) {
          recordLogCommand['sequenceToken'] = LogStreamToken[logStreamName]
        }
        const res = await client.send(new PutLogEventsCommand(recordLogCommand))
        LogStreamToken[logStreamName] = res.nextSequenceToken
      }
    } catch (err) {
      if (err.expectedSequenceToken) {
        try {
          recordLogCommand['sequenceToken'] = err.expectedSequenceToken
          const res = await client.send(new PutLogEventsCommand(recordLogCommand))
          LogStreamToken[logStreamName] = res.nextSequenceToken
        } catch (e) {
          console.log(e)
        }
      }
    }
  }

  // execute extensions logic
  while (true) {
    const event = await next(extensionId)

    switch (event.eventType) {
      case EventType.SHUTDOWN:
        await uploadLogs() // upload remaining logs, during shutdown event
        handleShutdown(event)
        break
      case EventType.INVOKE:
        handleInvoke(event)
        await uploadLogs() // upload queued logs, during invoke event
        break
      default:
        break
    }
  }
})()
