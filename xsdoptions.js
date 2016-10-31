var xsdoptions = {
    load: function (url) {
        var promise = $.get(url, {}, function (xml) {
            xsdoptions.raw = xml;
            xsdoptions.xsd = $($.parseXML(xml));
            xsdoptions.collection = {};
        }, "text");

        xsdoptions.ready = promise.done;
        return promise;
    },

    data: function (typename, append) {
        if (xsdoptions.collection[typename] && !append) {
            return xsdoptions.collection[typename];

        } else {
            if (!xsdoptions.collection[typename]) xsdoptions.collection[typename] = [];
            if (xsdoptions.xsd) {
                xsdoptions.xsd.find("simpleType[name='" + typename + "']").find("enumeration").each(function () {
                    var label = null;
                    $(this).find("documentation").each(function() { label = $(this).text(); });
                    xsdoptions.collection[typename].push({ value: $(this).attr("value"), label: (label) ? label : $(this).attr("value") });
                })
            }

            console.log ("Loaded " + xsdoptions.collection[typename].length + " enumerated options from simpleType: " + typename);

            return xsdoptions.collection[typename];
        }
    },

    link: function (selector, typename, formatter) {
        if (xsdoptions.ready) {
            xsdoptions.ready(function () {
                xsdoptions.data(typename);

                xsdoptions.domListener(selector, function () {
                    var $elem = $(this);
                    var values = xsdoptions.data(typename);
                    xsdoptions.populate($elem, values, formatter);
                });
            });
        }
    },

    domListener: function(selector, callback) {
        $(selector).each(callback);

        // Create a mutation observer to automatically hook up any dynamically added form fields.
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    $(node).find(selector).each(callback);
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
    },

    populate: function ($elem, values, formatter) {
        if ($elem.find("option").length <= 1) {
            if ($elem.find("option").length === 0) $elem.append("<option value=\"\"></option>");
            $(values).each(function () {
                if (!formatter) {
                    $elem.append("<option value=\"" + this.value + "\">" + this.label + "</option>");
                } else {
                    $elem.append(formatter(this));
                }
            });
        }
    }
};
