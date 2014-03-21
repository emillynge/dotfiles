var SELECTOR_SIDEBAR = '.nH .hj:not([pugpc_x])';
var SELECTOR_TITLE = 'h1>span';
var SELECTOR_ATTACHMENT = '.hq.gt b:not([pugpc_x])';

var HEIGHT = 362;
var WIDTH = 567;

var onDomNodeChangeLocked = false;

var printDialog = null;

function getQueryVariable( variable, url ) {
	if ( url == undefined )
		url = window.location.toString();
	var query = url.substring(1);
	var vars = query.split("&");
	
	for (var i=0;i<vars.length;i++) {
		var pair = vars[i].split("=");
		if (pair[0] == variable) {
			return decodeURIComponent( pair[1] );
		}
	}
	
	return null;
} 
		
function throttle( fn, delay, var_args ) {
	var_args = Array.prototype.slice.call( arguments, 2 ) || [];
	var timer;
	var self;
	var fn2 = function() {
		timer = null;
		fn.apply( self, var_args );
	};

	var fn3 = function() {
		if ( timer ) {
			window.clearTimeout( timer );
		}
		
		self = this;
		timer = window.setTimeout( fn2, delay );
	};
	
	return fn3;
}

function waitForContentFrame() {
	var frame = document.getElementById( 'canvas_frame' );
	
	if ( !frame || !frame.contentDocument ) {
		window.setTimeout( arguments.callee, 500 );
		return;
	}
	
	onContentReady( frame.contentDocument );
}

function onContentReady( doc ) {
	var fn = throttle( onDomNodeChange, 600, doc );
	doc.addEventListener( 'DOMSubtreeModified', fn, false );
	doc.addEventListener( 'DOMAttrModified', fn, false );
}

function onDomNodeChange( doc ) {
	if ( onDomNodeChangeLocked )
		return;

	onDomNodeChangeLocked = true;
	
	var sidebar = doc.querySelector( SELECTOR_SIDEBAR );
	
	if ( sidebar != null )
		sidebar_found( doc, sidebar );
	
	var attachments = doc.querySelectorAll( SELECTOR_ATTACHMENT );
	
	for (var i = 0, attachment; attachment = attachments[i]; i++)
		attachment_found( doc, attachment );
	
	onDomNodeChangeLocked = false;
}

function attachment_found( doc, attachment ) {
	if ( attachment.getAttribute( 'pugpc_x' ) )
		return;
		
	// Mark as used.
	attachment.setAttribute( 'pugpc_x', 'y' );
	
	var ext = attachment.innerText.toString().substring( attachment.innerText.toString().length - 4 );
	
	if ( ext == '.doc' || ext == '.pdf' || ext == '.txt' ) {
		var a = doc.createElement( 'a' );
		
		attachment.parentNode.appendChild( a );
		
		a.setAttribute( 'href', '#' );
		a.onclick = function() { pugcp( doc, attachment.innerText.toString(), attachment ) };
		a.innerText = 'Print attachment using Google Cloud Print';
	}

}

function sidebar_found( doc, sidebar ) {
	if ( sidebar.getAttribute( 'pugpc_x' ) )
		return;
		
	// Mark as used.
	sidebar.setAttribute( 'pugpc_x', 'y' );
	
	var a = doc.createElement('div');
	sidebar.insertBefore( a, sidebar.firstChild.nextSibling.nextSibling );
	a.setAttribute( 'class', 'hk' );
	
	var b = doc.createElement('span');
	a.appendChild(b);
	a.setAttribute( 'id', ':oq' );
	
	var c = doc.createElement('span');
	b.appendChild(c);
	c.innerHTML = '<img class="g1" src="images/cleardot.gif" alt=""> <u class=" ou ">Print all using Google Cloud Print</u>';
	c.onclick = function() { paugcp( doc ) };
	c.setAttribute( 'id', ':oq' );
}

function popup_center( pageURL, title, w, h ) {
	var left = ( screen.width / 2 ) - ( w / 2 );
	var top = ( screen.height / 2 ) - ( h / 2 );
	
	var targetWin = window.open ( pageURL, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left );
}

//Print all using Google Cloud Print
function paugcp( doc ) {
	var x = document.location.href.toString().split( '/' ); 
	var thid = ( x[ x.length - 1 ] );
	var title_element = doc.querySelector( SELECTOR_TITLE );
	
	if ( title_element != null )
		var title = title_element.innerText;
	else
		var title = 'Email';
	
	popup_center( chrome.extension.getURL( 'print.html?source=gmail&act=print_all&thid=' + encodeURIComponent( thid ) + '&title=' + encodeURIComponent( title ) ), 'Print Using Google Cloud Print', WIDTH, HEIGHT );
}

//Print (attachment) using Google Cloud Print
function pugcp( doc, title, element ) {
	var download_url = element.parentNode.getElementsByTagName( 'span' )[0].firstChild.href;
	var attid = getQueryVariable( 'attid', download_url );
	var thid = getQueryVariable( 'th', download_url );
	
	popup_center( chrome.extension.getURL( 'print.html?source=gmail&act=print_att&thid=' + encodeURIComponent( thid ) + '&attid=' + encodeURIComponent( attid ) + '&title=' + encodeURIComponent( title ) ), 'Print Using Google Cloud Print', WIDTH, HEIGHT );
}
waitForContentFrame();