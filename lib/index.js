const _ = require('lodash');
const helper = require('./helper');
const validator = require('./validator');

module.exports = async function (rules, options, callback) {
  // if the second parameter 'options' is function, let's treat it as a callback
  if (arguments.length === 2 && _.isFunction(options)) {
    callback = options;
    options = null;
  }
  const { req } = this;
  const { res } = this;
  const config = _.isFunction(sails.config.validate) ? sails.config.validate(req, res) : _.isPlainObject(sails.config.validate) ? sails.config.validate : {};
  validator.initValTypes(config);

  const params = req.allParams();
  const parsedParams = {};
  const errors = [];

  // -----------------------------
  // --- Default Option Values ---
  // -----------------------------
  options = _.defaults({}, options, config, {
    responseMethod: res.badRequest,
    sendResponse: true,
    returnAllParams: true,
    onErrorOutput(errMessage, invalidKeys) {
      return { message: errMessage, invalid: invalidKeys };
    },
    requiredErrorMessage(keys) {
      keys = keys || [];
      const isare = (keys.length > 1) ? 'are' : 'is';
      const s = (keys.length > 1) ? 's' : '';
      return `The "${keys.join('", "')}" parameter${s} ${isare} required.`;
    },
    formatErrorMessage(key) {
      return `The "${key}" parameter has an invalid format.`;
    },
    typeErrorMessage(key, typeMessage) {
      const a = (typeMessage && typeMessage.length) ? /[aeiouAEIOU]/.test(typeMessage.charAt(0)) ? 'an' : 'a' : '';
      return `The "${key}" parameter should be ${a} ${typeMessage}.`;
    },
    inputErrorMessage(key, typeMessage) {
      const a = (typeMessage && typeMessage.length) ? /[aeiouAEIOU]/.test(typeMessage.charAt(0)) ? 'an' : 'a' : '';
      return `The "${key}" parameter has an invalid input type${typeMessage ? `, it should be ${a} ${typeMessage}` : ''}.`;
    },
    orInputErrorMessage(orKey, orTypeMessages) {
      return `Invalid input type, it should be one of the following types; ${orTypeMessages}.`;
    },
  });
  // -----------------------------

  const required = 'required';
  function isRequired(value) { return _.isString(value) || _.isArray(value) ? value.indexOf(required) !== -1 : false; }
  function cleanRequired(value) {
    if (isRequired(value)) {
      if (_.isString(value)) {
        value = value.replace(required, '');
      } else if (_.isArray(value)) {
        value.splice(value.indexOf(required), 1);
      }
    }
    return value;
  }
  function isInParams(keyStr) { return _.has(req.allParams(), keyStr); }
  function hasCb(cbFunc) { return (_.isFunction(cbFunc)); }
  function errorBuilder(errs, errKeys) {
    let output = '';
    if (_.isString(errs)) { output = errs; } else if (_.isArray(errs)) { output = _.forEach(errs, (err) => { output += `${err.trim()} `; }); }
    return options.onErrorOutput(output.trim(), _.uniq(_.compact(errKeys)));
  }
  function outputReqError(keys) {
    keys = _.isArray(keys) ? keys : [keys];
    return options.requiredErrorMessage(keys);
  }
  function returnData(cb, error, data) {
    if (options.returnAllParams === true) {
      data = _.merge(params, data);
    }
    // check if has callback
    if (hasCb(cb)) {
      cb(error, data); // no return, b/c callback also returns data
    }

    if (!_.isNull(error) && config.autoThrowError) {
      throw error;
    }

    let result;

    if (config.autoThrowError) {
      result = _.isNull(error) ? data : false;
    } else {
      result = _isNull(error) ? {
        request: data,
        error: null
      } : {
        request: null,
        error,
      }
    }

    return result;
  }

  /*
   * CASE 1
   * ex) req.validate('myparam')
   * Check if the rules are a simple single param and if the param exist
   */
  if (_.isString(rules)) {
    const key = rules;
    if (isInParams(key)) {
      parsedParams[key] = params[key]; // <-- PASS-THOUGH DATA
    }
  }
  /*
   * CASE 2
   * ex) req.validate({ 'myparam': 'string' });
   * ex) req.validate({ 'myparam1': 'string', 'myparam2': 'string' });
   * ex) req.validate({ 'myparam': <MIXED_VALIDATIONS> });
   * Check if the rules are an Object and in that case check the type of them
   */
  else if (_.isPlainObject(rules)) {
    for (const key in rules) {
      let value = rules[key];
      let bRequired = false;
      if (isRequired(value)) {
        bRequired = true;
        value = cleanRequired(value);
      }

      if (!isInParams(key)) {
        if (bRequired) {
          errors.push({ // <-- ERROR
            message: outputReqError(key),
            key,
          });
        }
      } else {
        const param = _.get(params, key);
        const validation = await helper(options, key, value, param);
        if (validation.error) {
          validation.error = _.isArray(validation.error) ? validation.error : [validation.error];
          _.forEach(validation.error, (err) => {
            errors.push({ // <-- ERROR
              message: err,
              key,
            });
          });
        } else {
          parsedParams[key] = validation.value; // <-- PASS-THOUGH DATA
        }
      }
    }
  }
  /*
   * CASE 3
   * ex) req.validate([ 'myparam' ]);
   * ex) req.validate([{ 'myparam': 'string' }]);
   * ex) req.validate([{ 'myparam1': 'string' }, { 'myparam2': 'string' }]);
   * ex) req.validate([{ 'myparam': <MIXED_VALIDATIONS> }]);
   * Check if the rules are an Array of elements
   * If the value is a String, check if it exists in the params
   * If the value is an Object, check by key/value if the type is valid
   * In the a different case, return a not valid type error
   */
  else if (_.isArray(rules)) {
    for (const rule of rules) {
      // CASE 3a  ex) req.validate([ 'myparam' ]);
      if (_.isString(rule)) {
        const key = rule;
        if (isInParams(key)) {
          parsedParams[key] = params[key]; // <-- PASS-THOUGH DATA
        }
      }
      // CASE 3b  ex) req.validate([{ 'myparam': 'string' }]);
      else if (_.isPlainObject(rule)) {
        for (const _key in rule) {
          let _value = rule[_key];
          let bRequired = false;
          if (isRequired(_value)) {
            bRequired = true;
            _value = cleanRequired(_value);
          }

          if (!isInParams(_key)) {
            if (bRequired) {
              errors.push({ // <-- ERROR
                message: outputReqError(_key),
                key: _key,
              });
            }
          } else {
            const param = params[_key];
            const validation = await helper(options, _key, _value, param);
            if (validation.error) {
              validation.error = _.isArray(validation.error) ? validation.error : [validation.error];
              _.forEach(validation.error, (err) => {
                errors.push({ // <-- ERROR
                  message: err,
                  key: _key,
                });
              });
            } else {
              parsedParams[_key] = validation.value; // <-- PASS-THOUGH DATA
            }
          }
        }
      }
      // ERROR - Invalid rule format
      else {
        errors.push({ // <-- ERROR
          message: options.formatErrorMessage(rule),
          key: null,
        });
        sails.log.error(`${rule} is an invalid format. Please check the document (https://www.npmjs.com/package/sails-hook-req-validate)`);
      }
    }
  }

  // Error Handling
  if (errors.length > 0) {
    const errMsg = _.map(errors, (err) => err.message);
    const errKey = _.map(errors, (err) => err.key);
    const errorOutput = errorBuilder(errMsg.join(' '), errKey);
    if (options.sendResponse === true) {
      options.responseMethod(errorOutput);
    }
    return returnData(callback, errorOutput, null); // <-- RETURN ERROR
  }

  return returnData(callback, null, parsedParams); // <-- RETURN DATA

};
