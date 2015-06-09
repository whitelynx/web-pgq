all: static/vendor/semantic-ui/dist/semantic.js

node_modules/.bin/bower:
	npm install

static/vendor: node_modules/.bin/bower
	./node_modules/.bin/bower install

static/vendor/semantic-ui/dist/semantic.js: static/vendor
	cd static/vendor/semantic-ui && npm install && cp ../../semantic-config/semantic.json . && cp ../../semantic-config/theme.config src/ && cp -r src/_site src/site && gulp build

clean:
	rm -r node_modules static/vendor

.PHONY: all
