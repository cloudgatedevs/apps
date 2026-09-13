import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
const fallback=()=>({name:'admin-fallback',configureServer(s){s.middlewares.use((req,res,next)=>{if(/^\/admin(?:\/|$)/.test((req.url||'').split('?')[0]))req.url='/admin.html';next();});},configurePreviewServer(s){s.middlewares.use((req,res,next)=>{if(/^\/admin(?:\/|$)/.test((req.url||'').split('?')[0]))req.url='/admin.html';next();});}});
export default defineConfig({plugins:[react(),fallback()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},build:{rollupOptions:{input:{jobs:'index.html',admin:'admin.html'}}},server:{host:'127.0.0.1',port:3002,strictPort:true,proxy:{'/api':'http://127.0.0.1:3011'}}});
