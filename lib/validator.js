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

  async function checkValidation(options, sKey, sValidationType, sParam, shouldSkipConverter = false) {
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
    if (_.isFunction(method)
      ? method.constructor.name === 'AsyncFunction'
        ? await method(sParam) : method(sParam)
      : V[method](`${sParam}`)) { // ('' + sParam) = force to be a string type, in case the param has been ran though another converter
      if (shouldSkipConverter === true) {
        return { value: sParam };
      }
      return {
        value: _.isFunction(converter)
          ? converter.constructor.name === 'AsyncFunction'
            ? await converter(sParam) : converter(sParam)
          : sParam,
      };
    }
    return { error: options.inputErrorMessage(sKey, typesList.message) };
  }

  async function sanitizeValue(converter, param) {
    if (_.isString(converter) && valTypes.converters[converter.toLowerCase()] && _.isFunction(valTypes.converters[converter.toLowerCase()].converter)) {
      if (valTypes.converters[converter.toLowerCase()].converter.constructor.name === 'AsyncFunction') {
        return await valTypes.converters[converter.toLowerCase()].converter(param);
      }
      return valTypes.converters[converter.toLowerCase()].converter(param);
    } if (_.isFunction(converter)) {
      if (converter.constructor.name === 'AsyncFunction') {
        return await converter(param);
      }
      return converter(param);
    }
    return param;
  }

  async function checkSanitizeValue(converter, param) {
    let updatedParam = param;
    if (_.isArray(converter)) {
      for (const item of converter) {
        updatedParam = await sanitizeValue(item, updatedParam);
      }
    } else if (updatedParam) {
      updatedParam = await sanitizeValue(converter, updatedParam);
    }
    return updatedParam;
  }

  // ### Validation Type Check (validation = string)
  const stringValidationCheck = async function (options, key, validation, param, shouldSkipConverter = false) {
    // Check OR operator
    if (validation.indexOf('|') < 0) {
      // Single string validation
      return await checkValidation(options, key, validation, param, shouldSkipConverter);
    }
    // has one more more OR operators
    const orValidations = validation.replace(/\s/g, '').split('|');
    let updatedParam = param;
    let isError = false;
    let errStr = '';
    for (const val of orValidations) {
      const check = await checkValidation(options, key, val, updatedParam, shouldSkipConverter);
      errStr += (valTypes.types[val] ? `${valTypes.types[val].message} ` : '');
      if (check.error) {
        errStr += `${check.error} `;
        isError = true;
      } else {
        updatedParam = check.value; // updated checked param in case it has ran thought converter(s)
      }
    }

    if (isError) {
      return { error: options.orInputErrorMessage(key, errStr) };
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

    // custom type
    if (validations.validator && _.isFunction(validations.validator)) {
      let test;
      if (validations.validator.constructor.name === 'AsyncFunction') {
        test = await validations.validator(param);
      } else  {
        test = validations.validator(param);
      }

      if (!_.isBoolean(test)) {
        return { error: 'The validation response must be boolean.' };
      }

      if (!test) {
        return { error: 'The validation failed.' };
      }
    }

    // enum
    else if (validations.enum) {
      // if the param is in enum
      if (validations.enum.indexOf(param) >= 0) {
        updatedParam = await checkSanitizeValue(validations.converter, param);
      } else {
        return { error: 'enum value not found.' };
      }
    }

    // if the param undefined BUT has a default value
    if (_.isUndefined(updatedParam) && !_.isUndefined(validations.default)) {
      updatedParam = await checkSanitizeValue(validations.converter, validations.default);
    }
    // converter
    if (!_.isUndefined(validations.converter)) {
      updatedParam = await checkSanitizeValue(validations.converter, updatedParam);
    }

    if (validations.properties) {
      await options.validater(validations.properties, {
        ...options,
        withProperties: {
          key,
          params: updatedParam,
        },
        sendResponse: false,
        autoThrowError: true,
      });
    }

    return { value: updatedParam };
  };

  return {
    stringValidationCheck,
    mixedValidationsCheck,
    initValTypes,
  };
}());
