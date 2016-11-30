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