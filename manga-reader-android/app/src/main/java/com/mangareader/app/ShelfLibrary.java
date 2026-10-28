package com.mangareader.app;

import java.util.*;

/** A shelf contains references only; removing an entry never deletes a document. */
public final class ShelfLibrary {
    public static final class Book {
        public final String uri,name;
        public Book(String uri,String name){this.uri=uri;this.name=name;}
    }
    public static final class Series {
        public final String id;
        public String name;
        public final List<Book> books=new ArrayList<>();
        public Series(String id,String name){this.id=id;this.name=name;}
    }
    public final List<Series> series=new ArrayList<>();
    public Series find(String id){for(Series item:series)if(item.id.equals(id))return item;return null;}
    public Series create(String name){name=name.trim();if(name.isEmpty())throw new IllegalArgumentException("Empty series");Series item=new Series(UUID.randomUUID().toString(),name);series.add(item);return item;}
    public int add(String id,List<Book> books){Series target=find(id);if(target==null)throw new IllegalArgumentException("Missing series");int added=0;for(Book book:books){boolean duplicate=false;for(Book old:target.books)if(old.uri.equals(book.uri)){duplicate=true;break;}if(!duplicate){target.books.add(book);added++;}}target.books.sort((a,b)->naturalCompare(a.name,b.name));return added;}
    public void removeSeries(String id){series.removeIf(item->item.id.equals(id));}
    public void removeBook(String id,String uri){Series target=find(id);if(target!=null)target.books.removeIf(item->item.uri.equals(uri));}
    public static int naturalCompare(String left,String right){
        int a=0,b=0;
        while(a<left.length()&&b<right.length()){
            char x=left.charAt(a),y=right.charAt(b);
            if(Character.isDigit(x)&&Character.isDigit(y)){
                StringBuilder aa=new StringBuilder(),bb=new StringBuilder();
                while(a<left.length()&&Character.isDigit(left.charAt(a)))aa.append(Character.digit(left.charAt(a++),10));
                while(b<right.length()&&Character.isDigit(right.charAt(b)))bb.append(Character.digit(right.charAt(b++),10));
                java.math.BigInteger na=new java.math.BigInteger(aa.toString()),nb=new java.math.BigInteger(bb.toString());int comparison=na.compareTo(nb);if(comparison!=0)return comparison;
            }else{int comparison=Character.compare(Character.toLowerCase(x),Character.toLowerCase(y));if(comparison!=0)return comparison;a++;b++;}
        }
        return Integer.compare(left.length()-a,right.length()-b);
    }
}
