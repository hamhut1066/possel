'use strict';
var possel = {};
possel.ajaxify = function (url, payload, type) {
  if (type == 'POST') {
    return $.ajax({
      type: type,
      contentType: "application/json",
      url: url,
      data: JSON.stringify(payload)
    }).fail(function(e) {
      console.log(e);
    });
  }
  if (!type) {
    /* GET */
    //return xr.get(url, payload);
    return $.get(url);
  }
  return Promise.resolve();
};

possel.store = (function () {
  /* Data Store */
  var callbacks = [];
  var servers = [];
  var users = [];
  window.x = servers;
  /* mapping of servers and buffers */
  var buff_serv = [];

  var _state = {
    auth: false,
    server: 0,
    buffer: 0
  };

  var getCurrentThread = function() {
    if (_state.server == 0 || _state.buffer == 0) {
      return [];
    }
    try {
      return servers[_state.server].buffers[_state.buffer].messages;
    } catch (e) {
      console.warn('something unexpected happened');
      return [];
    }
  };

  var emit = function emit() {
    callbacks.map(function (callback, index) {
      callback({
        servers: servers,
        users: users,
        state: _state,
        current_thread: getCurrentThread()
      });
    });
    return true;
  };

  return {
    initialState: function() {
      return {
        servers: [],
        state: {
          auth: false
        }
      };
    },
    buffParent: function buffParent(buff) {
      return servers[buff_serv[buff.id]];
    },
    state: function state(server, buffer, auth) {
      if (server) {
        _state.server = server;
      }
      if (buffer) {
        _state.buffer = buffer;
      }
      if (auth) {
        _state.auth = auth;
      }
      if (server || buffer || auth) {
        emit();
      }

      return _state;
    },
    addChangeListener: function addChangeListener(callback) {
      callbacks.push(callback);
      return true;
    },
    removeChangeListener: function removeChangeListener(callback) {
      callbacks = callbacks.filter(function (c) {
        return c !== callback;
      });
      return true;
    },
    getServerList: function getServerList() {
      return servers;
    },

    add_server: function add_server(server) {
      var buffers;
      if (servers[server.id]) buffers = servers[server.id].buffers;
      servers[server.id] = server;
      servers[server.id].buffers = buffers;

      if (servers[server.id].buffers === undefined) {
        servers[server.id].buffers = [];
      }
      emit();
    },
    add_buffer: function add_buffer(buffer) {
      if (buffer.server) {
        servers[buffer.server].buffers[buffer.id] = buffer;
        if (servers[buffer.server].buffers[buffer.id].messages === undefined) {
          servers[buffer.server].buffers[buffer.id].messages = [];
          servers[buffer.server].buffers[buffer.id].users = [];
        }

        buff_serv[buffer.id] = buffer.server;
      } else {
        console.warn('handle null-server buffer');
      }
      emit();
    },
    add_line: function add_line(payload) {
      var buffer_id = payload.buffer;
      var buffer = servers[buff_serv[buffer_id]].buffers[buffer_id];

      buffer.messages[payload.id] = payload;
      emit();
    },

    add_user: function(payload) {
      if (payload.buffer) {
        var buffer_id = payload.buffer;
        var server = servers[buff_serv[buffer_id]];
        var buffer = server.buffers[buffer_id];
        buffer.users[payload[0].id] = payload[0];
      }
      users[payload[0].id] = payload[0];
      emit();
    }
  };
})();
possel.events = (function () {
  var dispatcher = new Flux.Dispatcher();

  var action = {
    GET_INITIAL_STATE: "get_initial_state",
    DATA_RECEIVED: "data_received",
    GET_USER: "get_user",
    GET_BUFFER: "get_buffer",
    GET_LINE_BY_ID: "get_line_by_id",
    FETCH_LINES: "fetch_lines",
    AUTH: "auth",
    SEND_EVENT: "send_event"
  };

  var type = {
    user: "user",
    server: "server",
    buffer: "buffer",
    line: "line"
  };

  var callbacks = {
    get_user: function get_user(payload) {
      if (payload.actionType == action.GET_USER) {
        possel.ajaxify('/user/' + payload.data.id).then(function (data) {
          if (payload.data.buffer) {
            data.buffer = payload.data.buffer;
          }
          dispatcher.dispatch({ actionType: action.DATA_RECEIVED, data: data, type: type.user });
        });
      }
    },
    get_server: function get_server(payload) {
      if (payload.actionType == action.GET_SERVER) {
        possel.ajaxify('/server/' + payload.data.id).then(function (data) {
          dispatcher.dispatch({ actionType: action.DATA_RECEIVED, data: data, type: type.server });
        });
      }
    },
    get_buffer: function get_buffer(payload) {
      if (payload.actionType == action.GET_BUFFER) {
        possel.ajaxify('/buffer/' + payload.data.id).then(function (data) {
          dispatcher.dispatch({ actionType: action.DATA_RECEIVED, data: data, type: type.buffer });
        });
      }
    },
    fetch_lines: function fetch_lines(payload) {
      if (payload.actionType == action.FETCH_LINES) {
        if (payload.data.id) {
          possel.ajaxify('/line?after=' + (payload.data.id - (payload.data.no || 30)) + '&before=' + payload.data.id).then(function (data) {
            dispatcher.dispatch({ actionType: action.DATA_RECEIVED, data: data, type: type.line });
          });
        } else {
          possel.ajaxify("/line?last=true")
          .then(function (data) {
            // dispatcher.dispatch({actionType: action.FETCH_LINES, data: {id: data[0].id}});
            return possel.ajaxify("/line?after=" + (data[0].id - (payload.data.no || 30)));
          }).then(function (data) {
            dispatcher.dispatch({ actionType: action.DATA_RECEIVED, data: data, type: type.line });
          });
        }
      }
    },

    get_line_by_id: function get_line_by_id(payload) {
      if (payload.actionType == action.GET_LINE_BY_ID) {
        possel.ajaxify("/line?id=" + payload.data.id).then(function (data) {
          dispatcher.dispatch({ actionType: action.DATA_RECEIVED, data: data, type: type.line });
        });
      }
    },
    send_line: function send_line(payload) {
      if (payload.actionType == action.SEND_EVENT) {
        possel.ajaxify('/line', {
          buffer: payload.data.buffer,
          content: payload.data.message || payload.data.content
        }, 'POST')['fail'](function (data) {
          console.error(data);
          window.err = data;
        });
      }
    },
    authenticate: function authenticate(payload) {
      if (payload.actionType === action.AUTH) {
        var username = payload.data.user;
        var password = payload.data.pass;
        var data = { username: username, password: password };
        possel.ajaxify('/session', data, 'POST').then(function () {
          // TODO: change to dispatch event
          possel.events.initial_state();
        }, function() { /* error */
          // TODO: potential error message can be put here.
        });
      }
    },
    data_received: function data_received(payload) {
      if (payload.actionType === action.DATA_RECEIVED && payload.data) {
        switch (payload.type) {
          case type.user:
          possel.store.add_user(payload.data);
            break;
          case type.server:
            for (var i in payload.data) {
              possel.store.add_server(payload.data[i]);
            }
            break;
          case type.buffer:
            for (i in payload.data) {
              possel.store.add_buffer(payload.data[i]);
            }
            break;
          case type.line:
            payload.data.map(possel.store.add_line);
            break;
          default:
            console.warn("unknown type: ", payload);
        }
      }
    }
  };

  for (var key in callbacks) {
    dispatcher.register(callbacks[key]);
  }

  var websocket_setup = false;
  var setup_ws = function setup_ws() {
    if (websocket_setup) {
      return false;
    }
    var ws = new ReconnectingWebSocket(ws_url);
    ws.onopen = function () {
      console.log("connected");
    };
    ws.onclose = function () {
      console.log("disconnected");
    };
    ws.onmessage = possel.events.handle_websocket_push;
    websocket_setup = true;
    return true;
  };

  return {
    flux: dispatcher,
    action: action,
    initial_state: function initial_state(payload) {
      possel.ajaxify('/session').then(function () {
        possel.store.state(undefined, undefined, true);
        dispatcher.dispatch({ actionType: action.GET_SERVER, data: { id: "all" } });
        dispatcher.dispatch({ actionType: action.GET_BUFFER, data: { id: "all" } });
        setup_ws();
      }, function () {
        dispatcher.dispatch({actionType: action.AUTH});
      });
    },
    handle_websocket_push: function handle_websocket_push(payload) {
      var msg = JSON.parse(event.data); //TODO: look at what is going on here!

      switch (msg.type) {
      case "line":
        dispatcher.dispatch({ actionType: action.GET_LINE_BY_ID, data: { id: msg.line } });
        break;
      case "buffer":
        dispatcher.dispatch({ actionType: action.GET_BUFFER, data: { id: msg.buffer } });
        break;
      case "user":
        dispatcher.dispatch({ actionType: action.GET_USER, data: { id: msg.user } });
        break;
      case "last_line":
        dispatcher.dispatch({ actionType: action.FETCH_LINES, data: { id: msg.line - 1 } });
        break;
      case "membership":
        dispatcher.dispatch({ actionType: action.GET_USER, data: { id: msg.user, buffer: msg.buffer}});
        break;
      default:
        console.warn("unknown message format received from websocket");
        console.warn(msg);
      }
    }
  };
})();

