var xmlschema = function (schema) {

    function findbyname(doc, name) {
        return Array.prototype.slice.call( doc.getElementsByTagName(name), 0 );
    }

    var xsd;
    var simpleTypes = {};
    var complexTypes = {};
    var attributeGroups = {};
    var groups = {};
    var tree = [];
    var any = 0;
    var choice = 0;
    var unique = [];

    function XsChoice (child, sequence) {
        var opts = [];

        child.childNodes.forEach(function (choice) {
            if (choice.nodeType === Node.ELEMENT_NODE && choice.tagName === "xs:element") {
                opts.push(readElement(choice, sequence));

            } else if (choice.nodeType === Node.ELEMENT_NODE && choice.tagName === "xs:any") {
                opts.push(new XsAny(choice));
            }
        });

        this.id = child.getAttribute("id");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || 1;
        this.choices = opts;
        this.number = choice++;
        this.from = "xs:choice";
    }

    function XsSimpleType(child, sequence, inline) {
        this.id = child.getAttribute("id");
        this.name =child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = function(){ if (child.getAttribute("maxOccurs")) return child.getAttribute("maxOccurs");
            else return (sequence) ? "unbounded" : 1; }();

        if (child.getAttribute("type")) {
            this.xml = simpleTypes[child.getAttribute("type")];
        } else if (inline) {
            this.xml = inline;
        }

        this.validator = new XsSimpleTypeValidator(this.xml, "<" + child.getAttribute("name") + ">");

        this.from = "xs:simpleType";

    }

    function XsAny(child) {
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || 1;
        this.from = "xs:any";
        this.number = any++;
    }

    function XsAnyAttribute(child) {
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || 1;
        this.from = "xs:anyAttribute";
        this.number = any++;
    }

    function XsPrimitive(child, sequence) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = function(){ if (child.getAttribute("maxOccurs")) return child.getAttribute("maxOccurs");
            else return (sequence) ? "unbounded" : 1; }();
        this.from = child.getAttribute("type");
    }

    function XsComplexType(child, sequence, inline) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = function(){ if (child.getAttribute("maxOccurs")) return child.getAttribute("maxOccurs");
            else return (sequence) ? "unbounded" : 1; }();
        this.children = [];
        this.attributes = [];
        this.from = "xs:complexType";

        if (child.getAttribute("type")) {
            this.xml = complexTypes[child.getAttribute("type")];
        } else if (inline) {
            this.xml = inline;
        }
    }

    function XsAttribute(child) {
        this.type = child.getAttribute("type");
        this.name = child.getAttribute("name");
        this.required = (child.getAttribute("use") && child.getAttribute("use") === "required");
        this.prohibited = (child.getAttribute("use") && child.getAttribute("use") === "prohibited");

        if (child.getAttribute("type")) {
            this.xml = simpleTypes[child.getAttribute("type")];
        } else if (child.getElementsByTagName("simpleType")) {
            this.xml = child.getElementsByTagName("simpleType")[0];
        }

        if (this.xml) {
            this.validator = new XsSimpleTypeValidator(this.xml, "@" + child.getAttribute("name"));
        }
    }

    function readAttributes(child, validation) {
        findbyname(child, "anyAttribute").forEach(function (any) {
           validation.attributes.push(new XsAnyAttribute(any));
        });
        findbyname(child, "attribute").forEach(function (attr) {
            validation.attributes.push(new XsAttribute(attr));
        });
    }

    function readElement(child, sequence) {
        var validation;
        var inlineSimple = child.getElementsByTagName("simpleType");
        var inlineComplex = child.getElementsByTagName("complexType");

        Array.prototype.slice.call(child.getElementsByTagName("unique")).forEach(function (uni) {
            var uk = {
                name: uni.getAttribute("name"),
                selector: uni.getElementsByTagName("selector")[0].getAttribute("xpath"),
                field: uni.getElementsByTagName("field")[0].getAttribute("xpath")
            };
            unique.push(uk);
        });

        if (child.getAttribute("type") && simpleTypes[child.getAttribute("type")]) {
            validation = new XsSimpleType(child, sequence);

        } else if (inlineSimple.length > 0) {
            validation = new XsSimpleType(child, sequence, inlineSimple[0]);

        } else if (complexTypes[child.getAttribute("type")] || inlineComplex.length > 0) {
            validation = new XsComplexType(child, sequence, inlineComplex[0]);

            function readSequence(elem) {
                var seq = elem.getElementsByTagName("sequence")[0];
                var all = elem.getElementsByTagName("all")[0];

                var gs = findbyname(elem, "group");
                gs.forEach(function (group) {
                    readSequence(groups[group.getAttribute("ref")]);
                });

                findbyname(elem, "attributeGroup").forEach(function (agref) {
                    readAttributes(attributeGroups[agref.getAttribute("ref")], validation);
                });

                var cc = elem.getElementsByTagName("complexContent")[0];
                if (cc) {
                    var base = cc.getElementsByTagName("extension")[0].getAttribute("base");
                    var extend = complexTypes[base] || gs[base];
                    readSequence(extend);
                }

                if (seq) {
                    validation.sequence = true;
                    constructTree(seq, validation.children, validation.sequence);

                } else if (all) {
                    validation.sequence = false;
                    constructTree(all, validation.children, validation.sequence);
                }

                readAttributes(elem, validation);
            }

            readSequence(validation.xml);

        } else {
            validation = new XsPrimitive(child, sequence);
        }

        return validation;
    }

    function constructTree (node, branch, sequence) {
        var prev;

        node.childNodes.forEach(function(child) {
            var leaf;

            if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:element") {
                leaf = (readElement(child, sequence));

            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:choice") {
                leaf = (new XsChoice(child, sequence));

            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:any") {
                leaf = (new XsAny(child));
            }

            if (leaf) {
                if (prev) prev.next = leaf;
                prev = leaf;
                branch.push(leaf);
            }
        });
    }

    function parseSchema(toparse, contree) {
        var def = xmlparser.deferred();
        var sub = [ false ];

        xmlparser.parse(toparse).then(function (result) {
            function url (input, parentDocument) {
                if (/^http/.test(input)) {
                    return input;
                } else {
                    return parentDocument.substring(0, parentDocument.lastIndexOf("/") + 1) + input;
                }
            }

            function resolver() {
                var go = true;
                for (var idx in sub) {
                    if (!sub[idx]) {
                        go = false;
                        break;
                    }
                }
                if (go) {
                    if (contree) constructTree(result.doc.firstChild, tree, false);
                    def.resolve(result);
                }
            }

            if (result.doc) {
                result.doc.firstChild.childNodes.forEach(function (child) {
                    if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:include") {
                        var midx = sub.length;
                        sub.push(false);
                        var pr = parseSchema(url(child.getAttribute("schemaLocation"), result.uri), false);
                        pr.then(function () {
                            sub[midx] = true;
                            resolver();
                        })
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:simpleType") {
                        simpleTypes[child.getAttribute("name")] = child;
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:complexType") {
                        complexTypes[child.getAttribute("name")] = child;
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:group") {
                        groups[child.getAttribute("name")] = child;
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:attributeGroup") {
                        attributeGroups[child.getAttribute("name")] = child;
                    }
                });

                sub[0] = true;
                resolver();
            }
        });

        return def.promise();
    }

    function mainSchema() {
        schemaLoad.then(function (result) {
            xsd = result;
            xmlschemadocument = xsd.doc;
        });
    }

    var schemaLoad;
    if (schema) {
        schemaLoad = parseSchema(schema, true);
        mainSchema();
    }

    function validate (document, callback) {
        var deferred = xmlparser.deferred();
        var score = {
            elements: 0,
            attributes: 0
        };
        var xml;

        if (callback) {
            deferred.then(callback);
        }

        var output = {
            errors: [],
            warnings: [],
            message: null,
            valid: false
        };

        function error(message) {
            output.errors.push(message);
            console.log(message);
        }

        function validateUnique() {
            var xpath = new XPathEvaluator();
            var resolver = xpath.createNSResolver(xml.doc.documentElement);

            function xmlns(all, p1, p2) {
                return (p1 + "defaultns:" + p2);
            }

            function defaultns(pfx) {
                if (pfx === "defaultns") {
                    return xml.doc.documentElement.getAttribute("xmlns");
                } else {
                    resolver(pfx);
                }
            }

            unique.forEach(function (constr) {
                var select = constr.selector.replace(/^()([\w\-_:]+)/, xmlns).replace(/(\/{1,2})([\w\-_:]+)/, xmlns);
                var objs = xpath.evaluate(select, xml.doc.documentElement, defaultns,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                var values = {};

                for (var i = 0; i < objs.snapshotLength; i++) {
                    var elem = objs.snapshotItem(i);
                    var fselect = constr.field.replace(/^()([\w\-_:]+)/, xmlns).replace(/(\/{1,2})([\w\-_:]+)/, xmlns);

                    var fobjs = xpath.evaluate(fselect, elem, defaultns, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    if (fobjs.snapshotLength > 0) {
                        var felem = fobjs.snapshotItem(0);
                        if (!values[felem.nodeValue]){
                            values[felem.nodeValue] = true;
                        } else {
                            error("Unique constraint " + constr.name + " violated on <" + elem.tagName + ">");
                        }
                    } else {
                        warn("Could not evaluate unique constraint " + constr.name + " on <" + elem.tagName +
                            "> field not found, xpath: " + constr.field);
                    }
                }
            });
        }

        function validateElement(nodes, branch, sequence) {
            var queue = [];
            var unexpected = [];
            var count = {};
            var last;
            var lastleaf;

            function countNode(name) {
                if (!count[name]) {
                    count[name] = 1;
                } else {
                    count[name]++;
                }

                last = name;
            }

            nodes.forEach(function (element) {
                if (element.nodeType === Node.ELEMENT_NODE) {

                    var expect = [];
                    var found = false;
                    var anywatch;

                    function nodefound(leaf) {
                        score.elements ++;
                        countNode(element.tagName);
                        lastleaf = leaf;

                        if (leaf instanceof XsAny) {
                            lastany = leaf.number;

                        } else if (leaf instanceof XsComplexType) {
                            var attrcount = {};
                            Array.prototype.slice.call(element.attributes).forEach(function (attr) {
                                if (attr.name.indexOf("xmlns") === -1 && attr.name.indexOf("schemaLocation") === -1) {
                                    var attrfound = false;
                                    var anyattrfound = false;

                                    leaf.attributes.forEach(function (vine) {
                                        if (vine instanceof XsAnyAttribute) {
                                            anyattrfound = true;
                                        } else if (attr.name === vine.name) {
                                            score.attributes ++;
                                            attrfound = true;
                                            attrcount[attr.name] = (attrcount[attr.name] !== undefined) ?
                                            attrcount[attr.name] + 1 : 1;

                                            if (vine.prohibited) {
                                                error("Attribute <" + element.tagName + " @" + attr.name + "> is prohibited.");
                                            } else if (vine.validator !== undefined) {
                                                var result = vine.validator.validate(attr.value);
                                                if (!result.valid) {
                                                    error(result.error);
                                                }
                                            }
                                        }
                                    });

                                    if (!attrfound && !anyattrfound) {
                                        error("Unexpected attribute <" + element.tagName + " @" + attr.name + ">");
                                    }
                                }
                            });

                            leaf.attributes.forEach(function (vine) {
                               if (!attrcount[vine.name] && vine.required) {
                                   error("Attribute is required <" + element.tagName + " @" + vine.name + ">");
                               } else if (attrcount[vine.name] > 1) {
                                   error("Duplicate attribute <" + element.tagName + " @" + vine.name + ">");
                               }
                            });

                            queue.push({
                                parent: element.tagName,
                                nodes: element.childNodes,
                                tree: leaf.children,
                                sequence: leaf.sequence
                            });

                        } else if (leaf instanceof XsSimpleType) {
                            if (element.firstChild) {
                                var result = leaf.validator.validate(element.firstChild.nodeValue);
                                if (!result.valid) {
                                    error(result.error);
                                }
                            }
                        }

                        if (leaf instanceof XsSimpleType || leaf instanceof XsPrimitive) {
                            if (!element.firstChild || !element.firstChild.nodeValue) {
                                var warning = "Empty element <" + element.tagName + "> has no value.";
                                output.warnings.push(warning);
                                console.warn(warning);
                            }
                        }

                        found = true;
                        return true;
                    }

                    if (element.tagName === last) {
                        nodefound(lastleaf);

                    } else {
                        var foundlast = false;
                        var foundcount = 0;

                        function scanner(leaf) {
                            function choice() {
                                leaf.choices.forEach(function (choice) {
                                    if (choice.name === last) {
                                        foundlast = true;
                                        return true;
                                    }
                                });

                                leaf.choices.forEach(function (choice) {
                                    if ((!sequence || foundlast || !last) && element.tagName === choice.name) {
                                        nodefound(choice);

                                        return true;
                                    }
                                });
                            }

                            if (sequence) {
                                if (leaf instanceof XsChoice) {
                                    choice();

                                } else if (leaf instanceof XsAny && lastany == leaf.number) {
                                    foundlast = true;

                                } else if (leaf.name === last) {
                                    foundlast = true;
                                    foundcount++;

                                    if (foundcount > count[leaf.name]) {
                                        nodefound(leaf);
                                    }

                                } else if (foundlast || !last) {
                                    if (!anywatch && leaf instanceof XsAny) {
                                        anywatch = leaf;
                                    }

                                    if (element.tagName === leaf.name) {
                                        nodefound(leaf);
                                        if (anywatch && anywatch.minOccurs > 0) {
                                            error("An element not specified by the schema is required " +
                                                "and did not match with an element in the XML document.");
                                        }

                                    } else {
                                        expect.push(leaf.name);

                                        if (leaf.minOccurs > 0) {
                                            unexpected.push({element: element, expected: expect});
                                        }
                                    }
                                }

                            } else {
                                if (element.tagName === leaf.name) {
                                    nodefound(leaf);

                                } else if (leaf instanceof XsChoice) {
                                    choice();
                                }
                            }

                            if (found) {
                                return true;
                            }

                        }

                        branch.some(scanner);

                        if (anywatch) {
                            nodefound(anywatch);
                        }

                        if (!found) {
                            error("Invalid element <" + element.tagName + "> not allowed, parent: " +
                                element.parentNode.tagName);
                        }

                    }
                }
            });

            function maxedOut(leaf) {
                error("Too many instances of <" + leaf.name + "> exceeding the maximum of " +
                    leaf.maxOccurs + ", parent element " + nodes[0].parentNode.tagName);
            }

            unexpected.forEach(function (unex) {
                if (!sequence) {
                    var moreof = [];

                    branch.forEach(function (leaf) {
                        if (!count[leaf.name]) {
                            unex.expected.push(leaf.name);
                        } else if (leaf.maxOccurs > count[leaf.name]) {
                            moreof.push(leaf.name);
                        }
                    });

                    if (unex.expected.length === 0) {
                        unex.expected = moreof;
                    }
                }

                var msg = "Elements out of sequence, found <" + unex.element.tagName + "> expected [";
                var first = true;

                unex.expected.forEach(function (elemtype) {
                    if (!first) msg += ", ";
                    msg += elemtype;
                    first = false;
                });

                error(msg + "], parent: " + unex.element.parentNode.tagName);
            });

            branch.forEach(function (leaf) {
                if (leaf instanceof XsChoice) {
                    var found;
                    var countall = 0;

                    leaf.choices.forEach(function (choice) {
                        if (count[choice.name]) {
                            if (!found) {
                                found = choice;
                                countall++;
                            }
                        }
                    });

                    if (!found && leaf.minOccurs > 0) {
                        var msg = "Required choice not present, options: [";
                        var first = true;

                        leaf.choices.forEach(function (choice) {
                            if (!first) msg += ", ";
                            msg += choice.name;
                            first = false;
                        });

                        error(msg + "].");

                    } else if (leaf.maxOccurs !== "unbounded" && countall > leaf.maxOccurs) {
                        var msg = "Too many choices selected from list: [";
                        var first = true;

                        leaf.choices.forEach(function (choice) {
                            if (!first) msg += ", ";
                            msg += choice.name;
                            first = false;
                        });

                        error(msg + "] " + countall + " options found, maximum is " + leaf.maxOccurs);
                    }

                } else {
                    if (!count[leaf.name] && leaf.minOccurs > 0) {
                        error("Required element <" + leaf.name +
                            "> missing, parent: " + nodes[0].parentNode.tagName);

                    } else if (leaf.maxOccurs !== "unbounded" && count[leaf.name] > leaf.maxOccurs) {
                        maxedOut(leaf);
                    }
                }
            });

            queue.forEach(function (task) {
                validateElement(task.nodes, task.tree, task.sequence);
            });

        }

        xmlparser.parse(document).then(function(result) {
            xml = result;

            if (xml.doc && !schemaLoad) {
                var schemaLocation;
                if (xml.doc.firstChild.getAttribute("xsi:schemaLocation"))
                    schemaLocation = xml.doc.firstChild.getAttribute("xsi:schemaLocation").split(/[\r\n\s]+/)[1];
                else if (xml.doc.firstChild.getAttribute("xsi:noNamespaceSchemaLocation"))
                    schemaLocation = xml.doc.firstChild.getAttribute("xsi:noNamespaceSchemaLocation");

                if (schemaLocation && schemaLocation.indexOf("http") > -1) {
                    console.log ("Loading schema from document: " + schemaLocation);
                    schemaLoad = parseSchema(schemaLocation, true);
                    mainSchema();
                }
            }

            if (schemaLoad) {
                schemaLoad.then(function () {
                    if (!xsd.doc) {
                        error("XSD could not be parsed.");
                        error(xsd.error);

                    } else if (!xml.doc) {
                        error("XML could not be parsed.");
                        error(xml.error);

                    } else {
                        validateElement(xml.doc.childNodes, tree, true);
                        validateUnique();
                        output.valid = output.errors.length === 0;
                        output.xml = xml;
                        output.xsd = xsd;
                        output.message = "Validated " + score.elements + " elements and " + score.attributes +
                            " attributes, document is " + (output.valid ? "valid" : "invalid") + ".";
                    }

                    deferred.resolve(output);

                }).catch(function (message) {
                    console.log(message);
                    deferred.reject(message);
                });
            } else {
                deferred.reject("No schema document loaded.");
            }

            return output;

        }).catch(function (message) {
            console.log(message);
            deferred.reject(message);
        });

        return deferred.promise();
    }

    var library = {
        validate: validate,
        xmlparser: xmlparser
    };

    if (typeof xsdoptions !== "undefined") library.xsdoptions = xsdoptions;
    if (typeof xmljson !== "undefined") library.xmljson = xmljson;

    return library;
};

var xmlschemadocument;

if (typeof module !== "undefined") {
    module.exports = xmlschema;
}