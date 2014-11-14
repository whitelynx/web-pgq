all: bower_components

node_modules/.bin/bower:
	npm install

bower_components: node_modules/.bin/bower
	./node_modules/.bin/bower install

clean:
	rm -r node_modules bower_components

.PHONY: all
