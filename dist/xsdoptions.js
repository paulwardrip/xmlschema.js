var xmlparser = {
    parse: function (input) {
        var out = {doc: null, str: null};
        var deferred = xmlparser.deferred();

        function xmlString(str) {
            if (typeof jQuery !== "undefined") {
                try {
                    out.doc = $.parseXML(str);
                    out.str = str;
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
                        xmlString(xml);
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
                                    xmlString(this.responseText);
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
    this.enumeration = enumeration;

    Array.prototype.slice.call(this.xml.getElementsByTagName("enumeration")).forEach(function (enumnode) {
        enumeration.push(enumnode.getAttribute("value"));
    });

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
            this.enumeration.forEach(function (value) {
                if (value === value) {
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
