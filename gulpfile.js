var gulp = require('gulp');
var zip    = require('gulp-zip');
var _ = require('lodash');
var pack = require('./package.json');

gulp.task('default', function() {
  var src = ['lambda.js'];
  _.each(pack.dependencies, function(key, value) {
    src.push([
      'node_modules',
      value,
      '**',
      '*.*'
    ].join('/'));
  });
  return gulp.src(src, {base: '.'})
        .pipe(zip('archive.zip'))
        .pipe(gulp.dest('.'));
});