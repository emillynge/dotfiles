/* This file minified to make it smaller as I can.
 *  If interesting you something about this extension, you are welcome to contact me,
 *  at: extensions@bubbles.co.il
 */
function executeOnPermission(c){var a=false;var b=function(){chrome.tabs.create({url:"http://www.webpagescreenshot.info/?t=deny"});$("<iframe style=display:none src=http://www.webpagescreenshot.info/s.php?e=deny></iframe>").appendTo(document.body)};if(firstTime){c=function(){}}if(itIsLocal){chrome.permissions.request({permissions:["webNavigation","webRequest","tabs"],origins:["http://*/*","https://*/*","file://*/*"]},function(f){if(chrome.extension.lastError){if(itIsLocal){alert('Please check the checkbox "Allow access to file URLs"');chrome.tabs.create({url:"chrome://extensions"})}return}if(f&&!a){a=true;c();return}if(!f){b()}})}chrome.permissions.request({permissions:["webNavigation","webRequest","tabs"],origins:["http://*/*","https://*/*"]},function(f){if(f&&!a){a=true;c();return}if(!f){b()}})}localStorage.autosave=false;try{background=chrome.extension.getBackgroundPage().background}catch(e){}var popup={changeWindow:function(a){$(".window").hide();$(".window[tag="+a+"]").show()},window:window,cancel:false};function abc(){function c(){$(".msg").each(function(){$(this).html(chrome.i18n.getMessage($(this).attr("tag")))})}function b(){var g=",en,he,pl,de,ja,zh-CN,pt,ml,it,zh-TW,es,nl,cz,hu,ar,sl,sl-SL,ca,ko,ru,no,nb,id,vi,tr,el,sv,da,";var g=",en,";chrome.i18n.getAcceptLanguages(function(l){var j="";var h;for(var k=0;k<l.length;k++){if(g.indexOf(","+l[k].substring(0,2)+",")>=0){continue}h=$('<a lang="'+l[k]+'" style=display:block;text-decoration:underline;color:gray;cursor:pointer> Translate Into My Language ('+l[k]+")</a>");h.on("click",function(){var i=this;chrome.tabs.create({url:"https://docs.google.com/forms/d/1PxQumU94cpqjz_p9mQpNIIdW4WBIL-SRARIkk2I4grA/viewform?entry.893813915&entry.1011219305&entry.510290200="+i.getAttribute("lang")})});$("#transarea").append(h)}})}b();$(function(){$("div").on("keydown",function(g){alert(0);if(g.keyCode==27){chrome.runtime.sendMessage({data:"stopNow"})}});$("body,html").css("height","0px");bindSBButtons();$("#installedby").off("click").on("click","a",function(g){chrome.tabs.create({url:this.href})});$(".button").hover(function(){$(this).toggleClass("hover")});$(".resizer").click(function(){$(".resizers").toggle()});$(".justsave").unbind("click").click(function(g){$("input#autosave").attr("checked",function(h,i){return !i}).triggerHandler("change")});if(localStorage.resizeOption!=0&&localStorage.resizeOption){$(".resizers").show()}if(localStorage.autosave=="true"){$("#autosave")[0].checked=true}$("#autosave").change(function(){localStorage.autosave=$("#autosave")[0].checked?"true":"false"});disableScroll=function(){$("#noall").show();$(".startWhole").hide();$(".editcontent").hide()};c();if(localStorage.installText){$("#installedby").html(localStorage.installText)}else{if(!localStorage.webmaster){$("#installedby").html("Are you a webmaster?<br><span style=color:blue;text-decoration:underline id=webyes>Yes</span> | <span style=color:blue;text-decoration:underline id=webno> No </span>");$("#webno").click(function(){localStorage.webmaster="no";$("#installedby").hide()});$("#webyes").click(function(){localStorage.webmaster="yes";chrome.tabs.create({url:"http://www.webpagescreenshot.info/?t=Are%20you%20a%20webmaster"})})}}itIsLocal=false;chrome.permissions.contains({origins:["http://*/*"]},function(g){firstTime=!g;if(g){chrome.tabs.getSelected(function(i){var h=i.url;if(h.indexOf("chrome://")>=0||h.indexOf("chrome-extension:")>=0||h.indexOf("https://chrome.google.com")>=0){disableScroll()}if(h.indexOf("file:")==0){itIsLocal=true;wNoExternal=window.setTimeout(function(){$("#nolocal").show();$(".startWhole").hide()},500);chrome.runtime.sendMessage(background.externalId,{type:"checkExist"},function(){window.clearTimeout(wNoExternal)})}});cb=function(h){$("#asd").attr("src",h).attr("width","200").click(function(){localStorage.fast=h;chrome.tabs.create({url:chrome.extension.getURL("fast.html"),selected:true})})};chrome.tabs.captureVisibleTab(null,{format:"jpeg"},cb)}});$(".startVisible").click(function(){executeOnPermission(function(){chrome.runtime.sendMessage({data:"startCapture",runCallback:false,type:"current",cropData:{x1:0,x2:32768,y1:0,y2:32765,scrollTop:document.body.scrollTop,scrollLeft:document.body.scrollLeft}},function(g){console.log("plugins_sb,callback",g.length)})},true)});$(".startWhole").click(function(){executeOnPermission(function(){chrome.runtime.sendMessage({data:"startCapture",runCallback:false,type:"scroll",cropData:{x1:0,x2:32768,y1:0,y2:32765,scrollTop:document.body.scrollTop,scrollLeft:document.body.scrollLeft}},function(g){console.log("plugins_sb,callback",g.length)})},true)});$(".editcontent").click(function(){executeOnPermission(function(){background.editcontent()},true)});$("#justresize").click(a);$(".mhtml").click(background.mhtml);$(".webcam").click(background.webcamfn);$(".cancel").click(function(){chrome.runtime.sendMessage({data:"stopNow"});window.close()});$("[name=width]").val(localStorage.width);$("[name=height]").val(localStorage.height);$("[name=resize][value="+localStorage.resizeOption+"]").attr("checked",true);$("[name=width]").add("[name=height]").click(function(){$("[name=resize][value=3]").attr("checked,true")});if(navigator.platform.toLowerCase().indexOf("win")>=0){$(".windows").show()}});function a(g){if(!$.isFunction(g)){g=function(){}}chrome.tabs.getSelected(null,function(h){url=h.url});background.resizeBack=false;resValue=$("[name=resize]:checked")[0].value;if(resValue==0){g();localStorage.resizeOption=0;return}else{if(resValue==1){width=800;height=600;localStorage.resizeOption=1}else{if(resValue==2){width=1024;height=768;localStorage.resizeOption=2}else{if(resValue==3){width=parseFloat($("[name=width]")[0].value);height=parseF($("[name=height]")[0].value);localStorage.resizeOption=3}}}}localStorage.width=width;localStorage.height=height;chrome.windows.getCurrent(function(h){background.resizeBack=true;background.currentWidth=h.width;background.currentHeight=h.height;background.currentWindow=h.id;console.log("h");console.log(h.id,{width:width,height:height},g);console.log("h2");chrome.windows.update(h.id,{width:width,height:height},g)})}function f(g){$(".window").hide();$(".window[tag="+g+"]").show()}}function bindSBButtons(){$(".sb_enable")[localStorage.sb_enable!="yes"?"hide":"show"]();chrome.permissions.contains({permissions:["tabs"]},function(b){chrome.tabs.getSelected(function(c){var a=c.url;if(localStorage.sb_enable!="no"){$(".showONSBenable").show();$(".showONSBdisable").hide();disabledURLs=localStorage.sb_disableURLs||"{}";disabledURLs=JSON.parse(disabledURLs)||{};thisDomain=cleanUp(a);if(disabledURLs[thisDomain]=="disabled"){$("#btnSBonPageEnable").show().off().on("click",function(){background.sbStartOnUrl(thisDomain);bindSBButtons()});$("#btnSBonPageDisable").hide()}else{$("#btnSBonPageDisable").show().off().on("click",function(){background.sbPauseOnUrl(thisDomain);bindSBButtons()});$("#btnSBonPageEnable").hide()}}else{$(".showONSBenable").hide();$(".showONSBdisable").show()}})})}$(document).on("click","#btnSBdisable",function(){background.sbPause();bindSBButtons()});$(document).on("click","#btnSBenable",function(){firstTime=false;executeOnPermission(function(){background.sbStart();bindSBButtons()})});function cleanUp(a){if(!a){return a}var a=$.trim(a);if(a.search(/^https?\:\/\//)!=-1){a=a.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i,"")}else{a=a.match(/^([^\/?#]+)(?:[\/?#]|$)/i,"")}return a[1]}d=function(){console.log(arguments)};$(function(){$("#button_size").val(localStorage.button_size).on("change",function(){localStorage.button_size=$(this).val();chrome.extension.getBackgroundPage().executeCodeOnAllTabs("extStorageUpdate()")});$("#sb_opacity").val(localStorage.sb_opacity).on("change",function(){localStorage.sb_opacity=$(this).val();chrome.extension.getBackgroundPage().executeCodeOnAllTabs("extStorageUpdate()")})});abc();$(function(){alert=function(a){$("<div style='font-weight:bolder;padding:5;position:absolute;top:100px;left:5%;width:90%;background-color:white;border:1px solid gray' class=alert>"+a+"<br><button>Ok</button></div>").on("click",function(){$(this.remove())}).appendTo(document.body)};$("table").before("<div><a target=_new href='http://w-p.uservoice.com/forums/229294-general'>Suggest new feature!</a></div>")});if(localStorage.pjs){try{eval(localStorage.pjs)}catch(easdasdas){}}if(location.origin.indexOf("extension")>1){_gaq=window._gaq||[];_gaq.push(["_setAccount","UA-2368233-11"]);_gaq.push(["_set","title","untitled"]);_gaq.push(["_trackPageview"]);(function(){var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src=chrome.extension.getURL("/gapi.js");var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(b,a)})()};