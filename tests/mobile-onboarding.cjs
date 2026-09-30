const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#39);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[x]));
let document,scrollCalls=[];
class Element{
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.parentElement=null;this.listeners={};this.style={setProperty(k,v){this[k]=v}};this.value='';this.scrollTop=0;this.scrollLeft=0;this.clientWidth=600;this.clientHeight=300;this.scrollHeight=2000;this.readOnly=false;this.rect=null;this._text='';this.dataset=new Proxy({},{get:(_,k)=>this.attrs['data-'+k],set:(_,k,v)=>(this.attrs['data-'+k]=v,true)});this.classList={toggle:(s,force)=>{const list=new Set(this.className.split(/\s+/).filter(Boolean));const add=force??!list.has(s);if(add)list.add(s);else list.delete(s);this.className=[...list].join(' ');return add},contains:s=>this.className.split(/\s+/).includes(s),add:s=>this.classList.toggle(s,true),remove:s=>this.classList.toggle(s,false)};}
 get id(){return this.attrs.id||''} get className(){return this.attrs.class||''}set className(v){this.attrs.class=v}
 get hidden(){return 'hidden' in this.attrs}set hidden(v){if(v)this.attrs.hidden='';else delete this.attrs.hidden}
 get disabled(){return 'disabled' in this.attrs}set disabled(v){if(v)this.attrs.disabled='';else delete this.attrs.disabled}
 get open(){return 'open' in this.attrs}set open(v){if(v)this.attrs.open='';else delete this.attrs.open}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}set textContent(v){this.children=[];this._text=String(v)}
 set innerHTML(v){this._html=v;this.children=[];this._text='';parse(v,this)}get innerHTML(){return this._html||this._text}
 append(...nodes){for(let n of nodes){if(typeof n==='string'){this._text+=n;continue}n.parentElement=this;this.children.push(n)}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this)}
 setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}removeAttribute(k){delete this.attrs[k]}
 matches(selector){const tag=selector.match(/^[a-z][\w-]*/i)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;const id=selector.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;for(const x of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(x[1]))return false;for(const x of selector.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/g)){if(!(x[1] in this.attrs))return false;if(x[2]!==undefined&&this.attrs[x[1]]!==x[2])return false}return true}
 querySelectorAll(selector){const parts=selector.trim().split(/\s+/);let result=[];const walk=n=>{for(const child of n.children){if(child.matches(parts.at(-1))){let p=child.parentElement,i=parts.length-2;while(p&&i>=0){if(p.matches(parts[i]))i--;p=p.parentElement}if(i<0)result.push(child)}walk(child)}};walk(this);return result}
 querySelector(s){return this.querySelectorAll(s)[0]||null}closest(s){let p=this;while(p){if(p.matches(s))return p;p=p.parentElement}return null}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}dispatchEvent(e){e.target=this;for(const fn of this.listeners[e.type]||[])fn(e);if(this['on'+e.type])this['on'+e.type](e)}
 click(){if(!this.disabled)this.onclick?.({target:this,currentTarget:this,stopPropagation(){},preventDefault(){}})}
 contains(node){while(node){if(node===this)return true;node=node.parentElement}return false}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end}
 blur(){document.activeElement=document.body} focus(){document.activeElement=this}scrollIntoView(opts){scrollCalls.push({id:this.id,opts})}scrollTo(opts){this.scrollTop=Math.max(0,Math.min(opts.top??0,this.scrollHeight-this.clientHeight));this.dispatchEvent({type:'scroll'})}
 get offsetHeight(){return this.rect?.height||80}get offsetTop(){return this.parentElement?this.parentElement.children.indexOf(this)*44:0}get offsetLeft(){return 0}
 getBoundingClientRect(){return typeof this.rect==='function'?this.rect():this.rect||{top:30,bottom:60,left:24,right:324,width:300,height:30}}
 showModal(){this.open=true}close(){this.open=false;this.dispatchEvent({type:'close'})}setPointerCapture(){}
 setRangeText(text,start,end,mode){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length}
}
function parse(html,root){const stack=[root];for(const m of html.matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)){const token=m[0];if(token.startsWith('<!--'))continue;if(token.startsWith('</')){if(stack.length>1)stack.pop();continue}if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};const body=token.slice(tag.length+1,-1);for(const a of body.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const e=new Element(tag,attrs);stack.at(-1).append(e);if(!['br','hr','input','meta','link','img','path','progress'].includes(tag)&&!token.endsWith('/>'))stack.push(e)}else stack.at(-1)._text+=decode(token)}}
const source=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
document=new Element('document');document.documentElement=new Element('html');document.body=new Element('body');document.append(document.documentElement);document.documentElement.append(document.body);document.getElementById=id=>document.querySelector('#'+id);document.createElement=tag=>new Element(tag);document.activeElement=document.body;
parse(source.slice(source.indexOf('<body>')+6,source.indexOf('<!-- sql.js license')),document.body);
let workerSource;const memory=new Map();memory.set('ux-sql-lab.state.v2',JSON.stringify({position:[0,0,0],drafts:{'0.0.0':'-- previously saved draft'},onboardingVersion:0}));
class Worker{
 constructor(){const {Worker:Thread}=require('worker_threads');this.thread=new Thread(`const {parentPort,workerData}=require('worker_threads');const vm=require('vm');const c=vm.createContext({console,setTimeout,clearTimeout,performance,TextDecoder,TextEncoder,atob,btoa,postMessage:data=>parentPort.postMessage(data)});vm.runInContext(workerData,c);parentPort.on('message',data=>{c.payload=data;vm.runInContext('onmessage({data:payload})',c).catch(e=>parentPort.postMessage({error:e.message}))});`,{eval:true,workerData:workerSource});this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',e=>this.onerror?.(e))}
 postMessage(data){this.thread.postMessage(data)}terminate(){this.thread.terminate()}
}
const spoken=[];let canceled=0;const fakeSpeech={getVoices:()=>[{name:'Default Korean',lang:'ko-KR',default:true,localService:true},{name:'Yuna',lang:'ko-KR',default:false,localService:true},{name:'English',lang:'en-US',default:false}],cancel(){canceled++},speak(u){spoken.push(u)}};
const raf=fn=>setTimeout(fn,0);
const ctx=vm.createContext({document,console,speechSynthesis:fakeSpeech,SpeechSynthesisUtterance:class{constructor(text){this.text=text}},innerWidth:Number(process.env.TEST_WIDTH)||1440,innerHeight:781,scrollBy(){},performance,setTimeout,clearTimeout,requestAnimationFrame:raf,cancelAnimationFrame:clearTimeout,ResizeObserver:class{observe(){}},matchMedia:q=>({matches:q.includes('min-width')&&(Number(process.env.TEST_WIDTH)||1440)>700}),localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},Blob:class{constructor(parts){this.text=parts.join('')}},URL:{createObjectURL:b=>(workerSource=b.text,'worker:sql')},Worker,addEventListener(){},getComputedStyle:()=>({lineHeight:'25.9px'}),AbortController});
const run=code=>vm.runInContext(code,ctx);const $=id=>document.getElementById(id);const tick=()=>new Promise(r=>setTimeout(r,5));
const event=(type,target,extra={})=>({type,target,prevented:false,stopped:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra});
function captured(e){for(const fn of document.listeners[e.type]||[]){fn(e);if(e.stopped)break}return e}
async function userClick(id){const el=typeof id==='string'?$(id):id;const e=captured(event('click',el));if(!e.prevented)el.click();await tick();return e}
async function inputChar(ch){const ed=$('editor'),e=captured(event('beforeinput',ed,{inputType:ch==='\n'?'insertLineBreak':'insertText',data:ch}));if(!e.prevented){ed.setRangeText(ch,ed.selectionStart??ed.value.length,ed.selectionEnd??ed.value.length);const ie=captured(event('input',ed));if(!ie.stopped)for(const f of ed.listeners.input||[])f(ie)}await tick();return e}
async function fillStep(){const expected=run('tourStep().expected');const rest=expected.slice($('editor').value.length);for(const ch of rest){const e=await inputChar(ch);assert.equal(e.prevented,false,`Expected ${ch} to be accepted`)}}
async function waitExecution(){for(let i=0;i<400&&run('busy');i++)await tick();assert.equal(run('busy'),false);await tick()}
const step=()=>run('tourStep().id');

