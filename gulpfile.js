var gulp = require('gulp');
var zip    = require('gulp-zip');

gulp.task('default', function() {
  return gulp.src([
      'lambda.js',
      'node_modules/lodash/**/*.*',
      'node_modules/request/**/*.*',
      'node_modules/q/**/*.*',
    ], {base: '.'})
        .pipe(zip('archive.zip'))
        .pipe(gulp.dest('.'));
});