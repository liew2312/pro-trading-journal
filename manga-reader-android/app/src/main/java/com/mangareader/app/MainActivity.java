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

public class MainActivity extends Activity implements PdfView.Listener {
    private PdfView reader;
    private LinearLayout header,footer;
    private TextView title,progress;
    private SeekBar seek;
    private Uri current;
    private String currentName="Manga Reader";
    private int pageCount;
    private boolean chrome=true,dragging,opening;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable saveTask=this::savePosition;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().setStatusBarColor(0xff1c1938);getWindow().setNavigationBarColor(0xff111218);
        LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(0xff111218);
        root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});setContentView(root);
        header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setBackgroundColor(0xff1c1938);root.addView(header);
        title=new TextView(this);title.setText("Manga Reader 0.1");title.setTextSize(14);title.setSingleLine();title.setEllipsize(TextUtils.TruncateAt.END);title.setPadding(dp(10),0,dp(4),0);header.addView(title,new LinearLayout.LayoutParams(0,dp(44),1));title.setGravity(Gravity.CENTER_VERTICAL);
        button(header,"เปิด",this::pick);button(header,"ล่าสุด",this::recents);button(header,"เมนู",this::menu);
        reader=new PdfView(this);reader.listener=this;root.addView(reader,new LinearLayout.LayoutParams(-1,0,1));
        footer=new LinearLayout(this);footer.setOrientation(1);footer.setPadding(dp(10),0,dp(10),dp(4));root.addView(footer);
        progress=new TextView(this);progress.setText("PDF ในเครื่อง · ไม่ต้องใช้อินเทอร์เน็ต");progress.setTextSize(11);footer.addView(progress);progress.setOnClickListener(v->jumpDialog());
        seek=new SeekBar(this);seek.setMax(1000);footer.addView(seek,new LinearLayout.LayoutParams(-1,dp(28)));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar b){dragging=true;}public void onStopTrackingTouch(SeekBar b){reader.seek(b.getProgress()/1000.0);dragging=false;savePosition();}public void onProgressChanged(SeekBar b,int value,boolean user){if(user)reader.seek(value/1000.0);}});
        applyKeepScreen();
        if(getIntent().getData()!=null)open(getIntent().getData());
        else {String last=getPreferences(MODE_PRIVATE).getString("last",null);if(last!=null)open(Uri.parse(last));}
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void button(LinearLayout row,String text,Runnable action){Button b=new Button(this);b.setText(text);b.setTextSize(11);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(0);b.setMinimumHeight(0);b.setPadding(dp(5),0,dp(5),0);row.addView(b,new LinearLayout.LayoutParams(dp(54),dp(40)));b.setOnClickListener(v->action.run());}
    private void pick(){if(opening)return;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/pdf").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(intent,1);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==1&&result==RESULT_OK&&data!=null&&data.getData()!=null){try{getContentResolver().takePersistableUriPermission(data.getData(),data.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(SecurityException ignored){}open(data.getData());}}
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
    private void menu(){new AlertDialog.Builder(this).setTitle("Manga Reader 0.1").setItems(new String[]{"เปิด PDF", "ไปยังหน้า…", "ซูมพอดีความกว้าง", "อ่านเต็มจอ", "ปรับความสว่าง", "เปิด/ปิดหน้าจอค้าง"},(d,which)->{switch(which){case 0:pick();break;case 1:jumpDialog();break;case 2:reader.resetZoom();break;case 3:setChrome(false);break;case 4:brightness();break;case 5:boolean keep=!getPreferences(MODE_PRIVATE).getBoolean("keep",true);getPreferences(MODE_PRIVATE).edit().putBoolean("keep",keep).apply();applyKeepScreen();Toast.makeText(this,keep?"หน้าจอจะเปิดค้างขณะอ่าน":"ใช้เวลาปิดหน้าจอตามระบบ",Toast.LENGTH_SHORT).show();break;}}).show();}
    private void applyKeepScreen(){if(getPreferences(MODE_PRIVATE).getBoolean("keep",true))getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
    private void brightness(){SeekBar bar=new SeekBar(this);bar.setMax(90);float currentBrightness=getWindow().getAttributes().screenBrightness;bar.setProgress(currentBrightness<0?50:(int)(currentBrightness*100)-10);bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}public void onProgressChanged(SeekBar b,int p,boolean user){if(user){WindowManager.LayoutParams params=getWindow().getAttributes();params.screenBrightness=(p+10)/100f;getWindow().setAttributes(params);}}});new AlertDialog.Builder(this).setTitle("ความสว่างเฉพาะแอป").setView(bar).setPositiveButton("ปิด",null).setNeutralButton("ตามระบบ",(d,w)->{WindowManager.LayoutParams params=getWindow().getAttributes();params.screenBrightness=-1;getWindow().setAttributes(params);}).show();}
    @Override protected void onPause(){savePosition();super.onPause();}
    @Override public void onBackPressed(){if(!chrome){setChrome(true);return;}super.onBackPressed();}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);reader.dispose();super.onDestroy();}
}
