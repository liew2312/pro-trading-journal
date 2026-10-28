const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/capture-cleanup.js'),'utf8');
function element(options={}) {
    return Object.assign({id:'',className:'',textContent:'',position:'static',width:48,height:48,attrs:{},parentElement:null,
        getAttribute(name){return this.attrs[name]||null;},setAttribute(name,value){this.attrs[name]=value;},removeAttribute(name){delete this.attrs[name];},
        getBoundingClientRect(){return {width:this.width,height:this.height};},
        querySelector(){return null;},matches(){return false;}
    },options);
}
function fixture(elements,host='another-reader.example'){
    let style=null;
    const doc={getElementById:()=>style,createElement:()=>({remove(){style=null;}}),
        querySelectorAll:selector=>selector.startsWith('[data-')?elements.filter(el=>el.attrs['data-manga-capture-hide']):elements,
        head:{appendChild(el){style=el;}}};
    const context={document:doc,location:{hostname:host},getComputedStyle:el=>({position:el.position})};context.window=context;
    vm.createContext(context);vm.runInContext(source,context);return context.MangaCaptureClean;
}
test('hides a floating back-to-top arrow on another website and restores it',()=>{
    const arrow=element({id:'back_to_top',position:'fixed'}),clean=fixture([arrow]);
    clean.setEnabled(true);assert.equal(arrow.attrs['data-manga-capture-hide'],'1');
    clean.setEnabled(false);assert.equal(arrow.attrs['data-manga-capture-hide'],undefined);
});
test('recognizes an unnamed arrow inside a small floating parent',()=>{
    const parent=element({position:'fixed'}),arrow=element({textContent:'↑',parentElement:parent});
    fixture([arrow,parent]).setEnabled(true);assert.equal(parent.attrs['data-manga-capture-hide'],'1');
});
test('does not hide static story text, large reader containers or manga images',()=>{
    const text=element({textContent:'↑'}),large=element({id:'back-to-top',position:'fixed',width:800,height:1200}),image=element({className:'scroll-up',position:'fixed',matches:()=>true});
    fixture([text,large,image]).setEnabled(true);
    for(const el of [text,large,image])assert.equal(el.attrs['data-manga-capture-hide'],undefined);
});
test('finds a control created after capture has already begun',()=>{
    const elements=[],clean=fixture(elements);clean.setEnabled(true);
    const arrow=element({id:'goTop',position:'fixed'});elements.push(arrow);
    clean.setEnabled(true);assert.equal(arrow.attrs['data-manga-capture-hide'],'1');
});
