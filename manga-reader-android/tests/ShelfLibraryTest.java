package com.mangareader.app;
import java.util.*;
public final class ShelfLibraryTest {
    private static ShelfLibrary.Book book(String uri,String name){return new ShelfLibrary.Book(uri,name);}
    public static void main(String[] args){
        ShelfLibrary library=new ShelfLibrary();ShelfLibrary.Series a=library.create("เรื่อง A"),b=library.create("เรื่อง B");
        int added=library.add(a.id,Arrays.asList(book("content://10","ตอนที่ 10.pdf"),book("content://2","ตอนที่ 2.pdf"),book("content://1","ตอนที่ 1.pdf"),book("content://2","ตอนที่ 2.pdf")));
        if(added!=3||a.books.size()!=3||b.books.size()!=0)throw new AssertionError("group import or dedup");
        if(!a.books.get(0).uri.equals("content://1")||!a.books.get(2).uri.equals("content://10"))throw new AssertionError("numeric chapter sorting");
        library.add(b.id,Collections.singletonList(a.books.get(0)));library.removeBook(a.id,"content://1");
        if(a.books.size()!=2||b.books.size()!=1)throw new AssertionError("move between stories");
        if(ShelfLibrary.naturalCompare("ตอนที่ ๙.pdf","ตอนที่ 10.pdf")>=0||ShelfLibrary.naturalCompare("ตอนที่ 56.2.pdf","ตอนที่ 56.10.pdf")>=0)throw new AssertionError("Thai or decimal chapter order");
        b.name="ชื่อใหม่";if(!library.find(b.id).name.equals("ชื่อใหม่"))throw new AssertionError("rename loses id");
        library.removeSeries(a.id);if(library.find(a.id)!=null||library.find(b.id).books.size()!=1)throw new AssertionError("removal affects other stories");
        try{library.create("  ");throw new AssertionError("empty name accepted");}catch(IllegalArgumentException expected){}
        System.out.println("PASS: grouping, batch import, URI deduplication, natural chapter order, moving, renaming and isolated removal");
    }
}
