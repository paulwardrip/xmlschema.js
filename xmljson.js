function toXML(json) {
    var xml = "";
    
    function unwrap(tree, depth) {
        if (!depth) depth = 0;
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
                            xml += toXML(tree[node][idx], depth + 1);
                            for (var i = 0; i < depth; i++) {
                                xml += "\t";
                            }
                        } else {
                            xml += tree[node][idx];
                        }
                        xml += "</" + node + ">\n";
                    }
                } else if (node !== "attributes") {
                    for (var i = 0; i < depth; i++) {
                        xml += "\t";
                    }

                    xml += "<" + node;
                    for (var a in tree[node].attributes) {
                        xml += " " + a + "=\"" + tree[node].attributes[a] + "\"";
                    }
                    xml += ">\n";

                    xml += toXML(tree[node], depth + 1);
                    for (var i = 0; i < depth; i++) {
                        xml += "\t";
                    }
                    xml += "</" + node + ">\n";
                }
            } else {
                for (var i = 0; i < depth; i++) {
                    xml += "\t";
                }
                xml += "<" + node + ">" + tree[node] + "</" + node + ">\n";
            }
        }
    }
    
    unwrap(json, 0);
    return xml;
}

function toJSON(xml) {
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
        node.childNodes.forEach(function (child) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                if (!obj) obj = {};
                if (obj[child.tagName] && !obj[child.tagName] instanceof Array) {
                    var first = obj[child.tagName];
                    obj[child.tagName] = [ first ];
                }
                if (obj[child.tagName] instanceof Array) {
                    obj[child.tagName].push(extract(child));
                } else {
                    obj[child.tagName] = extract(child);
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                obj = child.nodeValue;
            }
        });

        node.attributes.forEach(function (child) {
            if (typeof obj !== "object") {
                var val = obj;
                obj = { value: val };
            }
            if (!obj.attributes) {
                obj.attributes = {};
            }
            obj.attributes[child.name] = child.value;
        });

        return obj;
    }

    var doc = parse(xml);
    return extract(doc.firstChild);
}

if (typeof module !== 'undefined') {
    module.exports = {
        toXML: toXML,
        toJSON: toJSON
    }
}
