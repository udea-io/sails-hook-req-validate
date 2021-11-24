const V = require('validator');
const valTypes = require('./validationTypes');

module.exports = (function () {
  function initValTypes(config = {}) {
    if (config.types) {
      valTypes.types = {
        ...valTypes.types,
        ...config.types,
      };
    }

    if (config.converters) {
      valTypes.converters = {
        ...valTypes.converters,
        ...config.converters,
      };
    }
  }

  async function checkValidation(options, sKey, sValidationType, sParam) {
    if (sValidationType === '') {
      return { value: sParam };
    }
    sValidationType = sValidationType.toLowerCase(); // change to all lower case to match
    const typesList = valTypes.types[sValidationType];
    if (!typesList) {
      return { error: options.formatErrorMessage(sKey) };
    }

    // sParam = '' + sParam;   // force to be a string type, in case the param has been ran though another converter
    const { method } = typesList;
    const { converter } = typesList;

    if (_.isFunction(converter)) {
      sParam = converter.constructor.name === 'AsyncFunction' ? await converter(sParam) : converter(sParam);
    }

    if (_.isFunction(method)
      ? method.constructor.name === 'AsyncFunction'
        ? await method(sParam) : method(sParam)
      : V[method](`${sParam}`)) { // ('' + sParam) = force to be a string type, in case the param has been ran though another converter
      return { value: sParam };
    }
    return { error: options.inputErrorMessage(sKey, typesList.message) };
  }

  async function sanitizeValue(converter, param, options) {
    if (_.isString(converter) && valTypes.converters[converter.toLowerCase()] && _.isFunction(valTypes.converters[converter.toLowerCase()].converter)) {
      if (valTypes.converters[converter.toLowerCase()].converter.constructor.name === 'AsyncFunction') {
        return await valTypes.converters[converter.toLowerCase()].converter(param);
      }
      return valTypes.converters[converter.toLowerCase()].converter(param);
    } if (_.isFunction(converter)) {
      if (converter.constructor.name === 'AsyncFunction') {
        return await converter(param, options);
      }
      return converter(param, options);
    }
    return param;
  }

  async function checkSanitizeValue(converter, param, options) {
    let updatedParam = param;
    if (_.isArray(converter)) {
      for (const item of converter) {
        updatedParam = await sanitizeValue(item, updatedParam, options);
      }
    } else if (updatedParam) {
      updatedParam = await sanitizeValue(converter, updatedParam, options);
    }
    return updatedParam;
  }

  // ### Validation Type Check (validation = string)
  const stringValidationCheck = async function (options, key, validation, param) {
    // Check OR operator
    if (validation.indexOf('|') < 0) {
      // Single string validation
      return await checkValidation(options, key, validation, param);
    }
    // has one more more OR operators
    const orValidations = validation.replace(/\s/g, '').split('|');
    let updatedParam = param;
    let isError = false;
    let errPool = [];
    for (const val of orValidations) {
      const check = await checkValidation(options, key, val, updatedParam);

      if (check.error) {
        errPool.push(check.error);
        isError = true;
      } else {
        updatedParam = check.value; // updated checked param in case it has ran thought converter(s)
      }
    }

    if (isError) {
      return { error: options.orInputErrorMessage(key, errPool) };
    }
    // every is good
    return { value: updatedParam, error: null };
  };

  // Mixed validations check (validations = {})
  const mixedValidationsCheck = async function (options, key, validations, param) {
    if (_.isEmpty(validations)) {
      return { value: param };
    }

    validations = _.defaults(validations, {
      validator: undefined,
      enum: undefined,
      default: undefined,
      converter: undefined,
      properties: undefined,
    });

    let updatedParam = param;

    // if the param undefined BUT has a default value
    if (_.isUndefined(updatedParam) && !_.isUndefined(validations.default)) {
      updatedParam = validations.default;
    } else if (_.isUndefined(updatedParam) && !_.isUndefined(validations.example)) {
      updatedParam = validations.example;
    }

    if (validations.type) {
      const {
        error,
        value
      } = await checkValidation(options, key, validations.type, updatedParam);

      if (error) {
        return { error };
      } else {
        updatedParam = value;
      }
    }

    // custom validator
    if (validations.validator && _.isFunction(validations.validator)) {
      let test;
      if (validations.validator.constructor.name === 'AsyncFunction') {
        test = await validations.validator(param, options);
      } else  {
        test = validations.validator(param, options);
      }

      if (!_.isBoolean(test)) {
        return { error: options.validatorResponseErrorMessage(key) };
      }

      if (!test) {
        return { error: options.validatorFailedErrorMessage(key) };
      }
    }

    // custom converter
    if (!_.isUndefined(validations.converter)) {
      try {
        updatedParam = await checkSanitizeValue(validations.converter, updatedParam);
      } catch (err) {
        return { error: options.formatErrorMessage(key) };
      }
    }

    // enum
    else if (validations.enum) {
      // if the param is in enum
      if (validations.enum.indexOf(param) >= 0) {
        updatedParam = await checkSanitizeValue(validations.converter, param);
      } else {
        return { error: options.enumErrorMessage(key) };
      }
    }


    if (validations.properties) {
      const { error } = await options.validater(validations.properties, {
        ...options,
        hasProperties: {
          key: options.getParentKey(key),
          params: updatedParam,
        },
      });
      if (error) return { error };
    }

    return { value: updatedParam };
  };

  return {
    stringValidationCheck,
    mixedValidationsCheck,
    initValTypes,
  };
}());
