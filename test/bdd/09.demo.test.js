describe.only('09 Feature Test', function () {
  it('test', function (done) {
    sails.request({
      url: '/test',
      method: 'post',
    }, {
      boolean: 'true',
      number: '1',
      float: '2.3',
      int: '4',
    }, function (err, res) {
      if (err) return done(err);
      res.statusCode.should.be.equal(200);
      (typeof res.body.boolean).should.be.equal('boolean');
      (typeof res.body.number).should.be.equal('number');
      (typeof res.body.float).should.be.equal('number');
      (typeof res.body.int).should.be.equal('number');

      return done();
    });
  });
});
