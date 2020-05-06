# xmlschema.js
Implementation of XML schema validation in pure Javascript. 

Most XSD functionality is implemented here, except for the following: xs:key, xs:redefine, xs:union


# Installing
`npm install xmlschema`

*or* You can install using bower:

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
