package com.mangareader.app;

public final class PageLayoutTest {
    private static void near(double actual,double expected){if(Math.abs(actual-expected)>0.001)throw new AssertionError(actual+" != "+expected);}
    public static void main(String[] args){
        PageLayout layout=new PageLayout(new int[]{595,595},new int[]{14000,284},1190,8);
        near(layout.sizes[0],28000);near(layout.tops[1],28008);near(layout.total,28576);
        if(layout.pageAt(28008)!=1||layout.pageAt(1000)!=0)throw new AssertionError("page lookup");
        near(layout.position(0,0.5),14000);near(layout.fraction(0,14000),0.5);
        PageLayout rotated=new PageLayout(layout.widths,layout.heights,1785,8);
        near(rotated.fraction(0,rotated.position(0,0.5)),0.5);
        if(PageLayout.rasterWidth(10000)!=2048)throw new AssertionError("raster width unbounded");
        int rasterHeight=PageLayout.rasterHeight(595,14000,2048);
        if(rasterHeight<48000)throw new AssertionError("long page geometry");
        if(2048L*512*4>4*1024*1024)throw new AssertionError("tile too large");
        near(layout.position(1,2),layout.total);near(layout.position(0,-1),0);
        System.out.println("PASS: long-page sizing, page lookup, saved reading position, rotation, raster cap and bounded tile memory");
    }
}
