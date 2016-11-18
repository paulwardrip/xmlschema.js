module.exports = function(grunt) {

    // Project configuration
    grunt.initConfig({

        watch: {
            files: [ "source/*.js" ],
            tasks: [ "concat", "uglify" ]
        },

        concat: {
            build: {
                files: [{
                    'dist/xmlschema-all.js': [ 'source/xmlparser.js', 'source/xmljson.js',
                        'source/simpletype-validator.js', 'source/xsdoptions.js', 'source/xmlschema.js' ],
                    'dist/xsdoptions.js': [ 'source/xmlparser.js', 'source/simpletype-validator.js',
                        'source/xsdoptions.js' ],
                    'dist/xmlschema.js': [ 'source/xmlparser.js', 'source/simpletype-validator.js',
                        'source/xmlschema.js' ],
                    'dist/xmljson.js': [ 'source/xmljson.js' ]
                }]
            }
        },

        uglify: {
            build: {
                files: [{
                    'dist/xmlschema-all.min.js': [ 'dist/xmlschema-all.js' ],
                    'dist/xsdoptions.min.js': [ 'dist/xsdoptions.js' ],
                    'dist/xmlschema.min.js': [ 'dist/xmlschema.js' ],
                    'dist/xmljson.min.js': [ 'dist/xmljson.js' ]
                }]
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    // Default task.
    grunt.registerTask('default', ['concat','uglify']);

};