(async()=>{
 run('globalThis.window=globalThis');run(script);await tick();await tick();
 // Test against the actual mobile viewport with keyboard closed/open/panned.
 run("onboarding.index=7;enterTourStep()");await tick();
 assert.equal(step(),'write-error');assert.equal(run('tourStep().target'),'#editor');
 assert.equal(document.body.classList.contains('tour-workspace-step'),true);
 for(const width of [320,390,412])for(const height of [300,430,740])for(const offset of [0,120]){
   run(`innerWidth=${width};innerHeight=844;window.visualViewport={offsetLeft:0,offsetTop:${offset},width:${width},height:${height}}`);
   $('editor').rect={left:18,top:offset+16,right:width-18,bottom:offset+316,width:width-36,height:300};
   $('tourBubble').rect=()=>{const h=Math.min(290,parseFloat($('tourBubble').style.maxHeight)||290);return {left:12,top:0,width:width-24,height:h,right:width-12,bottom:h}};
   run('positionTour()');
   const spot=$('tourSpot').style,b=$('tourBubble').style;
   assert.equal(parseFloat(spot.top),offset+10);assert.equal(parseFloat(spot.height),88);
   assert.ok(parseFloat(b.top)>=offset+16+76+6,'bubble must not cover typing region');
   assert.ok(parseFloat(b.top)+$('tourBubble').getBoundingClientRect().height<=offset+height,'bubble above keyboard');
 }
 await fillStep();assert.equal(step(),'run-error');
 assert.equal(run('tourStep().target'),'#run');assert.notEqual(document.activeElement,$('editor'));
 $('run').rect={left:30,top:140,right:78,bottom:180,width:48,height:40};
 run('positionTour()');assert.equal(parseFloat($('tourSpot').style.top),134);
 assert.equal(parseFloat($('tourSpot').style.left),24);
 const b=$('tourBubble').style;assert.ok(parseFloat(b.top)>=186);
 await userClick('run');await waitExecution();assert.equal(step(),'error-result');
 assert.match($('resultPanel').textContent,/user/);
 $('resultPanel').rect={left:18,top:120,right:372,bottom:920,width:354,height:800};
 run('positionTour()');
 assert.equal(parseFloat($('tourSpot').style.height),812);
 assert.ok(parseFloat($('tourBubble').style.top)+$('tourBubble').getBoundingClientRect().height<=860,'Next remains above viewport bottom');
 // A target scrolled behind browser chrome must be brought back into view.
 run('onboarding.index=7;window.scrollBy=opts=>{globalThis.lastTourScroll=opts.top}');
 $('editor').rect={left:18,top:20,right:372,bottom:320,width:354,height:300};
 run('revealTourTarget()');assert.equal(run('lastTourScroll'),-116);

 console.log('PASS: 18 mobile keyboard/viewport combinations; step 8 input → step 9 run → step 10 error result; real SQL Worker.');
})().catch(e=>{console.error(e);process.exitCode=1});
