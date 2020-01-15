;(function(p,l,o,w) {
	"p:nomunge, l:nomunge, o:nomunge, w:nomunge";

	// Stop if the Snowplow namespace i already exists
	if (!p[o]) { 
	
		// Initialise the 'GlobalSnowplowNamespace' array
		p['GlobalSnowplowNamespace'] = p['GlobalSnowplowNamespace'] || [];
	
		// Add the new Snowplow namespace to the global array so sp.js can find it
		p['GlobalSnowplowNamespace'].push(o);
	
		// Create the Snowplow function
		p[o] = function() {
			(p[o].q = p[o].q || []).push(arguments);
		};
	
		// Initialise the asynchronous queue
		p[o].q = p[o].q || [];
	}
} (window, document, 'new_name_here'));