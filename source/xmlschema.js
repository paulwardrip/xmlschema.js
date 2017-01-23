var xmlschema = function (schema) {

    function findbyname(doc, name) {
        return Array.prototype.slice.call( doc.getElementsByTagName(name), 0 );
    }

    var xsd;
    var tree = [];
    var any = 0;
    var choice = 0;
    var unique = [];
    var namespaces = [];

    function NS(ns) {
        if (ns) {
            this.url = ns;
            this.default = false;
        } else {
            this.url = null;
            this.default = true;
        }

        this.simpleTypes = {};
        this.complexTypes = {};
        this.attributeGroups = {};
        this.groups = {};
        this.unique = [];
    }

    function XsChoice (child, sequence, ns) {
        var opts = [];

        child.childNodes.forEach(function (choice) {
            if (choice.nodeType === Node.ELEMENT_NODE && choice.tagName === "xs:element") {
                opts.push(readElement(ns, choice, sequence));

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
        this.ns = ns.url;
    }

    function XsSimpleType(child, type, sequence, ns) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = function(){ if (child.getAttribute("maxOccurs")) return child.getAttribute("maxOccurs");
            else return (sequence) ? "unbounded" : 1; }();

        if (type) {
            this.xml = ns.simpleTypes[type].elem;
        } else {
            this.xml = child.getElementsByTagName("simpleType")[0];
        }

        this.validator = new XsSimpleTypeValidator(this.xml, "<" + child.getAttribute("name") + ">");

        this.from = "xs:simpleType";
        this.ns = ns.url;
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

    function XsPrimitive(child, sequence, ns) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = function(){ if (child.getAttribute("maxOccurs")) return child.getAttribute("maxOccurs");
            else return (sequence) ? "unbounded" : 1; }();
        this.from = child.getAttribute("type");
        this.ns = ns.url;
    }

    function XsComplexType(child, type, sequence, ns, uri) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = type;
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = function(){ if (child.getAttribute("maxOccurs")) return child.getAttribute("maxOccurs");
            else return (sequence) ? "unbounded" : 1; }();
        this.children = [];
        this.attributes = [];
        this.from = "xs:complexType";

        if (type) {
            this.xml = ns.complexTypes[type].elem;
        } else {
            this.xml = child.getElementsByTagName("complexType")[0];
        }
        this.ns = uri;
    }

    function XsAttribute(child, ns) {
        this.type = child.getAttribute("type");
        this.name = child.getAttribute("name");
        this.required = (child.getAttribute("use") && child.getAttribute("use") === "required");
        this.prohibited = (child.getAttribute("use") && child.getAttribute("use") === "prohibited");

        if (child.getAttribute("type")) {
            this.xml = ns.simpleTypes[child.getAttribute("type")].elem;
        } else if (child.getElementsByTagName("simpleType")) {
            this.xml = child.getElementsByTagName("simpleType")[0];
        }

        if (this.xml) {
            this.validator = new XsSimpleTypeValidator(this.xml, "@" + child.getAttribute("name"));
        }

        this.ns = ns.url;
    }

    function findNS(nsurl) {
        var n;
        namespaces.some(function (ns) {
            if ((nsurl && ns.url === nsurl) || (!nsurl && ns.default)) {
                n = ns;
                return true; // break loop
            }
        });
        if (!n) {
            n = new NS(nsurl);
            namespaces.push(n);
        }
        return n;
    }

    function collectNamespaces(node) {
        var pfxs = {
            prefixes: {}
        };

        Array.prototype.slice.call(node.attributes).forEach(function (attr) {
            if (attr.name === "xmlns") {
                pfxs.xmlns = attr.value;

            } else if (attr.name.indexOf("xmlns:") > -1) {
                var p = attr.name.replace(/xmlns:/, '');
                pfxs[p] = attr.value;
            }
        });
        return pfxs;
    }

    function readAttributes(child, validation, ns) {
        findbyname(child, "anyAttribute").forEach(function (any) {
           validation.attributes.push(new XsAnyAttribute(any));
        });
        findbyname(child, "attribute").forEach(function (attr) {
            validation.attributes.push(new XsAttribute(attr, ns));
        });
    }

    function readElement(ns, child, sequence) {
        var validation;

        Array.prototype.slice.call(child.getElementsByTagName("unique")).forEach(function (uni) {
            var uk = {
                name: uni.getAttribute("name"),
                selector: uni.getElementsByTagName("selector")[0].getAttribute("xpath"),
                field: uni.getElementsByTagName("field")[0].getAttribute("xpath")
            };
            unique.push(uk);
        });

        var type;
        var nstarget = ns;
        if (child.getAttribute("type")) {
            if (child.getAttribute("type").indexOf(":") > -1 && !/^xsi?:/.test(child.getAttribute("type"))) {
                var spl = child.getAttribute("type").split(/:/);
                nstarget = findNS(ns.prefixes.prefixes[spl[0]]);
                type = spl[1];
            } else {
                type = child.getAttribute("type");
            }
        }


        if ((type && nstarget.simpleTypes[type]) ||
            child.getElementsByTagName("simpleType").length > 0) {
            validation = new XsSimpleType(child, type, sequence, nstarget);

        } else if ((type && nstarget.complexTypes[type]) ||
            child.getElementsByTagName("complexType").length > 0) {
            validation = new XsComplexType(child, type, sequence, nstarget, ns.uri);

            function readSequence(elem) {
                var seq = elem.getElementsByTagName("sequence")[0];
                var all = elem.getElementsByTagName("all")[0];

                var gs = findbyname(elem, "group");
                gs.forEach(function (group) {
                    readSequence(nstarget.groups[group.getAttribute("ref")].elem);
                });

                findbyname(elem, "attributeGroup").forEach(function (agref) {
                    readAttributes(nstarget.attributeGroups[agref.getAttribute("ref")].elem, validation, nstarget);
                });

                var cc = elem.getElementsByTagName("complexContent")[0];
                if (cc) {
                    var base = cc.getElementsByTagName("extension")[0].getAttribute("base");
                    var extend = nstarget.complexTypes[base].elem || gs[base].elem;
                    readSequence(extend);
                }

                if (seq) {
                    validation.sequence = true;
                    constructTree(seq, nstarget, validation.children, validation.sequence);

                } else if (all) {
                    validation.sequence = false;
                    constructTree(all, nstarget, validation.children, validation.sequence);
                }

                readAttributes(elem, validation, nstarget);
            }

            readSequence(validation.xml);

        } else {
            validation = new XsPrimitive(child, sequence, nstarget);
        }

        return validation;
    }

    function constructTree (node, ns, branch, sequence) {
        var prev;

        node.childNodes.forEach(function(child) {
            var leaf;

            if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:element") {
                leaf = (readElement(ns, child, sequence));

            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:choice") {
                leaf = (new XsChoice(child, sequence, ns));

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

    function parseSchema(toparse, namespace, contree) {
        var def = xmlparser.deferred();
        var sub = [ false ];

        var ns = findNS(namespace);

        xmlparser.parse(toparse).then(function (result) {
            function url (input, parentDocument, cb) {
                if (/^http/.test(input)) {
                    cb (input);
                } else if (parentDocument) {
                    cb (parentDocument.substring(0, parentDocument.lastIndexOf("/") + 1) + input);
                } else if (xmlLoad) {
                    xmlLoad.then(function () {
                        console.log (xml);
                        var sl = xml.doc.firstChild.getAttribute("schemaLocation").split(/[\r\n\s]+/)[1];
                        cb (sl.substring(0, sl.lastIndexOf("/") + 1) + input);
                    })
                } else {
                    cb();
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
                    if (contree) {
                        ns.prefixes = collectNamespaces(result.doc.firstChild);
                        constructTree(result.doc.firstChild, ns, tree, false);
                    }
                    def.resolve(result);
                }
            }

            if (result.doc) {
                result.doc.firstChild.childNodes.forEach(function (child) {
                    if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === "xs:include" ||
                        child.tagName === "xs:import")) {
                        var midx = sub.length;
                        sub.push(false);
                        url(child.getAttribute("schemaLocation"), result.uri, function(uri){
                            if (uri) {
                                var tns = (child.tagName === "xs:import") ? child.getAttribute("namespace") : null;
                                var pr = parseSchema(uri, tns, false);
                                pr.then(function () {
                                    sub[midx] = true;
                                    resolver();
                                }).catch(function () {
                                    def.reject("Could not load include: " + child.getAttribute("schemaLocation"));
                                });
                            } else {
                                def.reject("Could not load include: " + child.getAttribute("schemaLocation"));
                            }
                        });

                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:simpleType") {
                        ns.simpleTypes[child.getAttribute("name")] = { elem: child, ns: namespace };
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:complexType") {
                        ns.complexTypes[child.getAttribute("name")] = { elem: child, ns: namespace };
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:group") {
                        ns.groups[child.getAttribute("name")] = { elem: child, ns: namespace };
                    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:attributeGroup") {
                        ns.attributeGroups[child.getAttribute("name")] = { elem: child, ns: namespace };
                    }
                });

                sub[0] = true;
                resolver();
            }
        }).catch(function () {
            def.reject();
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
        schemaLoad = parseSchema(schema, null, true);
        mainSchema();
    }

    var xmlLoad;
    var xml;

    function validate (document, callback) {
        var deferred = xmlparser.deferred();
        var score = {
            elements: 0,
            attributes: 0
        };

        if (callback) {
            deferred.then(callback);
        }

        var output = {
            errors: [],
            warnings: [],
            message: null,
            valid: false
        };

        var xmlprefix = {};

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
            var lasttag;

            function taglookup(name) {
                var sp = name.split(":");
                var tag = (sp.length === 1) ? { name: sp[0] } : { prefix: sp[0], name: sp[1] };
                tag.ns = xmlprefix.prefixes[tag.prefix] || xmlprefix.xmlns;
                return tag;
            }

            function countNode(name) {
                if (!count[name]) {
                    count[name] = 1;
                } else {
                    count[name]++;
                }

                last = name;
                lasttag = taglookup(name);

                console.debug("Element validated", lasttag.name, "[", lasttag.ns, "]");
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

                        var tag = taglookup(element.tagName);

                        function tagmatcher(xmltag, name, xsdns) {
                            if (!xmltag) return false;
                            var tagmatch = xmltag.name === name;
                            var nsmatches = (xmltag.ns === xsdns || !xmltag.prefix && !xsdns );
                            return tagmatch && nsmatches;
                        }

                        function scanner(leaf) {

                            function choice() {
                                leaf.choices.forEach(function (choice) {
                                    if (tagmatcher(lasttag, choice.name, leaf.ns)){
                                        foundlast = true;
                                        return true;
                                    }
                                });

                                leaf.choices.forEach(function (choice) {
                                    if ((!sequence || foundlast || !last) && tagmatcher(tag, choice.name, leaf.ns)) {
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

                                } else if (tagmatcher(lasttag, leaf.name, leaf.ns)) {
                                    foundlast = true;
                                    foundcount++;

                                    if (foundcount > count[leaf.name]) {
                                        nodefound(leaf);
                                    }

                                } else if (foundlast || !last) {
                                    if (!anywatch && leaf instanceof XsAny) {
                                        anywatch = leaf;
                                    }

                                    if (tagmatcher(tag, leaf.name, leaf.ns)) {
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
                                if (tagmatcher(tag, leaf, leaf.ns)) {
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

        xmlLoad = xmlparser.parse(document).then(function(result) {
            xml = result;

            if (xml.doc && !schemaLoad) {
                var schemaLocation;
                if (xml.doc.firstChild.getAttribute("xsi:schemaLocation"))
                    schemaLocation = xml.doc.firstChild.getAttribute("xsi:schemaLocation").split(/[\r\n\s]+/)[1];
                else if (xml.doc.firstChild.getAttribute("xsi:noNamespaceSchemaLocation"))
                    schemaLocation = xml.doc.firstChild.getAttribute("xsi:noNamespaceSchemaLocation");

                if (schemaLocation && schemaLocation.indexOf("http") > -1) {
                    console.log ("Loading schema from document: " + schemaLocation);
                    schemaLoad = parseSchema(schemaLocation, null, true);
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
                        xmlprefix = collectNamespaces(xml.doc.firstChild);
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