import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
const adminFallback=()=>({name:'admin-fallback',configureServer(server){server.middlewares.use((req,res,next)=>{if(/^\/admin(?:\/|$)/.test((req.url||'').split('?')[0]))req.url='/admin.html';next();});},configurePreviewServer(server){server.middlewares.use((req,res,next)=>{if(/^\/admin(?:\/|$)/.test((req.url||'').split('?')[0]))req.url='/admin.html';next();});}});
export default defineConfig({plugins:[react(),adminFallback()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},build:{rollupOptions:{input:{booking:'index.html',admin:'admin.html'}}},server:{host:'127.0.0.1',port:3002,strictPort:true,proxy:{'/api':'http://127.0.0.1:3003'}}});
