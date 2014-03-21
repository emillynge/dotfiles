(function(b){b.fn.wColorPicker=function(e,d){if(typeof e==="object"){d=e}else{if(typeof e==="string"){var c=[];var f=this.each(function(){var g=b(this).data("_wColorPicker");if(g){if(b.fn.wColorPicker.defaultSettings[e]!==undefined){if(d!==undefined){g.settings[e]=d}else{c.push(g.settings[e])}}}});if(c.length===1){return c[0]}if(c.length>0){return c}else{return f}}}d=b.extend({},b.fn.wColorPicker.defaultSettings,d||{});return this.each(function(){var h=b(this);var g=jQuery.extend(true,{},d);var j=new a(g,h);j.generate();j.appendToElement(h);j.colorSelect(j,g.initColor);h.data("_wColorPicker",j)})};b.fn.wColorPicker.defaultSettings={theme:"black",opacity:0.8,initColor:"#FF0000",onMouseover:null,onMouseout:null,onSelect:null,mode:"flat",buttonSize:20,effect:"slide",showSpeed:500,hideSpeed:500};function a(c,d){this.colorPicker=null;this.settings=c;this.$elem=d;this.currentColor=c.initColor;this.height=null;this.width=null;this.slideTopToBottom=null;this.customTarget=null;this.buttonColor=null;this.paletteHolder=null;return this}a.prototype={generate:function(){if(this.colorPicker){return this.colorPicker}var h=this;var f={clear:"both",height:0,lineHeight:0,fontSize:0};this.customTarget=b('<div class="_wColorPicker_customTarget"></div>');this.customInput=b('<input type="text" class="_wColorPicker_customInput" value=""/>').keyup(function(o){var n=(o.keyCode?o.keyCode:o.which);var m=h.validHex(b(this).val());b(this).val(m);if(m.length==7){h.customTarget.css("backgroundColor",m)}if(n==13){h.colorSelect(h,b(this).val());if(h.buttonColor){h.hidePalette(h)}}}).click(function(m){m.stopPropagation()});var c=b('<div class="_wColorPicker_custom"></div>').append(this.appendColors(b('<div class="_wColorPicker_noColor">'),[""],1)).append(this.customTarget).append(this.customInput).append(b("<div></div>").css(f));var d=["000000","333333","666666","999999","CCCCCC","FFFFFF","FF0000","00FF00","0000FF","FFFF00","00FFFF","FF00FF"];var j=this.appendColors(b('<div class="_wColorPicker_palette_simple"></div>'),d,1);var k=["000000","003300","006600","009900","00CC00","00FF00","330000","333300","336600","339900","33CC00","33FF00","660000","663300","666600","669900","66CC00","66FF00","000033","003333","006633","009933","00CC33","00FF33","330033","333333","336633","339933","33CC33","33FF33","660033","663333","666633","669933","66CC33","66FF33","000066","003366","006666","009966","00CC66","00FF66","330066","333366","336666","339966","33CC66","33FF66","660066","663366","666666","669966","66CC66","66FF66","000099","003399","006699","009999","00CC99","00FF99","330099","333399","336699","339999","33CC99","33FF99","660099","663399","666699","669999","66CC99","66FF99","0000CC","0033CC","0066CC","0099CC","00CCCC","00FFCC","3300CC","3333CC","3366CC","3399CC","33CCCC","33FFCC","6600CC","6633CC","6666CC","6699CC","66CCCC","66FFCC","0000FF","0033FF","0066FF","0099FF","00CCFF","00FFFF","3300FF","3333FF","3366FF","3399FF","33CCFF","33FFFF","6600FF","6633FF","6666FF","6699FF","66CCFF","66FFFF","990000","993300","996600","999900","99CC00","99FF00","CC0000","CC3300","CC6600","CC9900","CCCC00","CCFF00","FF0000","FF3300","FF6600","FF9900","FFCC00","FFFF00","990033","993333","996633","999933","99CC33","99FF33","CC0033","CC3333","CC6633","CC9933","CCCC33","CCFF33","FF0033","FF3333","FF6633","FF9933","FFCC33","FFFF33","990066","993366","996666","999966","99CC66","99FF66","CC0066","CC3366","CC6666","CC9966","CCCC66","CCFF66","FF0066","FF3366","FF6666","FF9966","FFCC66","FFFF66","990099","993399","996699","999999","99CC99","99FF99","CC0099","CC3399","CC6699","CC9999","CCCC99","CCFF99","FF0099","FF3399","FF6699","FF9999","FFCC99","FFFF99","9900CC","9933CC","9966CC","9999CC","99CCCC","99FFCC","CC00CC","CC33CC","CC66CC","CC99CC","CCCCCC","CCFFCC","FF00CC","FF33CC","FF66CC","FF99CC","FFCCCC","FFFFCC","9900FF","9933FF","9966FF","9999FF","99CCFF","99FFFF","CC00FF","CC33FF","CC66FF","CC99FF","CCCCFF","CCFFFF","FF00FF","FF33FF","FF66FF","FF99FF","FFCCFF","FFFFFF",];var l=this.appendColors(b('<div class="_wColorPicker_palette_mixed"></div>'),k,18);var e=b('<div class="_wColorPicker_bg"></div>').css({opacity:this.settings.opacity});var g=b('<div class="_wColorPicker_content"></div>').append(c).append(j).append(l).append(b("<div></div>").css(f));this.colorPicker=b('<div class="_wColorPicker_holder"></div>').click(function(m){m.stopPropagation()}).append(b('<div class="_wColorPicker_outer"></div>').append(b('<div class="_wColorPicker_inner"></div>').append(e).append(g))).addClass("_wColorPicker_"+this.settings.theme);return this.colorPicker},appendColors:function(g,e,d){var c=1;var f=this;for(index in e){g.append(b('<div id="_wColorPicker_color_'+c+'" class="_wColorPicker_color _wColorPicker_color_'+c+'"></div>').css("backgroundColor","#"+e[index]).click(function(){f.colorSelect(f,b(this).css("backgroundColor"))}).mouseout(function(h){f.colorHoverOff(f,b(this))}).mouseover(function(){f.colorHoverOn(f,b(this))}));if(c==d){g.append(b("<div></div>").css({clear:"both",height:0,fontSize:0,lineHeight:0,marginTop:-1}));c=0}c++}return g},colorSelect:function(d,c){c=d.toHex(c);d.customTarget.css("backgroundColor",c);d.currentColor=c;d.customInput.val(c);if(d.settings.onSelect){d.settings.onSelect.apply(this,[c])}if(d.buttonColor){d.buttonColor.css("backgroundColor",c);d.hidePalette(d)}},colorHoverOn:function(e,c){c.parent().children("active").removeClass("active");c.addClass("active").next().addClass("activeLeft");c.nextAll("."+c.attr("id")+":first").addClass("activeTop");var d=e.toHex(c.css("backgroundColor"));e.customTarget.css("backgroundColor",d);e.customInput.val(d);if(e.settings.onMouseover){e.settings.onMouseover.apply(this,[d])}},colorHoverOff:function(d,c){c.removeClass("active").next().removeClass("activeLeft");c.nextAll("."+c.attr("id")+":first").removeClass("activeTop");d.customTarget.css("backgroundColor",d.currentColor);d.customInput.val(d.currentColor);if(d.settings.onMouseout){d.settings.onMouseout.apply(this,[d.currentColor])}},appendToElement:function(c){var e=this;if(e.settings.mode=="flat"){c.append(e.colorPicker)}else{e.paletteHolder=b('<div class="_wColorPicker_paletteHolder"></div>').css({position:"absolute",overflow:"hidden",width:1000}).append(e.colorPicker);e.buttonColor=b('<div class="_wColorPicker_buttonColor"></div>').css({width:e.settings.buttonSize,height:e.settings.buttonSize});var d=b('<div class="_wColorPicker_buttonHolder"></div>').css({position:"relative"}).append(b('<div class="_wColorPicker_buttonBorder"></div>').append(e.buttonColor)).append(e.paletteHolder);c.append(d);e.width=e.colorPicker.outerWidth(true);e.height=e.colorPicker.outerHeight(true);e.paletteHolder.css({width:e.width,height:e.height}).hide();if(e.settings.effect=="fade"){e.paletteHolder.css({opacity:0})}if(e.settings.mode=="hover"){d.hover(function(f){e.showPalette(f,e)},function(f){e.hidePalette(e)})}else{if(e.settings.mode=="click"){b(document).click(function(){if(e.paletteHolder.hasClass("active")){e.hidePalette(e)}});d.click(function(f){f.stopPropagation();e.paletteHolder.hasClass("active")?e.hidePalette(e):e.showPalette(f,e)})}}e.colorSelect(e,e.settings.initColor)}},showPalette:function(g,f){var h=f.paletteHolder.parent().offset();var d=0;var c=f.paletteHolder.parent().outerHeight(true);f.slideTopToBottom=c;if(h.left-b(window).scrollLeft()+f.width>b(window).width()){d=-1*(f.width-f.paletteHolder.parent().outerWidth(true))}if(h.top-b(window).scrollTop()+f.height>b(window).height()){f.slideTopToBottom=0;c=-1*(f.height)}f.paletteHolder.css({left:d,top:c});f.paletteHolder.addClass("active");if(f.settings.effect=="slide"){f.paletteHolder.stop(true,false).css({height:0,top:(f.slideTopToBottom==0?0:c)}).show().animate({height:f.height,top:c},f.settings.showSpeed)}else{if(f.settings.effect=="fade"){f.paletteHolder.stop(true,false).show().animate({opacity:1},f.settings.showSpeed)}else{f.paletteHolder.show()}}},hidePalette:function(c){if(c.paletteHolder.hasClass("active")){c.paletteHolder.removeClass("active");if(c.settings.effect=="slide"){c.paletteHolder.stop(true,false).animate({height:0,top:(c.slideTopToBottom==0?0:c.slideTopToBottom)},c.settings.hideSpeed,function(){c.paletteHolder.hide()})}else{if(c.settings.effect=="fade"){c.paletteHolder.stop(true,false).animate({opacity:0},c.settings.hideSpeed,function(){c.paletteHolder.hide()})}else{c.paletteHolder.hide()}}}},toHex:function(c){if(c.substring(0,4)==="rgba"){e="transparent"}else{if(c.substring(0,3)==="rgb"){var d=c.substring(4,c.length-1).replace(/\s/g,"").split(",");for(i in d){d[i]=parseInt(d[i]).toString(16);if(d[i]=="0"){d[i]="00"}}var e="#"+d.join("").toUpperCase()}else{e=c}}return e},validHex:function(c){return"#"+c.replace(/[^0-9a-f]/ig,"").substring(0,6).toUpperCase()}}})(jQuery);