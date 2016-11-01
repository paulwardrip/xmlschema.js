module.exports = function(grunt) {

    // Project configuration
    grunt.initConfig({

        watch: {
            files: [ "*.js" ],
            tasks: [ "concat", "uglify" ]
        },

        concat: {
            build: {
                files: [{
                    'dist/xmlschema-all.js': [ 'xmlparser.js', 'xmljson.js', 'simpletype-validator.js',
                        'xsdoptions.js', 'xmlschema.js' ],
                    'dist/xsdoptions.js': [ 'xmlparser.js', 'simpletype-validator.js', 'xsdoptions.js' ],
                    'dist/xmlschema.js': [ 'xmlparser.js', 'simpletype-validator.js', 'xmlschema.js' ],
                    'dist/xmljson.js': [ 'xmljson.js' ]
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