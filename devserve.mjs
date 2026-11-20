import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), 'dist')
const types = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}
createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': '*',
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end()
    return
  }
  const file = path.slice(1)
  console.log(new Date().toISOString().slice(11, 19), req.method, path, '->', file)
  if (!/^[\w][\w.-]*$/.test(file)) {
    res.writeHead(404).end('not found')
    return
  }
  try {
    const body = await readFile(join(dist, file))
    res.writeHead(200, { ...cors, 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(3000, '127.0.0.1', () => {
  console.log('lunajam dev store on http://127.0.0.1:3000')
})
