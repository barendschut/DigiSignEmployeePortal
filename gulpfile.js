const gulp = require('gulp');
const mergeStream = require('merge-stream');

const gulpif = require('gulp-if');
const babel = require('gulp-babel'); //to use ES6 preset for compiling the js

  const del = require('del');
  const polymerBuild = require('polymer-build');
  
  // Here we add tools that will be used to process our source files.
  //const imagemin = require('gulp-imagemin');
  
   const uglify = require('gulp-uglify');
   const cssSlam = require('css-slam').gulp;
   const htmlMinifier = require('gulp-html-minifier');
  
  const swPrecacheConfig = require('./sw-precache-config.js');
  const polymerJson = require('./polymer.json');
  const polymerProject = new polymerBuild.PolymerProject(polymerJson);
  const buildDirectory = 'polyBuild';
  
  /**
   * Waits for the given ReadableStream
   */
  function waitFor(stream) {
    return new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }
  
  function build() {
    return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
  
      //create some inline code splitters
      let sourcesStreamSplitter = new polymerBuild.HtmlSplitter();
      let dependenciesStreamSplitter = new polymerBuild.HtmlSplitter();
  
      //clear the build directory
      console.log(`Deleting ${buildDirectory} directory...`);
      del([buildDirectory])
        .then(() => {
          
          let sourcesStream = polymerProject.sources()

            //.pipe(gulpif(/\.(png|gif|jpg|svg)$/, imagemin()))
            .pipe(sourcesStreamSplitter.split())
             //.pipe(gulpif(/\.js$/, babel()))
             //.pipe(gulpif(/\.js$/, uglify())) // Install gulp-uglify to use
             .pipe(gulpif(/\.html$/, cssSlam())) // Install css-slam to use
             .pipe(gulpif(/\.html$/, htmlMinifier({collapseWhitespace: true, removeComments: true}))) // Install gulp-html-minifier to use
  
            //rejoin split inline code.
            .pipe(sourcesStreamSplitter.rejoin());
  
          //merge your sources & dependencies together into a single build stream.
          let buildStream = mergeStream(sourcesStream, polymerProject.dependencies())
            .once('data', () => {
              console.log('Analyzing build dependencies...');
            });

          // This will bundle dependencies into your fragments so we can lazy
          // load them.
          //buildStream = buildStream.pipe(polymerProject.bundler());
  
          //generate the HTTP/2 Push Manifest
          buildStream = buildStream.pipe(polymerProject.addPushManifest());
  
          buildStream = buildStream.pipe(gulp.dest(buildDirectory));
  
          // waitFor the buildStream to complete
          return waitFor(buildStream);
        })
        .then(() => {
          //generate the Service Worker
          console.log('Generating the Service Worker...');
          return polymerBuild.addServiceWorker({
            project: polymerProject,
            buildRoot: buildDirectory,
            swPrecacheConfig: swPrecacheConfig
          });
        })
        .then(() => {
          console.log('Build complete!');
          resolve();
        });
    });
  }
  
  gulp.task('build', build);