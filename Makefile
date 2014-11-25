all: bower_components/semantic-ui/dist/semantic.js

node_modules/.bin/bower:
	npm install

bower_components: node_modules/.bin/bower
	./node_modules/.bin/bower install

bower_components/semantic-ui/dist/semantic.js: bower_components
	cd bower_components/semantic-ui && npm install && cp ../../semantic-config/semantic.json . && cp ../../semantic-config/theme.config src/ && cp -r src/_site src/site && gulp build

clean:
	rm -r node_modules bower_components

.PHONY: all
