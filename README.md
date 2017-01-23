# xmlschema.js
Implementation of XML schema validation in Javascript. 

**Update** namespaces & xs:import are now supported.

This supports most of the basic functions of xml schema validation. 
Some features of the spec may not be implemented yet, these features may be provided in a future release.
If you would like to report a bug or even contribute to the project, contact me: pwardrip@gmail.com

The following features of the xsd are not implemented:

* xs:key
* xs:redefine
* xs:union


# Installing
You can install using bower:

`bower install xmlschema.js`

# Usage

xmlschema([xsd]).validate(xml[, callback]);

Where xsd/xml are a URL, XMLDocument or xml string. If xsd is not provided the schema will be loaded from the
xsi:schemaLocation in the xml document. The validate method returns a promise (implementation depends
on environment and available libraries, it provides: _then()_, _catch()_).

You will need to register a callback with the validate method or the promise it returns:
`function callback(result)`

The result object contains the following:

* valid: boolean, did the xml validate
* message: a status message, example: "Validated 14 elements and 8 attributes, document is invalid."
* errors: an array of error messages.
* warnings: an array of warnings.
* xsd: an object representing the xsd document
    * doc: as an XMLDocument object.
    * str: as a string.
* xml: an object representing the xml document
    * doc: as an XMLDocument object.
    * str: as a string.
