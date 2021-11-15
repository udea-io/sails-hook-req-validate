describe.only('09 Feature Test', function () {
  it('test', function (done) {
    sails.request({
      url: '/test',
      method: 'post',
    }, {
      boolean: true,
      number: 1,
      float: 2.3,
      int: 4,
      custom1: 1,
      custom2: 2,
      custom3: 3,
      object: {
        a: 1,
        b: '2',
      },
    }, function (err, res) {
      if (err) return done(err);
      res.statusCode.should.be.equal(200);
      console.log(typeof res.body);
      console.log(res.body);
      (typeof res.body.boolean).should.be.equal('boolean');
      (typeof res.body.number).should.be.equal('number');
      (typeof res.body.float).should.be.equal('number');
      (typeof res.body.int).should.be.equal('number');
      (typeof res.body.custom1).should.be.equal('number');
      (typeof res.body.custom2).should.be.equal('number');
      (typeof res.body.custom3).should.be.equal('string');

      return done();
    });
  });

  it('new struct', function (done) {
    sails.request({
      url: '/struct',
      method: 'post',
    }, {
      // string: 'string',
      string: 1,
      // array: ['array'],
      array: '["a"]',
      object: {
        platform: 'A',
      },
    }, function (err, res) {
      if (err) return done(err);
      res.statusCode.should.be.equal(200);
      console.log(res.body);

      return done();
    });
  });
});
