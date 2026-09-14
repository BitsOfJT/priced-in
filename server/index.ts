import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import { createApp } from './app.js'

const app = createApp()
const dist = join(process.cwd(), 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.use((_request, response) => response.sendFile(join(dist, 'index.html')))
}
const serverPort = 8787
app.listen(serverPort, '127.0.0.1', () => console.log(`Priced In API listening at http://127.0.0.1:${serverPort}`))
