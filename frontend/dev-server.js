import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.FRONTEND_PORT || 3001);
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.mp4':'video/mp4','.xml':'application/xml','.txt':'text/plain','.json':'application/json'};
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let relative=pathname==='/'?'index.html':pathname.slice(1);
    if (!path.extname(relative) && !relative.endsWith('/')) relative += '.html';
    const file=path.resolve(root,relative);
    if (!file.startsWith(root) || relative.split(/[\\/]/).some(p=>p.startsWith('.')) || !types[path.extname(file)] || ['dev-server.js'].includes(relative)) {res.writeHead(404);return res.end('Not found');}
    if(path.extname(file)==='.mp4'){
      const {size}=await stat(file);let start=0,end=size-1,status=200;
      const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'};
      if(req.headers.range){const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
        if(!range[1])start=Math.max(0,size-Number(range[2]));else{start=Number(range[1]);if(range[2])end=Math.min(Number(range[2]),size-1);}
        if(start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
      }
      headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());return stream.pipe(res);
    }
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':`${types[path.extname(file)]}${/\.(html|js|css)$/.test(file)?'; charset=utf-8':''}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' https://api.mapbox.com/mapbox-gl-js/ 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://api.mapbox.com/mapbox-gl-js/; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 https://api.mapbox.com https://events.mapbox.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`RKR TOUR frontend: http://localhost:${port}`));

