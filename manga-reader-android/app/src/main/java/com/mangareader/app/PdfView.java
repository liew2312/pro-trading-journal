package com.mangareader.app;

import android.content.Context;
import android.graphics.*;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.*;
import android.util.LruCache;
import android.view.*;
import android.widget.OverScroller;
import java.io.*;
import java.util.Set;
import java.util.concurrent.*;

public final class PdfView extends View {
    public interface Listener { void ready(int pages);void progress(int page,int total,double fraction,double progress);void error(String message);void tapped(); }
    public Listener listener;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());
    private final Set<String> pending=ConcurrentHashMap.newKeySet(),needed=ConcurrentHashMap.newKeySet();
    private final Set<String> failed=ConcurrentHashMap.newKeySet();
    private final LruCache<String,Bitmap> cache=new LruCache<String,Bitmap>(24*1024*1024){@Override protected int sizeOf(String key,Bitmap bitmap){return bitmap.getAllocationByteCount();}};
    private PdfRenderer renderer;
    private ParcelFileDescriptor descriptor;
    private volatile int documentId;
    private boolean disposed,loading;
    private int[] widths={},heights={};
    private PageLayout layout;
    private double x,y,zoom=1;
    private final Paint imagePaint=new Paint(Paint.FILTER_BITMAP_FLAG),textPaint=new Paint(3);
    private final GestureDetector gestures;
    private final ScaleGestureDetector scaling;
    private final OverScroller scroller;
    private String message="เปิดไฟล์ PDF เพื่อเริ่มอ่าน\nเลื่อนขึ้น–ลง · จีบนิ้วเพื่อซูม\nแตะภาพเพื่อซ่อนแถบเครื่องมือ";
    private int lastProgressPage=-1,lastProgressValue=-1;
    private boolean renderErrorShown;
    public PdfView(Context context){
        super(context);setBackgroundColor(0xff111218);setFocusable(true);setContentDescription("พื้นที่อ่าน PDF เลื่อนขึ้นลงและจีบนิ้วเพื่อซูม");
        scroller=new OverScroller(context);
        scaling=new ScaleGestureDetector(context,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
            @Override public boolean onScale(ScaleGestureDetector d){setZoom(zoom*d.getScaleFactor(),d.getFocusX(),d.getFocusY());return true;}
            @Override public boolean onScaleBegin(ScaleGestureDetector d){scroller.forceFinished(true);return layout!=null;}
        });
        gestures=new GestureDetector(context,new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(android.view.MotionEvent e){scroller.forceFinished(true);return true;}
            @Override public boolean onScroll(android.view.MotionEvent a,android.view.MotionEvent b,float dx,float dy){if(!scaling.isInProgress()){x+=dx;y+=dy;clamp();invalidate();}return true;}
            @Override public boolean onFling(android.view.MotionEvent a,android.view.MotionEvent b,float vx,float vy){
                if(layout!=null&&!scaling.isInProgress()){scroller.fling((int)x,(int)y,(int)-vx,(int)-vy,0,(int)Math.max(0,layout.width-getWidth()),0,(int)maxY());postInvalidateOnAnimation();}return true;
            }
            @Override public boolean onSingleTapConfirmed(android.view.MotionEvent e){performClick();return true;}
            @Override public boolean onDoubleTap(android.view.MotionEvent e){setZoom(zoom>1.1?1:2,e.getX(),e.getY());return true;}
        });
    }
    @Override public boolean performClick(){super.performClick();if(listener!=null)listener.tapped();return true;}
    @Override public boolean onTouchEvent(android.view.MotionEvent event){scaling.onTouchEvent(event);gestures.onTouchEvent(event);return true;}
    @Override public void computeScroll(){if(scroller.computeScrollOffset()){x=scroller.getCurrX();y=scroller.getCurrY();clamp();postInvalidateOnAnimation();}}
    private double maxY(){return layout==null?0:Math.max(0,layout.total-getHeight());}
    private void clamp(){if(layout==null){x=y=0;return;}x=Math.max(0,Math.min(x,Math.max(0,layout.width-getWidth())));y=Math.max(0,Math.min(y,maxY()));}
    private void rebuild(){if(widths.length>0&&getWidth()>0)layout=new PageLayout(widths,heights,getWidth()*zoom,8*getResources().getDisplayMetrics().density);else layout=null;clamp();}
    private void setZoom(double value,float focusX,float focusY){
        if(layout==null)return;
        int page=layout.pageAt(y+focusY);double fraction=layout.fraction(page,y+focusY),oldWidth=layout.width,docX=x+focusX;
        zoom=Math.max(1,Math.min(3,value));rebuild();x=docX*layout.width/oldWidth-focusX;y=layout.position(page,fraction)-focusY;clamp();invalidate();
    }
    public void resetZoom(){setZoom(1,getWidth()/2f,getHeight()/2f);}
    public int currentPage(){return layout==null?0:layout.pageAt(y);}
    public double currentFraction(){return layout==null?0:layout.fraction(currentPage(),y);}
    public boolean hasDocument(){return layout!=null&&!loading;}
    public void goToPage(int page,double fraction){if(layout==null)return;scroller.forceFinished(true);y=layout.position(page,fraction);clamp();invalidate();}
    public void seek(double fraction){scroller.forceFinished(true);y=maxY()*Math.max(0,Math.min(1,fraction));invalidate();}
    @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){int page=currentPage();double fraction=currentFraction();rebuild();if(layout!=null){y=layout.position(page,fraction);clamp();}}
    public void open(Uri uri,int savedPage,double savedFraction){
        final int id=++documentId;loading=true;scroller.forceFinished(true);widths=heights=new int[0];layout=null;cache.evictAll();needed.clear();pending.clear();failed.clear();renderErrorShown=false;lastProgressPage=lastProgressValue=-1;zoom=1;x=y=0;message="กำลังเปิด PDF…";invalidate();
        worker.execute(()->{
            try{
                closeRenderer();if(id!=documentId)return;
                File copy=new File(getContext().getCacheDir(),"reading.pdf");
                try(InputStream in=getContext().getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(copy)){
                    if(in==null)throw new IOException("เปิดไฟล์ต้นฉบับไม่ได้");byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1){if(id!=documentId)return;out.write(buffer,0,n);}
                }
                descriptor=ParcelFileDescriptor.open(copy,ParcelFileDescriptor.MODE_READ_ONLY);renderer=new PdfRenderer(descriptor);
                int count=renderer.getPageCount();if(count==0)throw new IOException("ไฟล์ไม่มีหน้าให้อ่าน");
                int[] ws=new int[count],hs=new int[count];
                for(int i=0;i<count;i++){try(PdfRenderer.Page page=renderer.openPage(i)){ws[i]=page.getWidth();hs[i]=page.getHeight();}}
                main.post(()->{if(disposed||id!=documentId)return;loading=false;widths=ws;heights=hs;rebuild();goToPage(savedPage,savedFraction);if(listener!=null)listener.ready(count);invalidate();});
            }catch(Exception e){closeRenderer();main.post(()->{if(disposed||id!=documentId)return;loading=false;message="เปิด PDF ไม่ได้\nไฟล์อาจเสีย มีรหัสผ่าน หรือไม่มีสิทธิ์เข้าถึง";invalidate();if(listener!=null)listener.error(e.getMessage());});}
        });
    }
    private void closeRenderer(){if(renderer!=null){renderer.close();renderer=null;}if(descriptor!=null){try{descriptor.close();}catch(IOException ignored){}descriptor=null;}}
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        if(layout==null){textPaint.setColor(0xffbdb8d6);textPaint.setTextSize(16*getResources().getDisplayMetrics().scaledDensity);textPaint.setTextAlign(Paint.Align.CENTER);int line=0;for(String s:message.split("\n"))canvas.drawText(s,getWidth()/2f,getHeight()/2f+line++*32*getResources().getDisplayMetrics().density,textPaint);return;}
        needed.clear();int first=layout.pageAt(y),rasterWidth=PageLayout.rasterWidth(layout.width);double factor=layout.width/rasterWidth;
        for(int pageIndex=first;pageIndex<widths.length&&layout.tops[pageIndex]<y+getHeight();pageIndex++){
            double pageTop=layout.tops[pageIndex];int rasterHeight=PageLayout.rasterHeight(widths[pageIndex],heights[pageIndex],rasterWidth);
            int firstTile=Math.max(0,(int)((y-pageTop)/factor)/512),lastTile=Math.min((rasterHeight-1)/512,(int)Math.ceil((y+getHeight()-pageTop)/factor/512));
            for(int tile=firstTile;tile<=lastTile;tile++){
                int top=tile*512,height=Math.min(512,rasterHeight-top);String key=documentId+":"+pageIndex+":"+rasterWidth+":"+tile;needed.add(key);
                RectF target=new RectF((float)-x,(float)(pageTop+top*factor-y),(float)(layout.width-x),(float)(pageTop+(top+height)*factor-y));
                Bitmap bitmap=cache.get(key);
                if(bitmap!=null)canvas.drawBitmap(bitmap,null,target,imagePaint);
                else {textPaint.setColor(Color.WHITE);canvas.drawRect(target,textPaint);requestTile(key,pageIndex,rasterWidth,top,height);}
            }
        }
        int value=(int)Math.round((maxY()==0?0:y/maxY())*10000);
        if(listener!=null&&(first!=lastProgressPage||value!=lastProgressValue)){
            lastProgressPage=first;lastProgressValue=value;listener.progress(first,widths.length,layout.fraction(first,y),maxY()==0?0:y/maxY());
        }
    }
    private void requestTile(String key,int index,int width,int top,int height){
        if(disposed||failed.contains(key)||pending.size()>=12||!pending.add(key))return;final int id=documentId;
        worker.execute(()->{
            Bitmap bitmap=null;
            try{
                if(id!=documentId||!needed.contains(key)||renderer==null)return;
                bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.WHITE);
                try(PdfRenderer.Page page=renderer.openPage(index)){Matrix matrix=new Matrix();float scale=width/(float)page.getWidth();matrix.setScale(scale,scale);matrix.postTranslate(0,-top);page.render(bitmap,null,matrix,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);}
                Bitmap result=bitmap;bitmap=null;
                main.post(()->{if(disposed||id!=documentId){result.recycle();return;}cache.put(key,result);invalidate();});
            }catch(Exception|OutOfMemoryError e){failed.add(key);main.post(()->{if(!disposed&&id==documentId&&!renderErrorShown){renderErrorShown=true;message="แสดงภาพบางส่วนไม่ได้ ลองเปิดไฟล์ใหม่";if(listener!=null)listener.error(message);}});}
            finally{if(bitmap!=null)bitmap.recycle();pending.remove(key);main.post(()->{if(!disposed)invalidate();});}
        });
    }
    public void dispose(){disposed=true;documentId++;needed.clear();cache.evictAll();worker.execute(this::closeRenderer);worker.shutdown();}
}
