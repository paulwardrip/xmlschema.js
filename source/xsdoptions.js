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
