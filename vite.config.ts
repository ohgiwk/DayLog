import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const buildId = crypto.randomUUID()
export default defineConfig({
 plugins: [vue(), {
  name: 'app-version',
  generateBundle() {
   this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId }) })
  },
 }],
 define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
 server: { port: 5176 }, test: { environment: 'node' },
})
