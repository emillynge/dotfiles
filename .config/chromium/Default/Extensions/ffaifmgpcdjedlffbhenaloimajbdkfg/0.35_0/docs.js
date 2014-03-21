var HEIGHT = 362;
var WIDTH = 567;

function pugcp_docs() {
	var url = document.location.href.toString();
	var pattern = new RegExp('^http..//docs[0-9]?\.google\.com/document/d/','i');
	
	if ( pattern.test( url ) ) {
		var print_button = document.getElementById( ':49' );
		
		if ( print_button == null )
			print_button = document.getElementById( ':6e' );

			
		if ( print_button )  {
			var pugcp_button = document.createElement( 'div' );
			
			print_button.parentNode.appendChild( pugcp_button );
			
			pugcp_button.innerHTML = '<div class="goog-menuitem-content" style="-webkit-user-select: none; "><div class="docs-icon goog-inline-block goog-menuitem-icon" style="-webkit-user-select: none; "><div class="docs-icon-img-container docs-icon-img docs-icon-print" style="-webkit-user-select: none; "></div></div>Print using Google Cloud Print</div>';
			
			pugcp_button.setAttribute( 'class', 'goog-menuitem pugcp_print_submenu' )
			pugcp_button.setAttribute( 'role', 'menuitem' );
			pugcp_button.setAttribute( 'style', '-webkit-user-select: none;' );
			
			pugcp_button.onclick = pugcp_docs_onclick;
			
			injectCSS( '.pugcp_print_submenu:hover { background-color: #D6E9F8;border-color: #D6E9F8;border-style: dotted;border-width: 1px 0;padding-bottom: 3px;padding-top: 3px; }' );
		} else
			setTimeout( pugcp_docs, 1000 );
	}
}

function pugcp_docs_onclick() {
	var x = document.location.href.toString().split( '/' ); 
	var content = ( x[ x.length - 2 ] );
	
	var title_element = document.getElementsByClassName('docs-title-inner')[0];
	
	if ( title_element != undefined )
		var title = title_element.innerText;
	else
		var title = 'Google Docs Document';
	
	chrome.extension.sendRequest({'action': 'getURL', 'src': 'print.html'}, function( pugcp_print_url ) {
		popup_center( pugcp_print_url + '?source=docs&act=print_document&content=' + encodeURIComponent( content ) + '&title=' + encodeURIComponent( title ), 'Print Using Google Cloud Print', WIDTH, HEIGHT );
	} );
}

function injectCSS( style ) {
	var script = document.createElement( 'style' );
	
	document.body.appendChild( script );
	
	script.setAttribute( 'type', 'text/css' );
	script.innerHTML = style;
}

function popup_center( pageURL, title, w, h ) {
	var left = ( screen.width / 2 ) - ( w / 2 );
	var top = ( screen.height / 2 ) - ( h / 2 );
	
	var targetWin = window.open ( pageURL, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left );
}

pugcp_docs();