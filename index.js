const validate = require('./lib/');
const document = require('./lib/document');

module.exports = function(sails) {
  return {
    initialize: function(cb){
      sails.document = document;
      sails.on('router:route', function(requestState) {
        requestState.req['validate'] = validate.bind(requestState);
        if (requestState.res) {
          const { req, res } = requestState;
          const config = _.isFunction(sails.config.validate) ? sails.config.validate(req, res) : _.isPlainObject(sails.config.validate) ? sails.config.validate : {};

          const {
            responseList = [],
          } = config;

          for (const key of Object.keys(res)) {
            if (responseList.indexOf(key) !== -1
              && typeof res[key] === 'function') {
              const response = res[key];
              if (response.constructor.name === 'AsyncFunction') {
                requestState.res[key] = async (...argv) => {
                  if (requestState.res.hasValidateError) { return };
                  return response(...argv);
                };
              } else {
                requestState.res[key] = (...argv) => {
                  if (requestState.res.hasValidateError) { return };
                  return response(...argv);
                };
              }
            }
          }
        }
      });
      return cb();
    }
  }
};
