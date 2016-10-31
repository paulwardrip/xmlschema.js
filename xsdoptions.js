var xsdoptions = function() {
    function defer() {
        if (typeof jQuery !== 'undefined') {
            return $.Deferred();

        } else if (typeof Promise !== 'undefined') {
            return function () {
                var resolve;
                var reject;
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
            return function () {
                var resolved = false;
                var rejected = false;
                var call = [];
                var catcher = [];
                var obj;

                return {
                    resolve: function (result) {
                        resolved = true;
                        obj = result;
                        call.forEach(function (callback) {
                            callback(obj);
                        });
                    },

                    reject: function (reason) {
                        rejected = true;
                        obj = reason;
                        catcher.forEach(function (callback) {
                            callback(obj);
                        });
                    },

                    promise: {
                        then: function (callback) {
                            if (resolved) {
                                callback(obj);
                            } else {
                                call.push(callback);
                            }
                        },
                        catch: (function (callback) {
                            if (rejected) {
                                callback(obj);
                            } else {
                                catcher.push(callback);
                            }
                        })
                    }
                }
            }();
        }
    }

    function parse(input) {
        var out = {doc: null, str: null};
        var deferred = defer();

        function xmlString(str) {
            if (typeof jQuery !== "undefined") {
                out.doc = $.parseXML(str);
                out.str = str;
                deferred.resolve(out);

            } else if (typeof DOMParser !== "undefined") {
                var par = new DOMParser();
                out.doc = par.parseFromString(str, "application/xml");
                out.str = str;
                deferred.resolve(out);
            }
        }

        if (typeof input === "object") {
            if (input instanceof XMLDocument) {
                out.doc = input;
                out.str = new XMLSerializer().serializeToString(input);

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
                    $.get(input, {}, function (xml) {
                        xmlString(xml);
                    }, "text");

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
                                    deferred.resolve(out);
                                }
                            }
                        };
                        xhr.send(null);

                    } else {
                        out.error = "Unable to request document, browser does not support " +
                            "XMLHttpRequest and jQuery is not available.";
                        deferred.resolve(out);
                    }

                }
            } else {
                xmlString(input);
            }
        }

        return deferred.promise();
    }

    function domListener (selector, callback) {
        // Create a mutation observer to automatically hook up any dynamically added form fields.
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    Array.prototype.slice.call(node.querySelectorAll(selector)).forEach(function (elem) {
                        callback(elem);
                    })
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

    return {
        load: function (xsd) {
            var promise = parse(xsd);

            xsdoptions.ready = promise.then;
            return promise;
        },

        data: function (typename, append) {
            if (xsdoptions.collection[typename] && !append) {
                return xsdoptions.collection[typename];

            } else {
                if (!xsdoptions.collection[typename]) xsdoptions.collection[typename] = [];
                if (xsdoptions.xsd) {
                    Array.prototype.slice.call(xsdoptions.xsd.getElementsByTagName("simpleType"))
                        .forEach(function (elem) {
                        if (elem.getAttribute("name") === typename) {
                            Array.prototype.slice.call(xsdoptions.xsd.getElementsByTagName("simpleType"))
                                .forEach(function(enumer){
                                var label = null;
                                if (enumer.getElementsByTagName("documentation")) {
                                    label = enumer.getElementsByTagName("documentation")[0].firstChild.nodeValue;
                                } else {
                                    label = enumer.getAttribute("value");
                                }

                                xsdoptions.collection[typename].push({
                                    value: enumer.getAttribute("value"),
                                    label: label
                                });
                            });
                        }
                    });
                }

                console.log("Loaded " + xsdoptions.collection[typename].length +
                    " enumerated options from simpleType: " + typename);

                return xsdoptions.collection[typename];
            }
        },

        link: function (selector, typename, formatter) {
            if (xsdoptions.ready) {
                xsdoptions.ready(function () {
                    xsdoptions.data(typename);

                    domListener(selector, function (elem) {
                        var values = xsdoptions.data(typename);
                        xsdoptions.populate(elem, values, formatter);
                    });
                });
            }
        }
    };
}();
