all: bower_components/openlayers3/build/ol.js

node_modules/.bin/bower:
	npm install

bower_components/openlayers3: node_modules/.bin/bower
	./node_modules/.bin/bower install

# Since openlayers3 doesn't actually include a built ol.js in their bower package, we need to build it manually:
bower_components/openlayers3/build/ol.js: bower_components/openlayers3
	cd bower_components/openlayers3 && npm install && python2 build.py

clean:
	rm -r node_modules bower_components

.PHONY: all
