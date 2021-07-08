describe('09 Feature Test', function () {
  it('test', function (done) {
    sails.request({
      url: '/test',
      method: 'post',
    }, {
      number: 1,
      string: '1',
      // string: 1,
      nullable: '',
      custom1: 1, // val > 0, sleep 1000ms
      custom2: 2, // val > 1
      // custom2: 1, // val > 1
      custom3: 2, // val > 1, to string
    }, function (err, res) {
      if (err) return done(err);
      res.statusCode.should.be.equal(200);
      res.body.custom3.should.be.equal('2');
      return done();
    });
  });
});
