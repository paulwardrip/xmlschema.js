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