/* console commands */
var p = Object.defineProperties({}, {
  m: {
    set: function set(str) {
      possel.events.flux.dispatch({ actionType: possel.events.action.SEND_EVENT, data: { message: str, buffer: possel.store.state().buffer } });
      return "--- end ---";
    },
    configurable: true,
    enumerable: true
  },
  b: {
    set: function set(input) {
      possel.store.state(undefined, input);
      return "--- end ---";
    },
    get: function get() {
      var s = possel.store.state().server;
      if (!s) {
        console.warn('Server not selected');
        return undefined;
      }

      possel.store.getServerList()[s].buffers.map(function (buffer) {
        console.log('(' + buffer.id + ') ' + buffer.name);
      });
      return '--- end ---';
    },
    configurable: true,
    enumerable: true
  },
  s: {
    set: function set(input) {
      possel.store.state(input, undefined);
    },
    get: function get() {
      possel.store.getServerList().map(function (server) {
        console.log('(' + server.id + ') ' + server.host);
      });
      return '--- end ---';
    },
    configurable: true,
    enumerable: true
  },
  hist: {
    set: function set(no) {
      possel.events.flux.dispatch({ actionType: possel.events.action.FETCH_LINES, data: { id: null, no: no || 30 } });
      return "--- end ---";
    },
    configurable: true,
    enumerable: true
  }
});
