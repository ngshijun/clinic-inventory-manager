import { httpRouter } from 'convex/server'
import { webhook } from './telegram'

const http = httpRouter()

http.route({ path: '/telegram', method: 'POST', handler: webhook })

export default http
