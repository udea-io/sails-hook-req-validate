const _ = require('lodash');
const helper = require('./helper');
const validator = require('./validator');

const validater = module.exports = async function (rules, options, callback) {
  // if the second parameter 'options' is function, let's treat it as a callback
  if (arguments.length === 2 && _.isFunction(options)) {
    callback = options;
    options = null;
  }

  const { req } = this;
  const { res } = this;
  const config = _.isFunction(sails.config.validate) ? sails.config.validate(req, res) : _.isPlainObject(sails.config.validate) ? sails.config.validate : {};
  validator.initValTypes(config);

  let params = req ? req.allParams() : {};
  const parsedParams = {};
  const errors = [];

  // -----------------------------
  // --- Default Option Values ---
  // -----------------------------
  options = _.defaults({}, options, config, {
    validater,
    hasProperties: null,
    responseMethod: res ? res.badRequest : null,
    sendResponse: true,
    autoThrowError: false,
    passedRequest: false,
    returnAllParams: true,
    onErrorOutput(errMessage, messages, invalidKeys) {
      return {
        message: errMessage,
        messages,
        invalid: invalidKeys,
      };
    },
    getParentKey(key) {
      return this.hasProperties ? `${this.hasProperties.key}.${key}` : key;
    },
    i18n(errMsg, key) {
      return sails.__(errMsg, key);
    },
    requiredErrorMessage(key) {
      return {
        message: `The '%s' parameter is required.`,
        key: this.getParentKey(key),
      };
    },
    formatErrorMessage(key) {
      return {
        message: `The '%s' parameter has an invalid format.`,
        key: this.getParentKey(key),
      };
    },
    typeErrorMessage(key, typeMessage) {
      return {
        message: [
          `The '%s' parameter should be a`,
          typeMessage,
          `.`
        ],
        key: this.getParentKey(key),
      };
    },
    inputErrorMessage(key, typeMessage) {
      return {
        message: [
          `The '%s' parameter has an invalid input type, it should be a`,
          typeMessage,
          `.`
        ],
        key: this.getParentKey(key),
      };
    },
    orInputErrorMessage(key, typeMessages) {
      return {
        msessage: [
          `The '%s' parameter has an invalid input type, it should be one of the following types;`
        ].concat(typeMessages),
        key: this.getParentKey(key),
      };
    },
    converterErrorMessage(key) {
      return {
        message: `The '%s' converter failed.`,
        key: this.getParentKey(key),
      };
    },
    validatorFailedErrorMessage(key) {
      return {
        message: `The '%s' validation response must be boolean.`,
        key: this.getParentKey(key),
      };
    },
    validatorResponseErrorMessage(key) {
      return {
        message: `The '%s' validation failed.`,
        key: this.getParentKey(key),
      };
    },
    enumErrorMessage(key) {
      return {
        message: `The '%s' enum value not found.`,
        key: this.getParentKey(key),
      };
    },
    unexpectedErrorMessage(key) {
      return {
        message: `The '%s' unexpected error.`,
        key: this.getParentKey(key),
      };
    },
  });
  // -----------------------------

  const required = 'required';
  function isRequired(value) {
    if (_.isString(value) || _.isArray(value)) {
      return value.indexOf(required) >= 0;
    } else if (_.isPlainObject(value)) {
      return value.required;
    } else {
      return false;
    }
  }
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
  function isInParams(keyStr) { return _.has(params, keyStr); }
  function hasCb(cbFunc) { return (_.isFunction(cbFunc)); }
  function errorBuilder(errs) {
    let output = '';
    let errKeys = [];
    let errMessages = [];
    _.forEach(errs, (err) => {
      if (err.invalid) {
        errKeys = errKeys.concat(err.invalid);
        output += `${err.message.trim()} `;
      } else if (err.key) {
        errKeys.push(err.key);

        let messages;
        if (!_.isArray(err.message)) {
          messages = [err.message];
        } else {
          messages = err.message;
        }

        _.forEach(messages, (message) => {
          output += `${options.i18n(message, err.key).trim()} `;
          errMessages.push(options.i18n(message, err.key).trim());
        });
      }
    });

    return options.onErrorOutput(output.trim(), errMessages, _.uniq(_.compact(errKeys)));
  }
  function returnData(cb, error, data) {
    if (options.returnAllParams === true) {
      data = _.merge(params, data);
    }

    // check if has callback
    if (hasCb(cb)) {
      cb(error, data); // no return, b/c callback also returns data
    }

    if (!_.isNil(error) && !options.hasProperties) {
      if (options.sendResponse === true && options.responseMethod) {
        options.responseMethod(error);
      }

      if (config.autoThrowError) {
        throw error;
      }
    }


    let result;
    if (config.passedRequest && !options.hasProperties) {
      result = _.isNil(error) ? data : null;
    } else {
      result = _.isNil(error) ? {
        request: data,
        error: null
      } : {
        request: null,
        error,
      }
    }

    return result;
  }

  if (options.hasProperties) {
    params = options.hasProperties.params;
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
          errors.push(options.requiredErrorMessage(key));
        }
      } else {
        const param = _.get(params, key);
        const validation = await helper(options, key, value, param);
        if (validation.error) {
          validation.error = _.isArray(validation.error) ? validation.error : [validation.error];
          _.forEach(validation.error, (err) => {
            errors.push(err);
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
              errors.push(options.requiredErrorMessage(_key));
            }
          } else {
            const param = params[_key];
            const validation = await helper(options, _key, _value, param);
            if (validation.error) {
              validation.error = _.isArray(validation.error) ? validation.error : [validation.error];
              _.forEach(validation.error, (err) => {
                errors.push(err);
              });
            } else {
              parsedParams[_key] = validation.value; // <-- PASS-THOUGH DATA
            }
          }
        }
      }
      // ERROR - Invalid rule format
      else {
        errorr.push(options.formatErrorMessage(rule));
      }
    }
  }

  // Error Handling
  if (errors.length > 0) {
    const errorOutput = errorBuilder(errors);
    return returnData(callback, errorOutput, null); // <-- RETURN ERROR
  }

  return returnData(callback, null, parsedParams); // <-- RETURN DATA
};
