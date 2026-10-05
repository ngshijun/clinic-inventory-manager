import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// 08:00 at the clinic: cron times are UTC and Malaysia is UTC+8 all year
crons.cron('morning summary', '0 0 * * *', internal.summary.sendMorning, {})

export default crons
