module.exports = async function (req, res) {


  const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      'number',
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
  };

  // const result = await req.validate(filter, {
    // sendResponse: false,
  // }, function (err, params) {
    // if (err) return res.badRequest(err);
    // return res.ok(params);
  // });

  const result = await req.validate({
    boolean: 'boolean',
    number: 'number',
    float: 'float',
    int: 'int',
  }, {
    sendResponse: false,
    autoThrowError: false,
  });

  res.ok(result);
};
