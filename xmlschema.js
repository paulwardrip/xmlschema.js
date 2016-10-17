var xmlschema = function (schema) {

    function findbyname(doc, name) {
        return Array.prototype.slice.call( doc.getElementsByTagName(name), 0 );
    }

    function parse(input) {
        if (typeof input === "object") {
            if (input instanceof XMLDocument) {
                return input;

            } else if (typeof jQuery !== "undefined" && input instanceof jQuery) {
                var body = ($(input.children()[0]).html());
                var elem = input.children()[0].tagName;

                var xstr = "<" + elem;
                $.each(input.children()[0].attributes, function () {
                   xstr += " " + this.name + "=\"" + this.value + "\"";
                });
                xstr += ">\n" + body + "\n<" + elem + ">";

                return parse(xstr);
            }

        } else if (typeof input === "string") {
            if (typeof DOMParser !== "undefined") {
                var par = new DOMParser();
                return par.parseFromString(input, "application/xml");

            } else {
                var doc = new XMLDocument();
                doc.loadXML(input);
                return doc;
            }
        }
    }

    var xsd = parse(schema);

    var simpleTypes = {};
    var complexTypes = {};
    var tree = [];
    var any = 0;

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
        this.from = "xs:choice";
    }

    function XsSimpleType(child, sequence, inline) {
        this.id = child.getAttribute("id");
        this.name =child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || (sequence) ? "unbounded" : 1;

        if (child.getAttribute("type")) {
            this.xml = simpleTypes[child.getAttribute("type")];
        } else if (inline) {
            this.xml = inline;
        }

        var restriction = this.xml.getElementsByTagName("restriction")[0];
        if (restriction) {
            this.base = this.xml.getElementsByTagName("restriction")[0].getAttribute("base");
        }

        this.length = (this.xml.getElementsByTagName("length")[0]) ?
            this.xml.getElementsByTagName("length")[0].getAttribute("value") : 0;
        this.minLength = (this.xml.getElementsByTagName("minLength")[0]) ?
            this.xml.getElementsByTagName("minLength")[0].getAttribute("value") : 0;
        this.maxLength = (this.xml.getElementsByTagName("maxLength")[0]) ?
            this.xml.getElementsByTagName("maxLength")[0].getAttribute("value") : 0;
        this.pattern = (this.xml.getElementsByTagName("pattern")[0]) ?
            this.xml.getElementsByTagName("pattern")[0].getAttribute("value") : null;

        this.isNumber = function () {
            var datatype = false;
            var base = this.base;
            var types = [
                "byte",
                "decimal",
                "double",
                "int",
                "float",
                "integer",
                "long",
                "negativeInteger",
                "nonNegativeInteger",
                "nonPositiveInteger",
                "positiveInteger",
                "short",
                "unsignedLong",
                "unsignedInt",
                "unsignedShort",
                "unsignedByte"
            ];
            
            types.some(function (type) {
                if ("xs:" + type === base) {
                    datatype = true;
                    return true;
                }
            });

            return datatype;
        };

        if (this.isNumber()){
            this.fractionDigits = (this.xml.getElementsByTagName("fractionDigits")[0]) ?
                this.xml.getElementsByTagName("fractionDigits")[0].getAttribute("value") : null;
            this.maxInclusive = (this.xml.getElementsByTagName("maxInclusive")[0]) ?
                this.xml.getElementsByTagName("maxInclusive")[0].getAttribute("value") : null;
            this.maxExclusive = (this.xml.getElementsByTagName("maxExclusive")[0]) ?
                this.xml.getElementsByTagName("maxExclusive")[0].getAttribute("value") : null;
            this.minInclusive = (this.xml.getElementsByTagName("minInclusive")[0]) ?
                this.xml.getElementsByTagName("minInclusive")[0].getAttribute("value") : null;
            this.minExclusive = (this.xml.getElementsByTagName("minExclusive")[0]) ?
                this.xml.getElementsByTagName("minExclusive")[0].getAttribute("value") : null;
            this.totalDigits = (this.xml.getElementsByTagName("totalDigits")[0]) ?
                this.xml.getElementsByTagName("totalDigits")[0].getAttribute("value") : null;
        }

        this.from = "xs:simpleType";

        var enumeration = [];
        this.enumeration = enumeration;

        findbyname(this.xml, "enumeration").forEach(function (enumnode) {
            enumeration.push(enumnode.getAttribute("value"));
        });
    }

    function XsAny(child) {
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || 1;
        this.from = "xs:any";
        any++;
        this.number = any;
    }

    function XsPrimitive(child, sequence) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || (sequence) ? "unbounded" : 1;
        this.from = child.getAttribute("type");
    }

    function XsComplexType(child, sequence) {
        this.id = child.getAttribute("id");
        this.name = child.getAttribute("name");
        this.type = child.getAttribute("type");
        this.minOccurs = child.getAttribute("minOccurs") || 1;
        this.maxOccurs = child.getAttribute("maxOccurs") || (sequence) ? "unbounded" : 1;
        this.xml = complexTypes[child.getAttribute("type")];
        this.children = [];
        this.from = "xs:complexType";
    }

    function readElement(child, sequence) {
        var validation;
        var inline = child.getElementsByTagName("simpleType");

        if (child.getAttribute("type") && simpleTypes[child.getAttribute("type")]) {
            validation = new XsSimpleType(child, sequence);

        } else if (inline.length > 0) {
            validation = new XsSimpleType(child, sequence, inline[0]);

        } else if (complexTypes[child.getAttribute("type")]) {
            validation = new XsComplexType(child, sequence);

            function readSequence(elem) {
                var seq = elem.getElementsByTagName("sequence")[0];
                var all = elem.getElementsByTagName("all")[0];

                if (seq) {
                    validation.sequence = true;
                    constructTree(seq, validation.children, validation.sequence);

                } else if (all) {
                    validation.sequence = false;
                    constructTree(all, validation.children, validation.sequence);
                }
            }

            var cc = validation.xml.getElementsByTagName("complexContent")[0];

            if (cc) {
                var extend = complexTypes[cc.getElementsByTagName("extension")[0].getAttribute("base")];
                readSequence(extend);
                readSequence(validation.xml);

            } else {
                readSequence(validation.xml);
            }
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

    if (xsd) {
        xsd.firstChild.childNodes.forEach(function(child) {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:simpleType") {
                simpleTypes[child.getAttribute("name")] = child;
            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "xs:complexType") {
                complexTypes[child.getAttribute("name")] = child;
            }
        });

        constructTree(xsd.firstChild, tree, false);

    } else {
        console.log("XSD could not be read.");
    }

    return {
        validate: function (document) {
            var xml = parse(document);

            console.log (tree);

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

            function validateElement(nodes, branch, sequence) {
                var queue = [];
                var unexpected = [];
                var count = {};
                var lastany = 0;
                var last;

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
                        if (element.tagName === last) {
                            countNode(element.tagName);

                        } else {
                            var expect = [];
                            var found = false;
                            var anywatch;

                            function nodefound(leaf) {
                                countNode(element.tagName);

                                if (leaf instanceof XsAny) {
                                    lastany = leaf.number;

                                } else if (leaf instanceof XsComplexType) {
                                    queue.push({ parent: element.tagName,
                                        nodes: element.childNodes,
                                        tree: leaf.children,
                                        sequence: leaf.sequence
                                    });

                                } else if (leaf instanceof XsSimpleType) {
                                    if (element.firstChild) {
                                        if (leaf.enumeration.length > 0) {
                                            var isval = false;
                                            leaf.enumeration.forEach(function (value) {
                                                if (value === element.firstChild.nodeValue) {
                                                    isval = true;
                                                    return true;
                                                }
                                            });

                                            if (!isval) {
                                                error("Value of <" + element.tagName +
                                                    "> does not match enumerated options.");
                                            }

                                        } else if (leaf.isNumber()) {
                                            if (!/^[0-9.\-]*$/.test(element.firstChild.nodeValue)) {
                                                error("Value of <" + element.tagName + "> should be numeric.");

                                            } else if (leaf.minInclusive &&
                                                parseFloat(element.firstChild.nodeValue) < leaf.minInclusive) {
                                                error("Value of <" + element.tagName + "> should be greater than " +
                                                    leaf.minInclusive + " (inclusive).");

                                            } else if (leaf.minExclusive &&
                                                parseFloat(element.firstChild.nodeValue) <= leaf.minExclusive) {
                                                error("Value of <" + element.tagName + "> should be greater than " +
                                                    leaf.minExclusive + " (exclusive).");

                                            } else if (leaf.maxInclusive &&
                                                parseFloat(element.firstChild.nodeValue) > leaf.maxInclusive) {
                                                error("Value of <" + element.tagName + "> should be less than " +
                                                    leaf.maxInclusive + " (inclusive).");

                                            } else if (leaf.maxExclusive &&
                                                parseFloat(element.firstChild.nodeValue) >= leaf.maxExclusive) {
                                                error("Value of <" + element.tagName + "> should be greater than " +
                                                    leaf.maxExclusive + " (exclusive).");

                                            } else if (leaf.totalDigits && leaf.totalDigits
                                                    !== element.firstChild.nodeValue.replace(/\./,'').length){
                                                error("Value of <" + element.tagName + "> should be " +
                                                    leaf.totalDigits + " digits.");

                                            } else if (leaf.fractionDigits && leaf.fractionDigits
                                                    < element.firstChild.nodeValue.split(/\./)[1].length) {
                                                error("Value of <" + element.tagName + "> should have only " +
                                                    leaf.fractionDigits + " digits past the decimal.");
                                            }

                                        } else if (leaf.base === "xs:string") {
                                            if (leaf.length > 0 &&
                                                element.firstChild.nodeValue.length !== leaf.length) {
                                                error("Value of <" + element.tagName + "> should be exactly " +
                                                    leaf.length + "characters.");

                                            } else if (leaf.minLength > 0 &&
                                                element.firstChild.nodeValue.length < leaf.minLength) {
                                                error("Value of <" + element.tagName + "> should be at least " +
                                                    leaf.minLength + "characters.");

                                            } else if (leaf.maxLength > 0 &&
                                                element.firstChild.nodeValue.length > leaf.maxLength) {
                                                error("Value of <" + element.tagName + "> exceeds " +
                                                    leaf.maxLength + "characters.");

                                            } else if (leaf.pattern && !new RegExp(leaf.pattern).test()) {
                                                error("Value of <" + element.tagName +
                                                    "> does not match the specified pattern.");
                                            }
                                        }
                                    }
                                }

                                if (leaf instanceof XsSimpleType || leaf instanceof XsPrimitive){
                                    if (!element.firstChild || !element.firstChild.nodeValue) {
                                        var warning = "Empty element <" + element.tagName + "> has no value.";
                                        output.warnings.push(warning);
                                        console.warn (warning);
                                    }
                                }

                                found = true;
                                return true;
                            }

                            var foundlast = false;

                            function scanner(leaf) {
                                function choice() {
                                    leaf.choices.forEach(function (choice) {
                                        if ((!sequence || foundlast || !last) && element.tagName === choice.name) {
                                            nodefound(choice);
                                            return true;

                                        } else if (choice.name === last) {
                                            foundlast = true;
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

                                    } else if (foundlast || !last) {
                                        if (!anywatch && leaf instanceof XsAny) {
                                            anywatch = leaf;
                                        }

                                        if (element.tagName === leaf.name) {
                                            nodefound(leaf);
                                            if (anywatch && anywatch.minOccurs > 0) {
                                                error("An element not specified by the schema is required "+
                                                    "and did not match with an element in the XML document.");
                                            }

                                        } else {
                                            expect.push(leaf.name);

                                            if (leaf.minOccurs > 0) {
                                                unexpected.push({ element: element, expected: expect });
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
                                error ("Invalid element <" + element.tagName + "> not allowed, parent: " +
                                    element.parentNode.tagName);
                            }
                        }
                    }
                });

                function maxedOut (leaf) {
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

                    error (msg + "], parent: " + unex.element.parentNode.tagName);
                });

                branch.forEach(function (leaf) {
                    if (leaf instanceof XsChoice) {
                        var found;
                        leaf.choices.forEach(function (choice) {
                            if (count[choice.name]) {
                               if (!found) {
                                   found = choice;
                               } else {
                                   error("Only one element is allowed from choice, but <" + choice.name +
                                       "> and <" + found.name + "> are present, parent element " +
                                       nodes[0].parentNode.tagName);
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

                        } else if (leaf.maxOccurs !== "unbounded" && count[found.name] > leaf.maxOccurs) {
                            maxedOut(found);
                        }

                    } else if (!count[leaf.name] && leaf.minOccurs > 0) {
                       error("Required element <" + leaf.name +
                           "> missing, parent: " + nodes[0].parentNode.tagName);

                    } else if (leaf.maxOccurs !== "unbounded" && count[leaf.name] > leaf.maxOccurs) {
                       maxedOut(leaf);
                    }
                });

                queue.forEach(function (task) {
                    validateElement(task.nodes, task.tree, task.sequence);
                });

            }

            if (!xsd) {
                error("XSD could not be parsed.");

            } else if (!xml) {
                error("XML could not be parsed.");

            } else {
                validateElement(xml.childNodes, tree, true);
                output.valid = output.errors.length === 0;
            }

            return output;
        }
    }
};
