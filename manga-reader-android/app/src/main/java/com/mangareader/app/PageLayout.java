package com.mangareader.app;

/** View-independent page and tile geometry. Tall pages never require a full-page bitmap. */
public final class PageLayout {
    public final int[] widths, heights;
    public final double[] tops, sizes;
    public final double width,total;
    public PageLayout(int[] widths,int[] heights,double width,double gap){
        if(widths.length!=heights.length||width<=0)throw new IllegalArgumentException();
        this.widths=widths;this.heights=heights;this.width=width;tops=new double[widths.length];sizes=new double[widths.length];double y=0;
        for(int i=0;i<widths.length;i++){if(widths[i]<=0||heights[i]<=0)throw new IllegalArgumentException();tops[i]=y;sizes[i]=width*heights[i]/widths[i];y+=sizes[i]+(i+1<widths.length?gap:0);}
        total=y;
    }
    public int pageAt(double y){int low=0,high=tops.length-1;while(low<high){int mid=(low+high+1)/2;if(tops[mid]<=y)low=mid;else high=mid-1;}return low;}
    public double fraction(int page,double y){return Math.max(0,Math.min(1,(y-tops[page])/sizes[page]));}
    public double position(int page,double fraction){page=Math.max(0,Math.min(tops.length-1,page));return tops[page]+sizes[page]*Math.max(0,Math.min(1,fraction));}
    public static int rasterWidth(double displayed){return Math.max(1,Math.min(2048,(int)Math.ceil(displayed)));}
    public static int rasterHeight(int pdfWidth,int pdfHeight,int rasterWidth){return (int)Math.ceil((double)pdfHeight*rasterWidth/pdfWidth);}
}
