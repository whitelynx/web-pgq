all: static/vendor/semantic-ui/dist/semantic.js

node_modules/.bin/bower:
	npm install

static/vendor: node_modules/.bin/bower
	./node_modules/.bin/bower install

static/vendor/semantic-ui/dist/semantic.js: static/vendor
	# Unintuitively, the working directory is reset to the top-level directory before running each line below.
	sed -i '/^    "install": "gulp install"/d' static/vendor/semantic-ui/package.json
	cd static/vendor/semantic-ui && npm install
	cp semantic-config/semantic.json static/vendor/semantic-ui
	cp semantic-config/theme.config static/vendor/semantic-ui/src/
	cp -r static/vendor/semantic-ui/src/_site static/vendor/semantic-ui/src/site
	cd static/vendor/semantic-ui && gulp build

clean:
	rm -r node_modules static/vendor

.PHONY: all
