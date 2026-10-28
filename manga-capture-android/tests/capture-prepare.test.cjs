const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/capture-prepare.js'),'utf8');
function fixture(readerImages,otherImages=[]){
    const context={document:{images:otherImages,documentElement:{scrollHeight:5000},querySelector:()=>readerImages?{querySelectorAll:()=>readerImages}:null},getComputedStyle:el=>({display:el.hidden?'none':'block'})};
    context.window=context;vm.createContext(context);vm.runInContext(source,context);return context.MangaCapturePrepare;
}
function image(loaded,hidden=false){return {complete:loaded,naturalWidth:loaded?800:0,hidden,scrollIntoView(){this.visited=true;}};}
test('only counts manga images when a reader area exists',()=>{
    const helper=fixture([image(true),image(false)],[image(false)]);
    assert.deepEqual(JSON.parse(JSON.stringify(helper.snapshot())),{total:2,loaded:1,height:5000});
});
test('visits pending images to trigger lazy loading',()=>{
    const second=image(false),helper=fixture([image(true),second]);
    helper.focus(1);assert.equal(second.visited,true);
    second.complete=true;second.naturalWidth=800;assert.equal(helper.snapshot().loaded,2);
});
test('does not treat broken images as loaded',()=>{
    const broken=image(false);broken.complete=true;
    assert.equal(fixture([broken]).snapshot().loaded,0);
});
test('excludes hidden images and falls back outside known readers',()=>{
    assert.equal(fixture([image(true),image(false,true)]).snapshot().total,1);
    assert.equal(fixture(null,[image(true)]).snapshot().loaded,1);
});
