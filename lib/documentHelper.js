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
      const fmtRequest = {
        required: false,
        schema: {
          type: [],
        },
      };

      for (const value of request) {
        switch (typeof value) {
          case 'string':
            if (value === 'required') {
              // fmtRequest.required = true;
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
          delete request.in;
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
    formated = true,
  }) => {
    const fmtApiRequest = formated
      ? apiRequest
      : helper.formatValidateRequest(apiRequest);

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
});
