/*
* helper - Function
* @description: Helper in validation types
*/

const validator = require('./validator');

module.exports = async function (options, key, validations, param) {
  function cleanVal(str) { return str.replace(/\s/g, '').toLowerCase(); }
  const errors = [];

  // CASE 1
  // req.validate( { 'myparam': 'string' });
  if (_.isString(validations)) {
    return await validator.stringValidationCheck(options, key, cleanVal(validations), param);
  }
  // CASE 2
  // req.validate( { 'myparam': (val) => { return val === 1 } });
  if (_.isFunction(validations)) {
    try {
      let test;
      if (validations.constructor.name === 'AsyncFunction') {
        test = await validations(param);
      } else {
        test = validations(param);
      }

      if (!_.isBoolean(test)) {
        return { error: options.validatorResponseErrorMessage(key) };
      }
      return test ? { value: param } : { error: options.validatorFailedErrorMessage(key) };
    } catch (e) {
      return { error: options.unexpectedErrorMessage(key) };
    }
  }
  // CASE 3
  // req.validate( { 'myparam': { enum: [ 'a', 'b', 'c'], default: 'a', convert: false });
  else if (_.isPlainObject(validations)) {
    return await validator.mixedValidationsCheck(options, key, validations, param);
  }
  // CASE 4 (CASE 1 + CASE 3)
  // req.validate( { 'myparam': ['string', { enum: [ 'a', 'b', 'c'], default: 'a', convert: false }]);
  else if (_.isArray(validations)) {
    // find non-string validations
    const objectValidationsArray = _.filter(validations, (item) => _.isPlainObject(item));
    let mergedValidation = {};
    for (let i = 0; i < objectValidationsArray.length; i++) {
      mergedValidation = _.merge(mergedValidation, objectValidationsArray[i]);
    }

    // find the validation string
    const foundValidations = _.filter(validations, (item) => _.isString(item));

    if (_.isArray(foundValidations) && foundValidations.length > 0) {
      let hasError = false;
      let check;
      for (let i = 0; i < foundValidations.length; i++) {
        check = await validator.stringValidationCheck(options, key, cleanVal(foundValidations[i]), param);
        if (check.error) {
          errors.push(check.error);
          hasError = true;
        }
      }

      if (!hasError && check) {
        param = check.value; // in case the param has been updated thought converter.
      } else {
        _.forEach(foundValidations, (item) => {
          errors.push(item.message);
        });
      }
    }

    // CASE 4a
    // req.validate( { 'myparam': ['string', { enum: [ 'a', 'b', 'c']}, { default: 'a', convert: false }]);
    const mixedCheck = await validator.mixedValidationsCheck(options, key, mergedValidation, param);

    if (_.has(mixedCheck, 'value')) {
      param = mixedCheck.value;
    }

    if (mixedCheck.error) {
      errors.push(mixedCheck.error);
    }

    // check errors and return
    if (errors.length > 0) {
      return { error: errors };
    }
    return { value: param };
  } else {
    return { error: options.formatErrorMessage(key) };
  }
};
