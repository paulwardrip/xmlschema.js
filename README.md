# xmlschema.js
Implementation of XML schema validation in Javascript. This supports most of the basic functions of xml schema
validation. Some features used in complex schemas may not be implemented yet, these features may be provided in
a future release. If someone would like to contribute to the project, these features could be implemented.

The following features of the xsd are not implemented:

* xs:import
* xs:include
* xs:key
* xs:redefine
* xs:union
* xs:unique

Usage:

xmlschema(xsd).validate(xml[, callback]);

Where xsd/xml are a string, an XMLDocument object or a URL. Returns a promise, register a callback using then()
or pass in a callback to the validate method. 
The result object passed to the callback contains the following properties:

* valid: did the xml validate
* errors: an array of error messages.
* warnings: an array of warnings.
* xsd: the xsd document, contains both the dom object (doc) and string (str).
* xml: the xml document, contains both the dom objec (doc) and string (str).
