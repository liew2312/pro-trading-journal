package com.mangacapture.app;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;

public class MainActivity extends Activity {
    private WebView web;
    private LinearLayout controls;
    private TextView status;
    private Guide guide;
    private EditText address;
    private int start = -1, end = -1, left = 0, right = 0, oldY;
    private boolean busy, cancelled;
    private File pending;
    private PdfDocument pdf;
    private PdfDocument.Page page;
    private int cursor, pageNumber, pageHeight, activePageHeight, cropWidth;
    private float pageFill;
    private boolean longPageMode;
    private int warmPass;
    private String anchorScript;
    private String cleanupScript;
    private String filenameScript;
    private String pdfFilename="Manga.pdf";
    private boolean checkingUpdate;
    private static final String UPDATE_BASE = "https://raw.githubusercontent.com/liew2312/pro-trading-journal/main/manga-capture-android/downloads/";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private static final String SAMPLE = "https://www.go-manga.com/pig-slayer-%e0%b8%95%e0%b8%ad%e0%b8%99%e0%b8%97%e0%b8%b5%e0%b9%88-0/";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            anchorScript=loadScript("capture-anchors.js");cleanupScript=loadScript("capture-cleanup.js");filenameScript=loadScript("capture-filename.js");
        } catch(IOException e){throw new IllegalStateException("Missing selection helper",e);}
        WebView.enableSlowWholeDocumentDraw();
        getWindow().setStatusBarColor(Color.rgb(18, 32, 46));
        LinearLayout root = new LinearLayout(this); root.setOrientation(1); root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((v, insets) -> { v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        setContentView(root);
        controls = new LinearLayout(this); controls.setOrientation(1); root.addView(controls);
        LinearLayout heading=row(controls);
        TextView title = new TextView(this); title.setText("Manga Capture 0.7"); title.setTextSize(17); title.setPadding(16,8,16,4); heading.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        Button updateButton=new Button(this);updateButton.setText("อัปเดต");updateButton.setTextSize(12);heading.addView(updateButton);updateButton.setOnClickListener(v->{if(!busy)checkUpdate();});
        LinearLayout urlRow = row(controls);
        address = new EditText(this); address.setSingleLine(); address.setText(SAMPLE); address.setTextSize(12); urlRow.addView(address,new LinearLayout.LayoutParams(0,-2,1));
        button(urlRow,"เปิด", () -> open(address.getText().toString()));
        LinearLayout marks = row(controls);
        button(marks,"เริ่มตรงเส้น", () -> mark(true));
        button(marks,"จบตรงเส้น", () -> mark(false));
        button(marks,"ขอบภาพ", this::cropDialog);
        LinearLayout actions = row(controls);
        button(actions,"ดูตัวอย่าง", () -> resolveMarks(this::preview));
        button(actions,"บันทึก PDF", () -> resolveMarks(this::exportDialog));
        button(actions,"ยกเลิก", () -> cancelled=true);
        status = new TextView(this); status.setPadding(16,4,16,8); status.setTextSize(12); status.setLines(2); controls.addView(status);
        FrameLayout frame = new FrameLayout(this); root.addView(frame,new LinearLayout.LayoutParams(-1,0,1));
        web = new WebView(this); frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
        guide = new Guide(); frame.addView(guide,new FrameLayout.LayoutParams(-1,-1));
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (busy) return true;
                Uri uri=request.getUrl();
                if (!"https".equals(uri.getScheme())) { toast("รองรับเฉพาะลิงก์ HTTPS"); return true; }
                String host=uri.getHost();
                if (host != null && host.equals(Uri.parse(view.getUrl()).getHost())) return false;
                new AlertDialog.Builder(MainActivity.this).setMessage("เปิดเว็บใหม่: "+host+" ?").setPositiveButton("เปิด",(d,w)->open(uri.toString())).setNegativeButton("ยกเลิก",null).show();
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,Bitmap icon) { start=end=-1; update(); }
            @Override public void onPageFinished(WebView view,String url) { address.setText(url); update(); }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) { if(request.isForMainFrame()) status.setText("เปิดหน้าเว็บไม่ได้: "+error.getDescription()); }
        });
        web.setOnTouchListener((v,event)->busy);
        update(); open(SAMPLE);
    }
    private String loadScript(String name) throws IOException {
        try(InputStream stream=getAssets().open(name);ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
            byte[] buffer=new byte[4096];int n;while((n=stream.read(buffer))!=-1)bytes.write(buffer,0,n);return bytes.toString("UTF-8");
        }
    }
    private void setClean(boolean enabled,Runnable next){
        web.evaluateJavascript(cleanupScript+";window.MangaCaptureClean.setEnabled("+enabled+")",value->{if(next!=null)next.run();});
    }
    private LinearLayout row(LinearLayout parent) { LinearLayout r=new LinearLayout(this); parent.addView(r); return r; }
    private void button(LinearLayout row,String text,Runnable action) { Button b=new Button(this); b.setText(text); b.setTextSize(12); row.addView(b,new LinearLayout.LayoutParams(0,-2,1)); b.setOnClickListener(v->{ if(!busy || text.equals("ยกเลิก")) action.run(); }); }
    private void toast(String s) { Toast.makeText(this,s,Toast.LENGTH_LONG).show(); }
    private void checkUpdate() {
        if(checkingUpdate)return;
        checkingUpdate=true;toast("กำลังตรวจเวอร์ชันจาก GitHub…");
        new Thread(()-> {
            HttpsURLConnection connection=null;
            try {
                connection=(HttpsURLConnection)new URL(UPDATE_BASE+"latest.json?t="+System.currentTimeMillis()).openConnection();
                connection.setConnectTimeout(15000);connection.setReadTimeout(15000);connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept","application/json");
                if(connection.getResponseCode()!=200)throw new IOException("GitHub ตอบกลับ "+connection.getResponseCode());
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                try(InputStream stream=connection.getInputStream()) {
                    byte[] buffer=new byte[2048];int n;while((n=stream.read(buffer))!=-1){if(bytes.size()+n>16384)throw new IOException("ข้อมูลเวอร์ชันไม่ถูกต้อง");bytes.write(buffer,0,n);}
                }
                JSONObject release=new JSONObject(bytes.toString("UTF-8"));
                int code=release.getInt("versionCode");String name=release.getString("versionName"),apk=release.getString("apk");
                if(!name.matches("[0-9]+(\\.[0-9]+){1,3}")||!apk.equals("MangaCapture-v"+name+".apk"))throw new IOException("ข้อมูลไฟล์อัปเดตไม่ถูกต้อง");
                int installed=getPackageManager().getPackageInfo(getPackageName(),0).versionCode;
                runOnUiThread(()-> {
                    checkingUpdate=false;if(isFinishing()||isDestroyed())return;
                    if(code<=installed){toast("คุณใช้เวอร์ชันล่าสุดแล้ว");return;}
                    new AlertDialog.Builder(this).setTitle("มีเวอร์ชัน "+name).setMessage(release.optString("notes","")+"\n\nกดดาวน์โหลด แล้วเปิดไฟล์ APK เพื่ออัปเดตทับแอปเดิม โดยไม่ต้องถอนการติดตั้ง Android จะให้กดยืนยันอีกครั้ง")
                        .setPositiveButton("ดาวน์โหลด",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(UPDATE_BASE+apk)));}catch(ActivityNotFoundException e){toast("ไม่พบเบราว์เซอร์สำหรับดาวน์โหลด");}}).setNegativeButton("ภายหลัง",null).show();
                });
            } catch(Exception e){runOnUiThread(()->{checkingUpdate=false;if(!isFinishing()&&!isDestroyed())new AlertDialog.Builder(this).setTitle("ตรวจอัปเดตไม่ได้").setMessage("ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง\n"+e.getMessage()).setPositiveButton("ตกลง",null).show();});}
            finally{if(connection!=null)connection.disconnect();}
        },"manga-update-check").start();
    }
    private void showError(String message) {
        if(isFinishing()||isDestroyed())return;
        new AlertDialog.Builder(this).setTitle("บันทึกไม่สำเร็จ").setMessage(message).setPositiveButton("ตกลง",null).show();
    }
    private void mark(boolean first) {
        web.flingScroll(0,0);
        web.evaluateJavascript(anchorScript+";(()=>{try{return Math.round(window.MangaCaptureAnchors.mark('"+(first?"start":"end")+"')*"+web.getWidth()+"/innerWidth)}catch(e){return null}})()",value->{
            try { int position=Integer.parseInt(value); if(position<0)throw new IllegalStateException(); if(first){start=position;end=-1;}else end=position; update(); }
            catch(Exception e){toast("เลือกตำแหน่งไม่ได้ กรุณารอให้เว็บโหลดก่อน");}
        });
    }
    private void resolveMarks(Runnable next) {
        if(!valid())return;
        web.evaluateJavascript(resolveScript(),value->{
            try { JSONArray positions=new JSONArray(value);start=(int)Math.round(positions.getDouble(0));end=(int)Math.round(positions.getDouble(1));if(valid())next.run(); }
            catch(Exception e){start=end=-1;update();toast("หน้าเว็บเปลี่ยนไป กรุณาเลือกจุดเริ่มและจบใหม่");}
        });
    }
    private String resolveScript(){return "(()=>{try{return window.MangaCaptureAnchors.resolve("+web.getWidth()+")}catch(e){return null}})()";}
    private void open(String url) { if(!url.startsWith("https://") || Uri.parse(url).getHost()==null) { toast("ใส่ลิงก์ https:// ให้ครบ"); return; } web.loadUrl(url); }
    private void update() { status.setText("เลื่อนให้ตำแหน่งที่ต้องการอยู่ตรงเส้นกลางจอ\nเริ่ม: "+(start<0?"ยังไม่เลือก":start)+" · จบ: "+(end<0?"ยังไม่เลือก":end)+" · ตัดขอบ "+left+"% / "+right+"%"); guide.invalidate(); }
    private boolean valid() { if(start<0 || end<=start) { toast("เลือกจุดสิ้นสุดให้อยู่หลังจุดเริ่มต้น"); return false; } return true; }
    private void cropDialog() {
        LinearLayout panel=new LinearLayout(this); panel.setPadding(24,8,24,8); panel.setOrientation(1);
        TextView label=new TextView(this); panel.addView(label);
        SeekBar l=new SeekBar(this),r=new SeekBar(this); l.setMax(45); r.setMax(45); l.setProgress(left); r.setProgress(right); panel.addView(l); panel.addView(r);
        Runnable refresh=()->label.setText("ตัดซ้าย "+l.getProgress()+"% · ตัดขวา "+r.getProgress()+"%");
        SeekBar.OnSeekBarChangeListener listener=new SeekBar.OnSeekBarChangeListener(){ public void onStartTrackingTouch(SeekBar b){} public void onStopTrackingTouch(SeekBar b){} public void onProgressChanged(SeekBar b,int p,boolean user){ refresh.run(); }};
        l.setOnSeekBarChangeListener(listener); r.setOnSeekBarChangeListener(listener); refresh.run();
        new AlertDialog.Builder(this).setTitle("ขอบซ้าย / ขวา").setView(panel).setPositiveButton("ใช้",(d,w)->{left=l.getProgress(); right=r.getProgress(); update();}).setNegativeButton("ยกเลิก",null).show();
    }
    private void settle(int y,Runnable next) {
        web.scrollTo(0,y);
        handler.postDelayed(()-> { if(isFinishing()) return; web.postVisualStateCallback(System.nanoTime(),new WebView.VisualStateCallback(){ @Override public void onComplete(long id){ next.run(); }}); },350);
    }
    private interface Captured { void accept(Bitmap bitmap); }
    private void capture(int y,int height,Captured next) {
        guide.setVisibility(View.INVISIBLE);
        handler.postDelayed(()-> {
            if(isFinishing()||isDestroyed())return;
            int[] location=new int[2];web.getLocationInWindow(location);
            Bitmap viewport=Bitmap.createBitmap(web.getWidth(),web.getHeight(),Bitmap.Config.ARGB_8888);
            Rect source=new Rect(location[0],location[1],location[0]+web.getWidth(),location[1]+web.getHeight());
            PixelCopy.request(getWindow(),source,viewport,result->{
                guide.setVisibility(View.VISIBLE);
                if(result!=PixelCopy.SUCCESS){viewport.recycle();failCapture("อ่านภาพจากจอไม่สำเร็จ ("+result+") กรุณาเปิดแอปค้างไว้");return;}
                try {
                    int offset=y-web.getScrollY();
                    if(offset<0||offset+height>viewport.getHeight())throw new IllegalStateException("ตำแหน่งหน้าเว็บเปลี่ยน กรุณาเลือกช่วงใหม่");
                    Bitmap strip=Bitmap.createBitmap(viewport,web.getWidth()*left/100,offset,web.getWidth()*(100-left-right)/100,height);
                    if(strip!=viewport)viewport.recycle();next.accept(strip);
                } catch(Exception e){if(!viewport.isRecycled())viewport.recycle();failCapture(e.getMessage());}
            },handler);
        },100);
    }
    private void failCapture(String message){if(pdf!=null)finishExport(message);else {busy=false;setClean(false,()->web.scrollTo(0,oldY));toast(message);}}
    private void preview() {
        if(!valid()) return;
        busy=true; oldY=web.getScrollY();
        int height=Math.min(end-start,web.getHeight());
        setClean(true,()->settle(start,()-> capture(start,height,first->{
            settle(end-height,()->capture(end-height,height,last->{
                LinearLayout content=new LinearLayout(this);content.setOrientation(1);
                TextView firstLabel=new TextView(this);firstLabel.setText("จุดเริ่มอยู่ที่ขอบบนของภาพนี้");content.addView(firstLabel);
                ImageView firstView=new ImageView(this);firstView.setImageBitmap(first);firstView.setAdjustViewBounds(true);content.addView(firstView);
                TextView lastLabel=new TextView(this);lastLabel.setText("จุดสิ้นสุดอยู่ที่ขอบล่างของภาพนี้");content.addView(lastLabel);
                ImageView lastView=new ImageView(this);lastView.setImageBitmap(last);lastView.setAdjustViewBounds(true);content.addView(lastView);
                ScrollView scroll=new ScrollView(this);scroll.addView(content);
                new AlertDialog.Builder(this).setTitle("ตรวจจุดเริ่มและจบ").setView(scroll).setPositiveButton("ปิด",null).setOnDismissListener(d->{first.recycle();last.recycle();setClean(false,()->web.scrollTo(0,oldY));busy=false;}).show();
            }));
        })));
    }
    private void exportDialog() {
        if(!valid()) return;
        busy=true;
        web.evaluateJavascript(filenameScript+";window.MangaCaptureFilename.create()",value->{
            busy=false;
            try {pdfFilename=new JSONArray("["+value+"]").getString(0);if("null".equals(pdfFilename))throw new IllegalArgumentException();}
            catch(Exception e){pdfFilename="Manga.pdf";}
            if(isFinishing()||isDestroyed())return;
            new AlertDialog.Builder(this).setTitle("บันทึก PDF").setMessage("ชื่อไฟล์: "+pdfFilename+"\n\nแอปจะเลื่อนโหลดภาพในช่วงที่เลือกก่อนแคป\nสามารถแก้ชื่อได้อีกครั้งในหน้าบันทึกไฟล์").setPositiveButton("แบ่งหน้า A4",(d,w)->begin(false)).setNeutralButton("หน้ายาว",(d,w)->begin(true)).setNegativeButton("ยกเลิก",null).show();
        });
    }
    private void begin(boolean longPage) {
        busy=true; cancelled=false; longPageMode=longPage; warmPass=0; oldY=web.getScrollY(); cursor=start; pageNumber=0; pageFill=0;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        cropWidth=web.getWidth()*(100-left-right)/100;
        pageHeight=longPage?Math.min(14000,Math.max(1,(int)Math.ceil((end-start)*595.0/cropWidth))):842;
        pdf=new PdfDocument(); status.setText("กำลังโหลดภาพ… กดยกเลิกเพื่อหยุด"); setClean(true,()->warm(start));
    }
    private void warm(int y) { warm(y,0); }
    private void warm(int y,int attempt) {
        if(cancelled) { finishExport(null); return; }
        settle(y,()-> {
            web.evaluateJavascript("(()=>{let reader=document.querySelector('#readerarea,.readerarea');let images=reader?reader.querySelectorAll('img'):document.images;return Array.from(images).filter(i=>{let r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&(!i.complete||i.naturalWidth===0)}).length})()",value->{
                if(!"0".equals(value)) {
                    if(attempt<15) { handler.postDelayed(()->warm(y,attempt+1),500); return; }
                    finishExport("ยังมีภาพโหลดไม่ครบในช่วงที่เลือก ลองรอให้ภาพโหลดหรือปิดโฆษณาแล้วบันทึกใหม่"); return;
                }
                if(y>=end) { resolveAfterWarm(); } else { status.setText("โหลดภาพ "+Math.min(100,(y-start)*100/Math.max(1,end-start))+"% · ยกเลิกได้"); warm(Math.min(end,y+Math.max(1,web.getHeight()-80))); }
            });
        });
    }
    private void resolveAfterWarm(){
        web.evaluateJavascript(resolveScript(),value->{
            try {
                JSONArray p=new JSONArray(value);int a=p.getInt(0),b=p.getInt(1);
                boolean moved=Math.abs(a-start)>2||Math.abs(b-end)>2;
                // Layout shifts are expected during lazy loading. Follow the selected content instead of rejecting it.
                start=a;end=b;
                if(moved && warmPass++<2){status.setText("กำลังปรับช่วงตามภาพที่โหลดเพิ่ม…");warm(start);return;}
                pageHeight=longPageMode?Math.min(14000,Math.max(1,(int)Math.ceil((end-start)*595.0/cropWidth))):842;
                cursor=start;nextTile();
            } catch(Exception e){finishExport("เนื้อหาที่เลือกถูกลบหรือเปลี่ยนหน้า กรุณาเลือกจุดเริ่มและจบใหม่");}
        });
    }
    private void nextTile() {
        if(cancelled) { finishExport(null); return; }
        if(cursor>=end) { finishExport("save"); return; }
        if(page==null) {
            // The final long page must fit the remaining image, rather than leave a 14,000-point white tail.
            activePageHeight=longPageMode?Math.min(pageHeight,Math.max(1,(int)Math.ceil((end-cursor)*595.0/cropWidth))):pageHeight;
            page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,activePageHeight,++pageNumber).create()); page.getCanvas().drawColor(Color.WHITE); pageFill=0;
        }
        final int amount=Math.min(end-cursor,Math.min(web.getHeight(),Math.max(1,(int)Math.floor((activePageHeight-pageFill)*cropWidth/595.0))));
        settle(cursor,()-> capture(cursor,amount,image->{
            try {
                float h=amount*595f/cropWidth;
                page.getCanvas().drawBitmap(image,null,new RectF(0,pageFill,595,pageFill+h),null); image.recycle();
                pageFill+=h; cursor+=amount;
                if(activePageHeight-pageFill<2 || cursor>=end) { pdf.finishPage(page); page=null; }
                status.setText("แคป "+((cursor-start)*100/(end-start))+"% · หน้า "+pageNumber+" · ยกเลิกได้"); nextTile();
            } catch(Exception | OutOfMemoryError e) { finishExport(e.getMessage()); }
        }));
    }
    private void finishExport(String result) {
        try {
            if(page!=null) { pdf.finishPage(page); page=null; }
            if("save".equals(result)) {
                pending=new File(getCacheDir(),"capture.pdf");
                try(OutputStream out=new FileOutputStream(pending)){ pdf.writeTo(out); }
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/pdf").addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE,pdfFilename); startActivityForResult(intent,10);
            } else { if(result==null)toast("ยกเลิกแล้ว");else showError(result); }
        } catch(Exception e){ showError("บันทึกไฟล์ไม่ได้: "+e.getMessage()); }
        finally { if(pdf!=null)pdf.close(); pdf=null; busy=false; getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); setClean(false,()->web.scrollTo(0,oldY)); update(); }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request!=10 || pending==null) return;
        if(result==RESULT_OK && data!=null && data.getData()!=null) {
            try(InputStream in=new FileInputStream(pending); OutputStream out=getContentResolver().openOutputStream(data.getData())) {
                if(out==null) throw new IOException("เปิดไฟล์ปลายทางไม่ได้"); byte[] buffer=new byte[65536]; int n; while((n=in.read(buffer))!=-1) out.write(buffer,0,n); toast("บันทึก PDF แล้ว");
            } catch(Exception e){ toast("บันทึกไม่สำเร็จ: "+e.getMessage()); }
        }
        pending.delete(); pending=null;
    }
    @Override public void onBackPressed(){ if(busy){cancelled=true;return;} if(web.canGoBack())web.goBack();else super.onBackPressed(); }
    @Override protected void onDestroy(){ handler.removeCallbacksAndMessages(null); if(pdf!=null){if(page!=null)pdf.finishPage(page);pdf.close();} web.destroy();super.onDestroy(); }
    private class Guide extends View {
        private final Paint paint=new Paint(3);
        Guide(){super(MainActivity.this); setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
        @Override protected void onDraw(Canvas c){
            paint.setColor(0x66000000); c.drawRect(0,0,getWidth()*left/100f,getHeight(),paint);c.drawRect(getWidth()*(100-right)/100f,0,getWidth(),getHeight(),paint);
            paint.setColor(0xff00bfa5);paint.setStrokeWidth(3);c.drawLine(0,getHeight()/2f,getWidth(),getHeight()/2f,paint);
            paint.setTextSize(32);c.drawText("เลือกเริ่ม / จบ ตรงเส้นนี้",16,getHeight()/2f-12,paint);
        }
    }
}
