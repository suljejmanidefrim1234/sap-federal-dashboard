import {readFile,writeFile} from 'node:fs/promises';
// Vite has already bundled all JS dependencies and snapshot data. Inline the assets
// so the private download can be opened directly from disk without a web server.
let html=await readFile('dist/index.html','utf8');
const script=html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/);
const css=html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/);
if(!script||!css)throw new Error('Expected bundled Vite assets were not found.');
const local=url=>'dist/'+url.split('/').slice(-2).join('/');
const javascript=await readFile(local(script[1]),'utf8');
const stylesheet=await readFile(local(css[1]),'utf8');
html=html.replace(script[0],()=>'<script type="module">'+javascript.replace(/<\/script/gi,'<\/script')+'</script>');
html=html.replace(css[0],()=>'<style>'+stylesheet+'</style>');
await writeFile('dist/dashboard.html',html);
console.log('Standalone private dashboard: dist/dashboard.html');
