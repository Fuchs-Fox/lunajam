import { pathToFileURL } from 'node:url'
import { loadConfig, type Config } from './config'
import { Hub } from './hub'
import { Rooms } from './rooms'

export async function startServer(cfg: Config): Promise<{ port: number; close(): Promise<void> }> {
  const hub = new Hub(cfg)
  const rooms = new Rooms(hub, cfg)
  hub.setHandler({
    onMessage: (cid, msg) => rooms.onMessage(cid, msg),
    onDisconnect: (cid) => rooms.onDisconnect(cid),
    resolveToken: (token) => rooms.resolveOrPromote(token),
  })
  const port = await hub.listen()
  return {
    port,
    close: async () => {
      rooms.stop()
      await hub.close()
    },
  }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  startServer(loadConfig())
    .then((s) => console.log(`lunajam server listening on port ${s.port}`))
    .catch((err) => {
      console.error(String(err))
      process.exit(1)
    })
}
