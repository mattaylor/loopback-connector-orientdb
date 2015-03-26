// Generated by CoffeeScript 1.9.0
(function() {
  var OBin, OWeb, Oriento, Promise, http, mix, operMap, typeMap, _,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __hasProp = {}.hasOwnProperty;

  Promise = require('bluebird');

  http = require('http');

  Oriento = require('oriento');

  _ = require('lodash');

  module.exports = {
    initialize: function(source, call) {
      var dbCon;
      if (source.settings.useBinary) {
        dbCon = new OBin(source.settings);
      } else {
        dbCon = new OWeb(source.settings);
      }
      source.connector = dbCon;
      source.connector.dataSource = source;
      return call && call();
    },
    oweb: function(opts) {
      return new OWeb(opts);
    },
    obin: function(opts) {
      return new OBin(opts);
    }
  };

  OWeb = (function() {
    OWeb.prototype.opts = {
      logLevel: 2,
      port: 2480,
      method: 'get',
      name: 'test',
      host: 'localhost',
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json'
      }
    };

    OWeb.prototype.type = 'OWEB';

    function OWeb(opts) {
      opts.database && (opts.name = opts.database);
      opts.username && (opts.auth = opts.username + ':' + opts.password);
      _.merge(this.opts, opts);
    }

    OWeb.prototype.auth = function(creds) {
      if (creds.type === 'basic') {
        return this.opts.auth = creds.username + ':' + creds.password;
      }
      return this.fetch({
        path: '/token/' + this.opts.name,
        body: 'grant_type=password&username=' + creds.username + '&password=' + creds.password,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then((function(_this) {
        return function(res) {
          _this.debug('AUTH:' + creds.username, res);
          _this.opts.headers.Authorization = 'Bearer ' + res.access_token;
          return res.access_token;
        };
      })(this))["catch"]((function(_this) {
        return function(res) {
          return _this.debug('AUTH ERR:', res);
        };
      })(this));
    };

    OWeb.prototype.fetch = function(opts, call) {
      var prom;
      opts = _.merge({}, this.opts, opts);
      if (opts.body) {
        opts.headers['Content-Length'] = opts.body.length;
        opts.method === 'get' && (opts.method = 'post');
      }
      this.debug('FETCH:', opts, 2);
      prom = new Promise((function(_this) {
        return function(resolve, reject) {
          var req;
          req = http.request(opts, function(res, body) {
            if (body == null) {
              body = '';
            }
            _this.cook(res.headers['set-cookie']);
            res.on('err', function(error) {
              return reject(error);
            });
            res.on('data', function(chunk) {
              return body += chunk;
            });
            return res.on('end', function() {
              try {
                return resolve(_this.resBody(JSON.parse(body)));
              } catch (_error) {
                return reject(body);
              }
            });
          });
          opts.body && req.write(opts.body);
          return req.end();
        };
      })(this));
      call && prom["catch"](call).then(function(res) {
        return call(null, res);
      });
      return prom;
    };

    OWeb.prototype.cook = function(cookie) {
      cookie && (this.opts.auth = null);
      return cookie && (this.opts.headers.Cookie = cookie);
    };

    OWeb.prototype.me = function(call) {
      return this.invoke('me', [], call);
    };

    OWeb.prototype.select = function(model, filter, sql) {
      if (filter == null) {
        filter = {};
      }
      if (sql == null) {
        sql = "select ";
      }
      filter.fields && (sql += filter.fields.join());
      model && (sql += ' from ' + model);
      filter.where && (sql += ' where ' + filter.where);
      filter.sort && (sql += ' sort by ' + filter.sort);
      filter.group && (sql += ' group by ' + filter.group);
      filter.limit && (sql += ' limit ' + filter.limit);
      filter.skip && (sql += ' skip ' + filter.skip);
      filter.plan && (sql += ' fetchPlan ' + filter.plan);
      return sql;
    };

    OWeb.prototype.all = function(model, filter, call) {
      if (filter == null) {
        filter = {};
      }
      this.debug('All : ' + model, filter);
      return this.query(this.select(model, filter), call);
    };

    OWeb.prototype.find = function(model, id, call, opts) {
      return this.fetch({
        path: '/document/' + this.opts.name + '/' + id
      }, call, opts);
    };

    OWeb.prototype.query = function(sql, call, opts) {
      this.debug('query: ' + sql, opts);
      return this.fetch({
        path: '/command/' + this.opts.name + '/sql/' + this.escape(sql)
      }, call);
    };

    OWeb.prototype.update = function(model, id, data, call) {};

    OWeb.prototype.escape = function(text) {
      return encodeURIComponent(text);
    };

    OWeb.prototype.create = function(model, data, call, opts) {
      this.debug('create: ' + model, data);
      return this.query('insert into ' + model + ' content ' + JSON.stringify(data), call, {
        method: post
      });
    };

    OWeb.prototype.invoke = function(func, args, body, call) {
      if (args == null) {
        args = [];
      }
      this.debug('invoke: ' + func, args);
      return this.fetch({
        path: '/function/' + this.opts.name + '/' + func + '/' + args.join('/')
      }, call);
    };

    OWeb.prototype.count = function(model, call, where, opts) {
      this.debug('count: ' + model, where);
      return this.all(model, {
        fields: ['count(*)'],
        where: where
      }, call, opts);
    };

    OWeb.prototype.debug = function(key, val, level) {
      if (val == null) {
        val = '';
      }
      if (level == null) {
        level = 1;
      }
      if (level <= this.opts.logLevel) {
        return console.log(this.type, key, val);
      }
    };

    OWeb.prototype.describe = function(model) {
      return this.fetch({
        path: '/class/' + this.opts.name + '/' + model
      }).then(function(mod, props) {
        var p, _i, _len, _ref;
        if (props == null) {
          props = {};
        }
        _ref = mod.properties;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          p = _ref[_i];
          if (p.name.match(/^[a-z]/)) {
            p.type = typeMap[p.type];
            props[p.name] = p;
          }
        }
        mod.properties = props;
        mod.properties.id = {
          type: 'String',
          format: '#\\d+:\\d+',
          description: mod.name + ' Record Id'
        };
        return mod;
      });
    };

    OWeb.prototype.discover = function(opts, call) {};

    OWeb.prototype.save = function(model, data, call, opts) {};

    OWeb.prototype.autoupdate = function(models, call, opts) {};

    OWeb.prototype.destroy = function(model, id, call, opts) {};

    OWeb.prototype.destroyAll = function(model, where, call) {};

    OWeb.prototype.updateOrCreate = OWeb.save;

    OWeb.prototype.updateAttributes = OWeb.update;

    OWeb.prototype.discoverModelDefinitions = OWeb.discover;

    OWeb.prototype.exists = OWeb.find;

    OWeb.prototype.reqBody = function(data) {
      return data;
    };

    OWeb.prototype.resBody = function(data) {
      return data.result || data;
    };

    OWeb.prototype.isActual = function(models, call) {};

    OWeb.prototype.disconnect = function() {};

    return OWeb;

  })();

  OBin = (function(_super) {
    __extends(OBin, _super);

    OBin.prototype.opts = {
      username: 'admin',
      password: 'admin',
      useToken: true
    };

    OBin.prototype.type = 'OBIN';

    function OBin(opts) {
      this.server = Oriento(_.merge(this.opts, opts));
      this.connect(this.opts);
    }

    OBin.prototype.connect = function(creds) {
      if (creds.name == null) {
        creds.name = this.opts.name;
      }
      if (this.db && creds.token) {
        return this.db.token = creds.token;
      } else {
        return this.db = this.server.use(creds);
      }
    };

    OBin.prototype.invoke = function(func, args) {
      if (args == null) {
        args = [];
      }
      this.debug('INVOKE:' + func, args);
      return this.db.exec("select expand('+func+') from (select " + func + '(' + args.join() + '))');
    };

    OBin.prototype.query = function(sql, call, opts) {
      var prom;
      this.debug('QUERY:' + sql, opts);
      prom = this.db.query(sql, opts);
      call && prom["catch"](call).then(function(res) {
        return call(null, res);
      });
      return prom;
    };

    return OBin;

  })(OWeb);

  operMap = {
    neq: ' <> ',
    like: ' like ',
    nlike: ' not like ',
    ni: 'not in',
    lte: ' <= ',
    gte: ' >= ',
    lt: ' < ',
    gt: ' > '
  };

  typeMap = {
    LINKLIST: '[String]',
    LINKSET: '[String]',
    LINKMAP: 'Object',
    DATE: 'Date',
    STRING: 'String',
    DATETIME: 'Date',
    FLOAT: 'Number',
    DOUBLE: 'Number',
    LONG: 'Number',
    INTEGER: 'Number',
    BOOLEAN: 'Boolean',
    LINK: 'String',
    BINARY: 'Buffer',
    EMBEDDED: 'Object',
    EMBEDDEDLIST: 'Array',
    EMBEDDEDSET: 'Array',
    EMBEDDEDMAP: 'Object'
  };

  mix = function(src, def) {
    return _.merge({}, def, src);
  };

}).call(this);