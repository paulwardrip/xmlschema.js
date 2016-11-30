var xmlparser = {
    parse: function (input) {
        var out = {doc: null, str: null};
        var deferred = xmlparser.deferred();

        function xmlString(str, uri) {
            if (typeof jQuery !== "undefined") {
                try {
                    out.doc = $.parseXML(str);
                    out.str = str;
                    out.parser = "jQuery";
                    if (uri) {
                        out.uri = uri;
                    }
                } catch (e) {
                    deferred.reject("XML could not be parsed.");
                }

                if (out.doc) {
                    deferred.resolve(out);
                } else {
                    deferred.reject("XML could not be parsed.");
                }

            } else if (typeof DOMParser !== "undefined") {
                var par = new DOMParser();
                out.doc = par.parseFromString(str, "application/xml");
                out.str = str;
                out.parser = "DOMParser";
                if (uri) {
                    out.uri = uri;
                }

                if (out.doc.getElementsByTagName("parsererror").length > 0) {
                    deferred.reject("XML could not be parsed.");
                } else {
                    deferred.resolve(out);
                }
            }
        }

        if (typeof input === "object") {
            if (input instanceof XMLDocument) {
                out.doc = input;
                if (typeof XMLSerializer !== "undefined") {
                    out.str = new XMLSerializer().serializeToString(input);
                }
                deferred.resolve(out);

            } else if (typeof jQuery !== "undefined" && input instanceof jQuery) {
                var body = ($(input.children()[0]).html());
                var elem = input.children()[0].tagName;

                var xstr = "<" + elem;
                $.each(input.children()[0].attributes, function () {
                    xstr += " " + this.name + "=\"" + this.value + "\"";
                });
                xstr += ">\n" + body + "\n<" + elem + ">";

                xmlString(xstr);

                deferred.resolve(out);
            }

        } else if (typeof input === "string") {
            if (/\.(xml|xsd)$/.test(input)) {

                if (typeof jQuery !== "undefined") {
                    var p = $.get(input, {}, function (xml) {
                        xmlString(xml, input);
                    }, "text");
                    p.catch(function () {
                       deferred.reject("Could not read file: " + input);
                    });

                } else {
                    var xhr;
                    if (typeof XMLHttpRequest !== 'undefined') {
                        xhr = new XMLHttpRequest();

                    } else if (typeof ActiveXObject !== 'undefined') {
                        try {
                            xhr = new ActiveXObject("Msxml2.XMLHTTP");
                        } catch (e) {
                            try {
                                xhr = new ActiveXObject("Microsoft.XMLHTTP");
                            } catch (E) {
                                xhr = null;
                            }
                        }
                    }

                    if (xhr !== "undefined") {
                        xhr.open('GET', input);
                        xhr.setRequestHeader('Content-Type', 'application/xml');
                        xhr.onreadystatechange = function () {
                            if (this.readyState === 4) {
                                if (this.status === 200) {
                                    xmlString(this.responseText, input);
                                } else {
                                    out.error = "Unable to request document, response code: " + this.status;
                                    deferred.reject(out);
                                }
                            }
                        };
                        xhr.send(null);

                    } else {
                        out.error = "Unable to request document, browser does not support " +
                            "XMLHttpRequest and jQuery is not available.";
                        deferred.reject(out);
                    }

                }
            } else {
                xmlString(input);
            }
        }

        return deferred.promise();
    },

    deferred: function () {
        if (typeof jQuery !== 'undefined') {
            return $.Deferred();

        } else if (typeof Promise !== 'undefined') {
            return function () {
                var resolve = null;
                var reject = null;
                var promise = new Promise(function (res, rej) {
                    resolve = res;
                    reject = rej;
                });
                return {
                    promise: function () {
                        return promise;
                    },
                    resolve: resolve,
                    reject: reject
                }
            }();

        } else {
            return new (function MinimalPromise() {
                var resolved = false;
                var rejected = false;
                var call = [];
                var catcher = [];
                var obj;

                this.resolve = function (result) {
                    resolved = true;
                    obj = result;
                    call.forEach(function (callback) {
                        callback(obj);
                    });
                };

                this.reject = function (reason) {
                    rejected = true;
                    obj = reason;
                    catcher.forEach(function (callback) {
                        callback(obj);
                    });
                };

                this.promise = {
                    then: function (callback) {
                        if (resolved) {
                            callback(obj);
                        } else {
                            call.push(callback);
                        }
                        return this;
                    },
                    catch: (function (callback) {
                        if (rejected) {
                            callback(obj);
                        } else {
                            catcher.push(callback);
                        }
                        return this;
                    })
                };
            })();
        }
    }
};
var xmljson = {
    toXML: function (json) {

        function unwrap(tree, depth) {
            var xml = "";

            for (var node in tree) {
                if (typeof tree[node] === "object") {
                    if (tree[node] instanceof Array) {
                        for (var idx in tree[node]) {
                            for (var i = 0; i < depth; i++) {
                                xml += "\t";
                            }
                            xml += "<" + node + ">";

                            if (typeof tree[node][idx] === "object") {
                                xml += "\n";
                                xml += unwrap(tree[node][idx], depth + 1);
                                for (var i = 0; i < depth; i++) {
                                    xml += "\t";
                                }
                            } else {
                                xml += tree[node][idx];
                            }
                            xml += "</" + node + ">\n";
                        }

                    } else if (node === "value" && tree.attributes !== undefined) {
                        xml += tree[node];

                    } else if (node !== "attributes") {
                        for (var i = 0; i < depth; i++) {
                            xml += "\t";
                        }

                        xml += "<" + node;
                        for (var a in tree[node].attributes) {
                            xml += " " + a + "=\"" + tree[node].attributes[a] + "\"";
                        }

                        var subtext = unwrap(tree[node], depth + 1);
                        if (subtext) {
                            xml += ">";
                            if (subtext.indexOf("<") > -1) xml += "\n";
                            xml += subtext;

                            if (subtext.indexOf("<") > -1) {
                                for (var i = 0; i < depth; i++) {
                                    xml += "\t";
                                }
                            }
                            xml += "</" + node + ">\n";
                        } else {
                            xml += " />\n";
                        }
                    }
                } else {
                    if (node === "value" && tree.attributes !== undefined) {
                        xml += tree[node];

                    } else {
                        for (var i = 0; i < depth; i++) {
                            xml += "\t";
                        }
                        xml += "<" + node + ">" + tree[node] + "</" + node + ">\n";
                    }
                }
            }
            return xml;
        }

        var obj = json;
        if (typeof obj === "string") {
            obj = JSON.parse(obj);
        }

        return unwrap(obj, 0);
    },

    toJSON: function (xml) {
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

        function extract(node) {
            var obj = null;
            var elements = false;

            if (node.attributes) {
                for (var child = 0; child < node.attributes.length; child++) {
                    if (!obj) obj = {attributes: {}};
                    obj.attributes[node.attributes[child].name] = node.attributes[child].value;
                }
            }

            node.childNodes.forEach(function (child) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    if (!obj) obj = {};

                    if (obj[child.tagName] !== undefined && !(obj[child.tagName] instanceof Array)) {
                        console.log("Array");
                        obj[child.tagName] = [obj[child.tagName]];
                    }

                    if (obj[child.tagName] instanceof Array) {
                        obj[child.tagName].push(extract(child));
                    } else {
                        obj[child.tagName] = extract(child);
                    }
                    elements = true;
                }
            });

            if (!elements && node.firstChild) {
                if (!obj) {
                    obj = node.firstChild.nodeValue;
                } else {
                    obj.value = node.firstChild.nodeValue;
                }
            }

            return obj;
        }

        var doc = parse(xml);
        return extract(doc);
    }
};
function XsSimpleTypeValidator(simpleType, tagname) {
    this.xml = simpleType;
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

    var enumeration = [];

    Array.prototype.slice.call(this.xml.getElementsByTagName("enumeration")).forEach(function (enumnode) {
        enumeration.push(enumnode.getAttribute("value"));
    });

    this.enumeration = enumeration;

    this.validate = function(value) {
        var output = {
            valid: true
        };

        function error(err) {
            output.valid = false;
            output.error = err;
        }

        if (this.enumeration.length > 0) {
            var isval = false;
            this.enumeration.forEach(function (evalue) {
                if (value === evalue) {
                    isval = true;
                    return true;
                }
            });

            if (!isval) {
                error("Value of " + tagname + " does not match enumerated options.");
            }

        } else if (this.isNumber()) {
            if (!/^[0-9.\-]*$/.test(value)) {
                error("Value of " + tagname + " should be numeric.");

            } else if (this.minInclusive &&
                parseFloat(value) < this.minInclusive) {
                error("Value of " + tagname + " should be greater than " + this.minInclusive + " (inclusive).");

            } else if (this.minExclusive &&
                parseFloat(value) <= this.minExclusive) {
                error("Value of " + tagname + " should be greater than " + this.minExclusive + " (exclusive).");

            } else if (this.maxInclusive &&
                parseFloat(value) > this.maxInclusive) {
                error("Value of " + tagname + " should be less than " + this.maxInclusive + " (inclusive).");

            } else if (this.maxExclusive &&
                parseFloat(value) >= this.maxExclusive) {
                error("Value of " + tagname + " should be greater than " + this.maxExclusive + " (exclusive).");

            } else if (this.totalDigits && this.totalDigits !== value.replace(/\./, '').length) {
                error("Value of " + tagname + " should be " + this.totalDigits + " digits.");

            } else if (this.fractionDigits && this.fractionDigits < value.split(/\./)[1].length) {
                error("Value of " + tagname + " should have only " + this.fractionDigits + " digits past the decimal.");
            }

        } else if (this.base === "xs:string") {

            if (this.length > 0 && value.length !== this.length) {
                error("Value of " + tagname + " should be exactly " + this.length + "characters.");

            } else if (this.minLength > 0 && value.length < this.minLength) {
                error("Value of " + tagname + " should be at least " + this.minLength + "characters.");

            } else if (this.maxLength > 0 && value.length > this.maxLength) {
                error("Value of " + tagname + " exceeds " + this.maxLength + "characters.");

            } else if (this.pattern && !new RegExp(this.pattern).test(value)) {
                error("Value of " + tagname +
                    " does not match the specified pattern.");
            }
        }

        return output;
    }
}
var xsdoptions = function(input) {
    var collection = [];
    var ready = xmlparser.deferred();
    var xsd = null;

    function domListener (selector, callback) {
        // Populate any existing fields.
        Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (elem) {
            callback(elem);
        });

        // Create a mutation observer to automatically hook up any dynamically added form fields.
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (typeof node.querySelectorAll !== "undefined") {
                        Array.prototype.slice.call(node.querySelectorAll(selector)).forEach(function (elem) {
                            callback(elem);
                        })
                    }
                });
            });
        });

        var toObserve = {
            attributes: false,
            characterData: false,
            childList: true,
            subtree: true
        };

        observer.observe(document, toObserve);
    }

    function populate (elem, values, formatter) {
        if (!elem.getElementsByTagName("option") || elem.getElementsByTagName("option").length <= 1) {
            if (!elem.getElementsByTagName("option") || elem.getElementsByTagName("option").length === 0) {
                var opt = document.createElement("option");
                opt.appendChild(document.createTextNode(""));
                opt.setAttribute("value", "");
                elem.appendChild(opt);
            }

            values.forEach(function (v) {
                if (!formatter) {
                    var opt = document.createElement("option");
                    opt.appendChild(document.createTextNode(v.label));
                    opt.setAttribute("value", v.value);
                    elem.appendChild(opt);
                } else {
                    var h = elem.innerHTML;
                    h += formatter(this);
                    elem.innerHTML = h;
                }
            });
        }
    }

    var api = {
        annotation: {
            value: function (typename) {
                if (xsd.doc) {
                    var anno = null;
                    Array.prototype.slice.call(xsd.doc.querySelectorAll("simpleType,complexType"))
                        .some(function (type) {
                        if (type.getAttribute("name") === typename) {
                            anno = type.getElementsByTagName("documentation")[0].firstChild.nodeValue;
                            return true;
                        }
                    });
                    return anno;
                }
            },

            property: function (selector, property, typename) {
                Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (elem) {
                    var anno = api.annotation.value(typename);
                    elem.setAttribute(property, anno);
                });
            },

            data: function (selector, property, typename) {
                if (typeof jQuery !== "undefined") {
                    var anno = api.annotation.value(typename);
                    $(selector).data(property, anno);
                }
            },

            html: function (selector, typename) {
                Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (elem) {
                    var anno = api.annotation.value(typename);
                    elem.innerHTML = anno;
                });
            }
        },

        validate: function (value, typename, displayname) {
            var validator = new XsSimpleTypeValidator(xsd.doc.querySelector("simpleType[name='" + typename + "']"),
                displayname || typename);
            return validator.validate(value);
        },

        enumeration: function (typename, append) {
            if (api.collection[typename] && !append) {
                return api.collection[typename];

            } else {
                if (!api.collection[typename]) api.collection[typename] = [];
                if (xsd.doc) {
                    elem = xsd.doc.querySelector("simpleType[name='" + typename + "']");
                    if (elem.getAttribute("name") === typename) {
                        Array.prototype.slice.call(elem.getElementsByTagName("enumeration"))
                            .forEach(function(enumer){
                            var label = null;
                            if (enumer.getElementsByTagName("documentation").length > 0) {
                                label = enumer.getElementsByTagName("documentation")[0].firstChild.nodeValue;
                            } else {
                                label = enumer.getAttribute("value");
                            }

                            api.collection[typename].push({
                                value: enumer.getAttribute("value"),
                                label: label
                            });
                        });
                    }
                }

                console.log("Loaded " + api.collection[typename].length +
                    " enumerated options from simpleType: " + typename);

                return api.collection[typename];
            }
        },

        select: function (selector, typename, formatter) {
            api.enumeration(typename);

            domListener(selector, function (elem) {
                var values = api.enumeration(typename);
                populate(elem, values, formatter);
            });
        },

        collection: collection,
        ready: ready,
        xsd: xsd
    };

    if (input) {
        var parsepromise = xmlparser.parse(input);
        parsepromise.then(function (parsed) {
            xsd = parsed;
            ready.resolve(api);
        });
        parsepromise.catch(function (message) {
           ready.reject(message);
        });

    } else if (typeof xmlschema !== "undefined" && typeof xmlschemadocument !== "undefined") {
        xsd = xmlschemadocument;
        ready.resolve(api);
    } else {
        ready.reject("No xsd was provided. usage: xsdoptions(xsd);");
    }

    return ready.promise();
};

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

    function parseSchema(toparse, tree) {
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
                    if (tree) constructTree(result.doc.firstChild, tree, false);
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