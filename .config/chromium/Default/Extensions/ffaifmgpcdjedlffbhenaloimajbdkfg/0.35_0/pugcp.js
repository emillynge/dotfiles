function injectJavascript( src ) {
	var script = document.createElement( 'script' );
	
	document.body.appendChild( script );
	
	script.setAttribute( 'type', 'text/javascript' );
	script.setAttribute( 'src', src );
}

function leftEquals( str, equals ){
    var n = String( equals ).length;
    
    if ( n > String( str ).length )
        return false;
    else
        return ( String( str ).substring( 0, n ) == equals );
}



var url = document.location.href.toString();

if ( leftEquals( url, 'http://mail' ) || leftEquals( url, 'https://mail' ) )
	chrome.extension.sendRequest({'action': 'injectJavascript', 'src': 'gmail.js'}, function() {} );
else if ( leftEquals( url, 'http://docs' ) || leftEquals( url, 'https://docs' ) )
	chrome.extension.sendRequest({'action': 'injectJavascript', 'src': 'docs.js'}, function() {} );
else if ( leftEquals( url, 'http://images.google.com/imgres' ) || leftEquals( url, 'https://images.google.com/imgres' ) )
	chrome.extension.sendRequest({'action': 'injectJavascript', 'src': 'images.js'}, function() {} );