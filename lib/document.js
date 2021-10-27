const _ = require('lodash');
const path = require('path');
const helper = (module.exports = {
  formatResponse: (responses) => {
    const fmtResponses = {};
    _.forEach(responses, (response, status) => {
      const properties = sails.config['swagger-generator'].defaults.responses[status];

      properties.content['application/json'].schema.properties.data = {
        type: 'object',
        properties: response,
      };

      fmtResponses[status] = properties;
    });

    return {
      responses: fmtResponses,
    };
  },

  formatValidateRequest: (requests) => {
    const fmtRequests = {};

    _.forEach(requests, (request, key) => {
      let fmtRequest = {
        required: false,
        schema: {
          type: [],
        },
      };

      switch (Array.isArray(request)) {
        case true:
          for (const value of request) {
            switch (typeof value) {
              case 'string':
                if (value === 'required') {
                  fmtRequest.required = true;
                } else {
                  fmtRequest.schema.type.push(value);
                }
                break;

              case 'object':
                fmtRequest.in = value.in || 'query';
                fmtRequest.description = value.description || '';
                fmtRequest.example = value.example || '';

                fmtRequest.schema.enum = value.enum || undefined;
                break;
              default:
            }
          }
          break;
        case false:
          if (request.in === 'json') {
            fmtRequest = request;
          } else {
            fmtRequest.required = request.required || false;
            fmtRequest.schema.type = request.type;
            fmtRequest.schema.enum = request.enum || undefined;

            fmtRequest.in = request.in || 'query';
            fmtRequest.description = request.description || '';
            fmtRequest.example = request.example || '';
          }
          break;
        default:
      }

      fmtRequests[key] = fmtRequest;
    });

    return fmtRequests;
  },

  formatRequest: (requests) => {
    const parameters = [];
    const properties = {};

    _.forEach(requests, (request, key) => {
      if (Array.isArray(request.type)) {
        request.type.join('|');
      }
      request.default = request.example;

      switch (request.in) {
        case 'json':
          properties[key] = request;
          break;
        case 'path':
        case 'query':
          request.name = key;
          parameters.push(request);
          break;
        default:
      }
    });

    return {
      parameters,
      properties,
    };
  },

  formatSwagger: ({
    fileName,
    apiRequest,
    // apiResponse,
    formated = false,
  }) => {
    const fmtApiRequest = helper.formatValidateRequest(apiRequest);
    const { parameters, properties } = helper.formatRequest(fmtApiRequest);

    // const { responses } = helper.formatResponse(apiResponse);

    const apiName = path.basename(fileName, '.js');
    const result = {
      actions: {
        [apiName]: {},
      },
    };

    if (parameters.length > 0) {
      result.actions[apiName].parameters = parameters;
    }

    if (Object.keys(properties).length > 0) {
      result.actions[apiName].requestBody = {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties,
            },
          },
        },
      };
    }

    // if (responses) {
    // result.actions[apiName].responses = responses;
    // }

    return result;
  },

  getRequestAndSwagger: (fileName, actionName) => {
    const apiRequest = sails.config.document.requests[`${actionName}Request`];
    const apiResponse = sails.config.document.responses[`${actionName}Response`];
    const swagger = helper.formatSwagger({
      fileName,
      apiRequest,
      apiResponse,
      formated: false,
    });

    return {
      apiRequest,
      swagger,
    };
  },
});
