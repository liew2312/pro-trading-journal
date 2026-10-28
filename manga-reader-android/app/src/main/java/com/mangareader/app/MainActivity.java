package com.mangareader.app;

import android.app.*;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.text.TextUtils;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;

public class MainActivity extends Activity implements PdfView.Listener {
    private PdfView reader;
    private LinearLayout header,footer;
    private TextView title,progress;
    private SeekBar seek;
    private Uri current;
    private String currentName="Manga Reader";
    private int pageCount;
    private boolean chrome=true,dragging,opening;
    private ShelfLibrary library=new ShelfLibrary();
    private String importingSeries;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable saveTask=this::savePosition;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().setStatusBarColor(0xff1c1938);getWindow().setNavigationBarColor(0xff111218);
        LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(0xff111218);
        root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});setContentView(root);
        header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setBackgroundColor(0xff1c1938);root.addView(header);
        title=new TextView(this);title.setText("Manga Reader 0.2");title.setTextSize(14);title.setSingleLine();title.setEllipsize(TextUtils.TruncateAt.END);title.setPadding(dp(10),0,dp(4),0);header.addView(title,new LinearLayout.LayoutParams(0,dp(44),1));title.setGravity(Gravity.CENTER_VERTICAL);
        button(header,"เปิด",this::pick);button(header,"ล่าสุด",this::recents);button(header,"เมนู",this::menu);
        reader=new PdfView(this);reader.listener=this;root.addView(reader,new LinearLayout.LayoutParams(-1,0,1));
        footer=new LinearLayout(this);footer.setOrientation(1);footer.setPadding(dp(10),0,dp(10),dp(4));root.addView(footer);
        progress=new TextView(this);progress.setText("PDF ในเครื่อง · ไม่ต้องใช้อินเทอร์เน็ต");progress.setTextSize(11);footer.addView(progress);progress.setOnClickListener(v->jumpDialog());
        seek=new SeekBar(this);seek.setMax(1000);footer.addView(seek,new LinearLayout.LayoutParams(-1,dp(28)));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar b){dragging=true;}public void onStopTrackingTouch(SeekBar b){reader.seek(b.getProgress()/1000.0);dragging=false;savePosition();}public void onProgressChanged(SeekBar b,int value,boolean user){if(user)reader.seek(value/1000.0);}});
        applyKeepScreen();loadShelf();
        if(getIntent().getData()!=null)open(getIntent().getData());
        else {String last=getPreferences(MODE_PRIVATE).getString("last",null);if(last!=null)open(Uri.parse(last));}
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void button(LinearLayout row,String text,Runnable action){Button b=new Button(this);b.setText(text);b.setTextSize(11);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(0);b.setMinimumHeight(0);b.setPadding(dp(5),0,dp(5),0);row.addView(b,new LinearLayout.LayoutParams(dp(54),dp(40)));b.setOnClickListener(v->action.run());}
    private void pick(){if(opening)return;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/pdf").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(intent,1);}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK||data==null)return;
        if(request==2){importBooks(data);return;}
        if(request==1&&data.getData()!=null){retain(data.getData(),data.getFlags());open(data.getData());}
    }
    private void retain(Uri uri,int flags){try{getContentResolver().takePersistableUriPermission(uri,flags&Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(SecurityException ignored){}}
    private String documentName(Uri uri){try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(cursor!=null&&cursor.moveToFirst()){String name=cursor.getString(0);if(name!=null&&!name.trim().isEmpty())return name;}}catch(Exception ignored){}return "PDF";}
    private void loadShelf(){
        try{JSONArray stories=new JSONArray(getPreferences(MODE_PRIVATE).getString("shelf","[]"));for(int i=0;i<stories.length();i++){JSONObject story=stories.getJSONObject(i);ShelfLibrary.Series item=new ShelfLibrary.Series(story.getString("id"),story.getString("name"));JSONArray books=story.getJSONArray("books");for(int j=0;j<books.length();j++){JSONObject book=books.getJSONObject(j);item.books.add(new ShelfLibrary.Book(book.getString("uri"),book.getString("name")));}library.series.add(item);}}
        catch(JSONException e){Toast.makeText(this,"อ่านชั้นหนังสือบางส่วนไม่ได้",Toast.LENGTH_LONG).show();}
    }
    private void saveShelf(){
        try{JSONArray stories=new JSONArray();for(ShelfLibrary.Series item:library.series){JSONArray books=new JSONArray();for(ShelfLibrary.Book book:item.books)books.put(new JSONObject().put("uri",book.uri).put("name",book.name));stories.put(new JSONObject().put("id",item.id).put("name",item.name).put("books",books));}getPreferences(MODE_PRIVATE).edit().putString("shelf",stories.toString()).apply();}catch(JSONException e){Toast.makeText(this,"บันทึกชั้นหนังสือไม่ได้",Toast.LENGTH_LONG).show();}
    }
    private void shelf(){
        if(opening)return;savePosition();
        String[] labels=new String[library.series.size()];for(int i=0;i<labels.length;i++){ShelfLibrary.Series item=library.series.get(i);labels[i]=item.name+"  ·  "+item.books.size()+" ไฟล์";}
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(labels.length==0?"ชั้นหนังสือ · เริ่มด้วยเพิ่มเรื่อง":"ชั้นหนังสือ · กดค้างเพื่อจัดการเรื่อง").setItems(labels,(d,which)->showSeries(library.series.get(which).id)).setPositiveButton("เพิ่มเรื่อง",(d,w)->editSeries(null)).setNegativeButton("ปิด",null).create();
        dialog.setOnShowListener(d->dialog.getListView().setOnItemLongClickListener((parent,view,position,id)->{String seriesId=library.series.get(position).id;dialog.dismiss();seriesMenu(seriesId);return true;}));dialog.show();
    }
    private void editSeries(String id){
        ShelfLibrary.Series item=id==null?null:library.find(id);EditText field=new EditText(this);field.setSingleLine();field.setHint("ชื่อเรื่อง เช่น Pig Slayer");if(item!=null)field.setText(item.name);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(item==null?"เพิ่มเรื่อง":"เปลี่ยนชื่อเรื่อง").setView(field).setPositiveButton("บันทึก",null).setNegativeButton("ยกเลิก",(d,w)->shelf()).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String name=field.getText().toString().trim();if(name.isEmpty()){field.setError("ใส่ชื่อเรื่องก่อนครับ");return;}String target=id;if(item==null)target=library.create(name).id;else item.name=name;saveShelf();dialog.dismiss();showSeries(target);}));dialog.show();
    }
    private void showSeries(String id){
        ShelfLibrary.Series item=library.find(id);if(item==null){shelf();return;}
        String[] labels=new String[item.books.size()];for(int i=0;i<labels.length;i++){ShelfLibrary.Book book=item.books.get(i);labels[i]=book.name+"\nอ่านต่อหน้า "+(getPreferences(MODE_PRIVATE).getInt(book.uri+":page",0)+1);}
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(item.name+(labels.length==0?" · ยังไม่มีไฟล์":" · กดค้างเพื่อจัดการไฟล์")).setItems(labels,(d,which)->open(Uri.parse(item.books.get(which).uri))).setPositiveButton("เพิ่ม PDF หลายไฟล์",(d,w)->pickForSeries(id)).setNeutralButton("จัดการเรื่อง",(d,w)->seriesMenu(id)).setNegativeButton("กลับ",(d,w)->shelf()).create();
        dialog.setOnShowListener(d->dialog.getListView().setOnItemLongClickListener((parent,view,position,rowId)->{ShelfLibrary.Book book=item.books.get(position);dialog.dismiss();bookMenu(id,book);return true;}));dialog.show();
    }
    private void pickForSeries(String id){importingSeries=id;getPreferences(MODE_PRIVATE).edit().putString("pendingSeries",id).apply();Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/pdf").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(intent,2);}
    private void importBooks(Intent data){
        String target=importingSeries;if(target==null)target=getPreferences(MODE_PRIVATE).getString("pendingSeries",null);if(library.find(target)==null){Toast.makeText(this,"ไม่พบเรื่องที่จะเพิ่มไฟล์ กรุณาเลือกใหม่",Toast.LENGTH_LONG).show();return;}
        LinkedHashSet<Uri> uris=new LinkedHashSet<>();if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());if(data.getData()!=null)uris.add(data.getData());
        List<ShelfLibrary.Book> books=new ArrayList<>();for(Uri uri:uris){retain(uri,data.getFlags());books.add(new ShelfLibrary.Book(uri.toString(),documentName(uri)));}
        int added=library.add(target,books);saveShelf();Toast.makeText(this,"เพิ่ม "+added+" ไฟล์ · ข้ามไฟล์ซ้ำ "+(books.size()-added),Toast.LENGTH_LONG).show();showSeries(target);
    }
    private void seriesMenu(String id){ShelfLibrary.Series item=library.find(id);if(item==null)return;new AlertDialog.Builder(this).setTitle(item.name).setItems(new String[]{"เพิ่ม PDF หลายไฟล์","เปลี่ยนชื่อเรื่อง","นำเรื่องออกจากชั้น"},(d,which)->{if(which==0)pickForSeries(id);else if(which==1)editSeries(id);else new AlertDialog.Builder(this).setTitle("นำเรื่องออกจากชั้น?").setMessage("นำเฉพาะรายการออก ไฟล์ PDF ต้นฉบับยังอยู่ในเครื่อง").setPositiveButton("นำออก",(confirm,w)->{library.removeSeries(id);saveShelf();shelf();}).setNegativeButton("ยกเลิก",(confirm,w)->showSeries(id)).show();}).setNegativeButton("กลับ",(d,w)->showSeries(id)).show();}
    private void bookMenu(String id,ShelfLibrary.Book book){new AlertDialog.Builder(this).setTitle(book.name).setItems(new String[]{"เปิดอ่านต่อ","ย้ายไปเรื่องอื่น","นำไฟล์ออกจากเรื่อง"},(d,which)->{if(which==0)open(Uri.parse(book.uri));else if(which==1)moveBook(id,book);else new AlertDialog.Builder(this).setMessage("นำรายการนี้ออกจากเรื่อง? ไฟล์ต้นฉบับยังอยู่ในเครื่อง").setPositiveButton("นำออก",(confirm,w)->{library.removeBook(id,book.uri);saveShelf();showSeries(id);}).setNegativeButton("ยกเลิก",(confirm,w)->showSeries(id)).show();}).setNegativeButton("กลับ",(d,w)->showSeries(id)).show();}
    private void moveBook(String from,ShelfLibrary.Book book){List<ShelfLibrary.Series> targets=new ArrayList<>();for(ShelfLibrary.Series item:library.series)if(!item.id.equals(from))targets.add(item);if(targets.isEmpty()){Toast.makeText(this,"เพิ่มเรื่องอื่นในชั้นหนังสือก่อนครับ",Toast.LENGTH_LONG).show();showSeries(from);return;}String[] labels=new String[targets.size()];for(int i=0;i<labels.length;i++)labels[i]=targets.get(i).name;new AlertDialog.Builder(this).setTitle("ย้ายไปเรื่อง").setItems(labels,(d,which)->{library.add(targets.get(which).id,Collections.singletonList(book));library.removeBook(from,book.uri);saveShelf();showSeries(targets.get(which).id);}).setNegativeButton("ยกเลิก",(d,w)->showSeries(from)).show();}
    private void open(Uri uri){
        if(opening)return;savePosition();opening=true;current=null;currentName="PDF";
        try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(cursor!=null&&cursor.moveToFirst())currentName=cursor.getString(0);}catch(Exception ignored){}
        title.setText(currentName);pageCount=0;progress.setText("กำลังเปิดไฟล์…");setChrome(true);
        current=uri;int savedPage=getPreferences(MODE_PRIVATE).getInt(uri+":page",0);double fraction=Double.longBitsToDouble(getPreferences(MODE_PRIVATE).getLong(uri+":fraction",0));
        reader.open(uri,savedPage,fraction);
    }
    @Override public void ready(int pages){opening=false;pageCount=pages;getPreferences(MODE_PRIVATE).edit().putString("last",current.toString()).apply();rememberRecent();}
    @Override public void progress(int page,int total,double fraction,double amount){progress.setText("หน้า "+(page+1)+" / "+total+"  ·  "+Math.round(amount*100)+"%  · แตะเพื่อเลือกหน้า");if(!dragging)seek.setProgress((int)Math.round(amount*1000));handler.removeCallbacks(saveTask);handler.postDelayed(saveTask,1200);}
    @Override public void error(String message){opening=false;new AlertDialog.Builder(this).setTitle("อ่านไฟล์ไม่ได้").setMessage(message==null?"ลองเลือกไฟล์ PDF อีกครั้ง":message).setPositiveButton("ตกลง",null).show();}
    @Override public void tapped(){setChrome(!chrome);}
    private void setChrome(boolean visible){chrome=visible;header.setVisibility(visible?View.VISIBLE:View.GONE);footer.setVisibility(visible?View.VISIBLE:View.GONE);getWindow().getDecorView().setSystemUiVisibility(visible?View.SYSTEM_UI_FLAG_VISIBLE:View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
    private void savePosition(){if(current!=null&&reader!=null&&reader.hasDocument())getPreferences(MODE_PRIVATE).edit().putInt(current+":page",reader.currentPage()).putLong(current+":fraction",Double.doubleToLongBits(reader.currentFraction())).apply();}
    private JSONArray recentList(){try{return new JSONArray(getPreferences(MODE_PRIVATE).getString("recent","[]"));}catch(JSONException e){return new JSONArray();}}
    private void rememberRecent(){try{JSONArray old=recentList(),next=new JSONArray();next.put(new JSONObject().put("uri",current.toString()).put("name",currentName));for(int i=0;i<old.length()&&next.length()<20;i++){JSONObject item=old.getJSONObject(i);if(!item.getString("uri").equals(current.toString()))next.put(item);}getPreferences(MODE_PRIVATE).edit().putString("recent",next.toString()).apply();}catch(JSONException ignored){}}
    private void recents(){if(opening)return;JSONArray list=recentList();if(list.length()==0){Toast.makeText(this,"ยังไม่มีไฟล์ที่เคยอ่าน",Toast.LENGTH_SHORT).show();return;}String[] labels=new String[list.length()];for(int i=0;i<labels.length;i++){JSONObject item=list.optJSONObject(i);String uri=item.optString("uri");labels[i]=item.optString("name","PDF")+" · หน้า "+(getPreferences(MODE_PRIVATE).getInt(uri+":page",0)+1);}new AlertDialog.Builder(this).setTitle("อ่านต่อจากไฟล์ล่าสุด").setItems(labels,(d,which)->open(Uri.parse(list.optJSONObject(which).optString("uri")))).setNegativeButton("ปิด",null).show();}
    private void jumpDialog(){if(pageCount==0)return;EditText field=new EditText(this);field.setInputType(2);field.setHint("1–"+pageCount);field.setText(String.valueOf(reader.currentPage()+1));new AlertDialog.Builder(this).setTitle("ไปยังหน้า").setView(field).setPositiveButton("ไป",(d,w)->{try{int value=Integer.parseInt(field.getText().toString());if(value<1||value>pageCount)throw new NumberFormatException();reader.goToPage(value-1,0);}catch(NumberFormatException e){Toast.makeText(this,"ใส่เลขหน้า 1 ถึง "+pageCount,Toast.LENGTH_SHORT).show();}}).setNegativeButton("ยกเลิก",null).show();}
    private void menu(){new AlertDialog.Builder(this).setTitle("Manga Reader 0.2").setItems(new String[]{"ชั้นหนังสือ", "เปิด PDF", "ไปยังหน้า…", "ซูมพอดีความกว้าง", "อ่านเต็มจอ", "ปรับความสว่าง", "เปิด/ปิดหน้าจอค้าง"},(d,which)->{switch(which){case 0:shelf();break;case 1:pick();break;case 2:jumpDialog();break;case 3:reader.resetZoom();break;case 4:setChrome(false);break;case 5:brightness();break;case 6:boolean keep=!getPreferences(MODE_PRIVATE).getBoolean("keep",true);getPreferences(MODE_PRIVATE).edit().putBoolean("keep",keep).apply();applyKeepScreen();Toast.makeText(this,keep?"หน้าจอจะเปิดค้างขณะอ่าน":"ใช้เวลาปิดหน้าจอตามระบบ",Toast.LENGTH_SHORT).show();break;}}).show();}
    private void applyKeepScreen(){if(getPreferences(MODE_PRIVATE).getBoolean("keep",true))getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
    private void brightness(){SeekBar bar=new SeekBar(this);bar.setMax(90);float currentBrightness=getWindow().getAttributes().screenBrightness;bar.setProgress(currentBrightness<0?50:(int)(currentBrightness*100)-10);bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}public void onProgressChanged(SeekBar b,int p,boolean user){if(user){WindowManager.LayoutParams params=getWindow().getAttributes();params.screenBrightness=(p+10)/100f;getWindow().setAttributes(params);}}});new AlertDialog.Builder(this).setTitle("ความสว่างเฉพาะแอป").setView(bar).setPositiveButton("ปิด",null).setNeutralButton("ตามระบบ",(d,w)->{WindowManager.LayoutParams params=getWindow().getAttributes();params.screenBrightness=-1;getWindow().setAttributes(params);}).show();}
    @Override protected void onPause(){savePosition();super.onPause();}
    @Override public void onBackPressed(){if(!chrome){setChrome(true);return;}super.onBackPressed();}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);reader.dispose();super.onDestroy();}
}
