import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import {fileURLToPath,URL} from 'node:url';
const fallback=()=>({name:'academy-routes',configureServer(s){s.middlewares.use((req,res,next)=>{if(/^\/(admin|learn|course|certificate)(?:\/|\?|$)/.test(req.url||''))req.url='/index.html';next();});}});
export default defineConfig({plugins:[react(),fallback()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},server:{host:'127.0.0.1',port:3004,strictPort:true,proxy:{'/api':'http://127.0.0.1:3014'}}});
