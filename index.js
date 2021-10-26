const validate = require('./lib/');
const document = require('./lib/document');

module.exports = function(sails) {
  return {
    initialize: function(cb){
      sails.document = document;
      sails.on('router:route', function(requestState) {
        requestState.req['validate'] = validate.bind(requestState);
      });
      return cb();
    }
  }
};
