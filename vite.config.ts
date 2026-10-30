import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { offlinePlugin } from './scripts/offline-plugin'
import { releaseDate } from './src/lib/app-version'
const buildId = crypto.randomUUID()
const releasedAt = releaseDate(process.env.APP_RELEASE_DATE)
export default defineConfig({
 plugins: [vue(), offlinePlugin(buildId), {
  name: 'app-version',
  generateBundle() {
   this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId, releasedAt }) })
  },
 }],
 define: { __APP_BUILD_ID__: JSON.stringify(buildId), __APP_RELEASE_DATE__: JSON.stringify(releasedAt) },
 server: { port: 5176 }, test: { environment: 'node' },
})
