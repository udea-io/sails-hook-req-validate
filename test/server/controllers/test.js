const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));
module.exports = {
  validate: async function (req, res) {
    const filter = {
      number: 'required|number',
      string: 'required|string',
      nullable: 'nullable',
      custom1: [
        'required',
        {
          validator: async (val) => {
            await sleep(1000);
            return val > 0;
          },
        },
      ],
      custom2: [
        'required',
        {
          validator: (val) => {
            return val > 1;
          },
        },
      ],
      custom3: [
        'required',
        {
          validator: (val) => {
            return val > 1;
          },
          converter: async (val) => {
            await sleep(1000);
            return val.toString();
          },
        },
      ],
      object: [
        'required',
        'object',
        {
          properties: {
            a: 'required|number',
            b: 'required|string',
          },
        },
      ],
    };

    const result = await req.validate({
      boolean: 'boolean',
      number: 'number',
      float: 'float',
      int: 'int',
      custom1: filter.custom1,
      custom2: filter.custom2,
      custom3: filter.custom3,
      object: filter.object,
    }, {
      sendResponse: false,
      autoThrowError: false,
    });

    res.ok(result);
  },

  struct: async function (req, res) {
    const filter = {
      string: {
        type: 'string',
        required: true,
        description: '',
        in: 'json',
        example: '',
      },
      array: {
        type: 'array',
        required: true,
        description: '',
        in: 'json',
        example: '',
      },
      object: {
        type: 'object',
        in: 'json',
        properties: {
          platform: {
            type: 'string',
            required: true,
            description: '',
            enum: ['A', 'B'],
            in: 'json',
            example: 'A',
          },
        },
      },
    };

    const result = await req.validate(filter, {
      sendResponse: false,
      autoThrowError: false,
    });

    res.ok(result);
  },
};
