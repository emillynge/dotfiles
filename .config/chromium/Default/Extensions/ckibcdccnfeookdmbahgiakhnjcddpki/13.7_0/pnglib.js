if(false){tx=20;ty=500;var p=new PNGlib(tx,ty*5,256);chrome.tabs.captureVisibleTab({format:"png"},function(d){b=d;copy(d)});var i=new Image();i.src=b;c=document.createElement("canvas");ctx=c.getContext("2d");c.height=500;c.width=20;ctx.drawImage(i,0,0);var p=new PNGlib(tx,ty*5,256);pixels=ctx.getImageData(0,0,tx,ty).data;for(var j=0;j<=3;j++){for(var y=1;y<=ty;y++){for(var x=1;x<=tx;x++){firstPixel=((y-1)*tx+(x-1))*4;p.buffer[p.index(x-1,(y)+ty*j-1)]=p.color(pixels[firstPixel],pixels[firstPixel+1],pixels[firstPixel+2],255)}}}copy(p.getBase64())}(function(){function d(g,l){for(var k=2;k<arguments.length;k++){for(var h=0;h<arguments[k].length;h++){g[l++]=arguments[k].charAt(h)}}}function a(g){return String.fromCharCode((g>>8)&255,g&255)}function f(g){return String.fromCharCode((g>>24)&255,(g>>16)&255,(g>>8)&255,g&255)}function e(g){return String.fromCharCode(g&255,(g>>8)&255)}window.PNGlib=function(g,r,k){this.width=g;this.height=r;this.depth=k;this.pix_size=r*(g+1);this.data_size=2+this.pix_size+5*Math.floor((65534+this.pix_size)/65535)+4;this.ihdr_offs=0;this.ihdr_size=4+4+13+4;this.plte_offs=this.ihdr_offs+this.ihdr_size;this.plte_size=4+4+3*k+4;this.trns_offs=this.plte_offs+this.plte_size;this.trns_size=4+4+k+4;this.idat_offs=this.trns_offs+this.trns_size;this.idat_size=4+4+this.data_size+4;this.iend_offs=this.idat_offs+this.idat_size;this.iend_size=4+4+4;this.buffer_size=this.iend_offs+this.iend_size;this.buffer=new Array();this.palette=new Object();this.pindex=0;var m=new Array();for(var l=0;l<this.buffer_size;l++){this.buffer[l]="\x00"}d(this.buffer,this.ihdr_offs,f(this.ihdr_size-12),"IHDR",f(g),f(r),"\x08\x03");d(this.buffer,this.plte_offs,f(this.plte_size-12),"PLTE");d(this.buffer,this.trns_offs,f(this.trns_size-12),"tRNS");d(this.buffer,this.idat_offs,f(this.idat_size-12),"IDAT");d(this.buffer,this.iend_offs,f(this.iend_size-12),"IEND");var n=((8+(7<<4))<<8)|(3<<6);n+=31-(n%31);d(this.buffer,this.idat_offs+8,a(n));for(var l=0;(l<<16)-1<this.pix_size;l++){var s,q;if(l+65535<this.pix_size){s=65535;q="\x00"}else{s=this.pix_size-(l<<16)-l;q="\x01"}d(this.buffer,this.idat_offs+8+2+(l<<16)+(l<<2),q,e(s),e(~s))}for(var l=0;l<256;l++){var o=l;for(var h=0;h<8;h++){if(o&1){o=-306674912^((o>>1)&2147483647)}else{o=(o>>1)&2147483647}}m[l]=o}this.index=function(t,w){var v=w*(this.width+1)+t+1;var u=this.idat_offs+8+2+5*Math.floor((v/65535)+1)+v;return u};this.color=function(A,w,t,z){z=z>=0?z:255;var v=(((((z<<8)|A)<<8)|w)<<8)|t;if(typeof this.palette[v]=="undefined"){if(this.pindex==this.depth){return"\x00"}var u=this.plte_offs+8+3*this.pindex;this.buffer[u+0]=String.fromCharCode(A);this.buffer[u+1]=String.fromCharCode(w);this.buffer[u+2]=String.fromCharCode(t);this.buffer[this.trns_offs+8+this.pindex]=String.fromCharCode(z);this.palette[v]=String.fromCharCode(this.pindex++)}return this.palette[v]};this.getBase64=function(){var G=this.getDump();var u="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";var B,z,w,F,E,D,C;var v=G.length;var A=0;var t="";do{B=G.charCodeAt(A);F=B>>2;z=G.charCodeAt(A+1);E=((B&3)<<4)|(z>>4);w=G.charCodeAt(A+2);if(v<A+2){D=64}else{D=((z&15)<<2)|(w>>6)}if(v<A+3){C=64}else{C=w&63}t+=u.charAt(F)+u.charAt(E)+u.charAt(D)+u.charAt(C)}while((A+=3)<v);return t};this.getDump=function(){var u=65521;var z=5552;var w=1;var v=0;var C=z;for(var B=0;B<this.height;B++){for(var t=-1;t<this.width;t++){w+=this.buffer[this.index(t,B)].charCodeAt(0);v+=w;if((C-=1)==0){w%=u;v%=u;C=z}}}w%=u;v%=u;d(this.buffer,this.idat_offs+this.idat_size-8,f((v<<16)|w));function A(H,G,E){var F=-1;for(var D=4;D<E-4;D+=1){F=m[(F^H[G+D].charCodeAt(0))&255]^((F>>8)&16777215)}d(H,G+E-4,f(F^-1))}A(this.buffer,this.ihdr_offs,this.ihdr_size);A(this.buffer,this.plte_offs,this.plte_size);A(this.buffer,this.trns_offs,this.trns_size);A(this.buffer,this.idat_offs,this.idat_size);A(this.buffer,this.iend_offs,this.iend_size);return"\211PNG\r\n\032\n"+this.buffer.join("")}}})();