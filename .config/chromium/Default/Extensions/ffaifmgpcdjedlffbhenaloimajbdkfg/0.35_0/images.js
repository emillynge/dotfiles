var HEIGHT = 362;
var WIDTH = 567;

function pugcp_images() {
	var image_link = document.querySelector( 'html body div div div ul li a' );
	var ext = image_link.getAttribute( 'href' ).toString().toLowerCase().substring( image_link.getAttribute( 'href' ).toString().length - 4 );
	
	if ( ext == '.jpg' || ext == 'jpeg' ) {
		var print_link = document.createElement( 'li' );
		
		image_link.parentNode.parentNode.appendChild( print_link );
		
		print_link.innerHTML = '<a href="javascript:void(0)">Print using Google Cloud Print</a>';
		
		print_link.style.marginTop = '5px';
		
		print_link.onclick = function() { pugcp_images_onclick( image_link.getAttribute( 'href' ).toString() ) };
	}
}

function pugcp_images_onclick( url ) {
	chrome.extension.sendRequest({'action': 'getURL', 'src': 'print.html'}, function( pugcp_print_url ) {
		popup_center( pugcp_print_url + '?source=images&act=print_image&url=' + encodeURIComponent( url ), 'Print Using Google Cloud Print', WIDTH, HEIGHT );
	} );
}

function popup_center( pageURL, title, w, h ) {
	var left = ( screen.width / 2 ) - ( w / 2 );
	var top = ( screen.height / 2 ) - ( h / 2 );
	
	var targetWin = window.open ( pageURL, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left );
}

pugcp_images();