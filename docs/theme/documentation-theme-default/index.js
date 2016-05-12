'use strict';

var fs = require('fs'),
  path = require('path'),
  File = require('vinyl'),
  vfs = require('vinyl-fs'),
  _ = require('lodash'),
  concat = require('concat-stream'),
  formatMarkdown = require('./lib/format_markdown'),
  formatParameters = require('./lib/format_parameters');

module.exports = function (comments, options, callback) {

  var highlight = require('./lib/highlight')(options.hljs || {});

  var namespaces = comments.map(function (comment) {
    return comment.namespace;
  });

  var imports = {
    signature: function (section) {
      var returns = '';
      var prefix = '';
      if (section.kind === 'class') {
        prefix = 'new ';
      }
      if (section.returns) {
        returns = ': ' +
          formatMarkdown.type(section.returns[0].type, namespaces);
      }
      return prefix + section.name +
        formatParameters(section) + returns;
    },
    md: function (ast, inline) {
      if (inline && ast && ast.children.length && ast.children[0].type === 'paragraph') {
        return formatMarkdown({
          type: 'root',
          children: ast.children[0].children
        }, namespaces);
      }
      return formatMarkdown(ast, namespaces);
    },
    formatType: function (section) {
      return formatMarkdown.type(section.type, namespaces);
    },
    autolink: function (text) {
      return formatMarkdown.link(namespaces, text);
    },
    highlight: function (str) {
      return highlight(str);
    }
  };

  var pageTemplate = _.template(fs.readFileSync(path.join(__dirname, 'index.hbs'), 'utf8'), {
    imports: {
      renderSection: _.template(fs.readFileSync(path.join(__dirname, 'section.hbs'), 'utf8'), {
        imports: imports
      }),
      highlight: function (str) {
        return highlight(str);
      }
    }
  });

  // push assets into the pipeline as well.
  vfs.src([__dirname + '/assets/**'], { base: __dirname })
    .pipe(concat(function (files) {
      callback(null, files.concat(new File({
        path: 'index.html',
        contents: new Buffer(pageTemplate({
          docs: comments,
          options: options
        }), 'utf8')
      })));
    }));
};
