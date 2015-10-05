'use strict';
var possel = {};
possel.ajaxify = function(url, payload, type) {
  if (type == 'POST') {
    return xr.post(url, payload);
  }
  if (!type) { /* GET */
    //return xr.get(url, payload);
    return $.get(url);
  }
  return Promise.resolve();
};

possel.store = (function() {
  /* Data Store */
  var callbacks = [];
  var servers = [];
  window.x = servers;
  /* mapping of servers and buffers */
  var buff_serv = [];

  var state = {
    auth: false,
    server: 0,
    buffer: 0
  };

  var emit = function() {
    callbacks.map(function(callback, index) {
      callback();
    });
    return true;
  };

  return {
    buffParent: function(buff) {
      return servers[buff_serv[buff.id]];
    },
    state: function(server, buffer, auth) {
      if (server) {
        state.server = server;
      }
      if (buffer) {
        state.buffer = buffer;
      }
      if (auth) { state.auth = auth; }
      if (server || buffer || auth) {
        emit();
      }

      return state;
    },
    addChangeListener: function(callback) {
      callbacks.push(callback);
      return true;
    },
    removeChangeListener: function(callback) {
      callbacks = callbacks.filter(function(c) { return c !== callback; });
      return true;
    },
    getCurrentThread: function() {
      if (state.server == 0 || state.buffer == 0) {
        return [];
      }
      try {
      return servers[state.server].buffers[state.buffer].messages;
      } catch (e) {
        console.warn('something unexpected happened');
        return [];
      }
    },
    getServerList: function() {
      return servers;
    },

    add_server: function(server) {
      var buffers;
      if (servers[server.id]) buffers = servers[server.id].buffers;
      servers[server.id] = server;
      servers[server.id].buffers = buffers;

      if(servers[server.id].buffers === undefined) {
        servers[server.id].buffers = [];
      }
      emit();
    },
    add_buffer: function(buffer) {
      if (buffer.server) {
        servers[buffer.server].buffers[buffer.id] = buffer;
        if(servers[buffer.server].buffers[buffer.id].messages === undefined) {
          servers[buffer.server].buffers[buffer.id].messages = [];
        }

        buff_serv[buffer.id] = buffer.server;
      } else {
        console.warn('handle null-server buffer');
      }
      emit();
    },
    add_line: function(payload) {
      var buffer_id = payload.buffer;
      var buffer = servers[buff_serv[buffer_id]].buffers[buffer_id];

      buffer.messages[payload.id] = payload;
      emit();
    }
  };
})();
possel.events = (function() {
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
    get_user: function(payload) {
      if(payload.actionType == action.GET_USER) {
        possel.ajaxify('/user/' + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.user});
        });
      }
    },
    get_server: function(payload) {
      if(payload.actionType == action.GET_SERVER) {
        possel.ajaxify('/server/' + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.server});
        });
      }
    },
    get_buffer: function(payload) {
      if(payload.actionType == action.GET_BUFFER) {
        return possel.ajaxify('/buffer/' + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.buffer});
        });
      }
    },
    fetch_lines: function(payload) {
      if(payload.actionType == action.FETCH_LINES) {
        if (payload.data.id) {
          possel.ajaxify('/line?after=' + (payload.data.id - (payload.data.no || 30)) + '&before=' + payload.data.id)
            .then(function(data) {
              dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.line});
            });
        } else {
          possel.ajaxify("/line?last=true")
          //   .then(function() {
          //   console.log('success')
          // }).then(function() {
          //   console.log('success2')
          // });
            .then(function(data) {
              // dispatcher.dispatch({actionType: action.FETCH_LINES, data: {id: data[0].id}});
              return possel.ajaxify("/line?after=" + (data[0].id - (payload.data.no || 30)));
            })
            .then(function(data) {
              dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.line});
            });
        }
      }
    },

    get_line_by_id: function(payload) {
      if(payload.actionType == action.GET_LINE_BY_ID) {
        possel.ajaxify("/line?id=" + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.line});
        });
      }
    },
    send_line: function(payload) {
      if (payload.actionType == action.SEND_EVENT) {
        possel.ajaxify('/line', {
          buffer: payload.data.buffer,
          content: payload.data.message || payload.data.content
        }, 'POST')
          .catch(function(data) {
          console.error(data);
            window.err = data;
        });
      }
    },
    authenticate: function(payload) {
      if (payload.actionType === action.AUTH) {
        var username = payload.data.user;
        var password =payload.data.pass;
        var data = {username: username, password: password};
        return possel.ajaxify(
          '/session',
          data,
          'POST'
        ).then(function() {
          possel.events.initial_state();
        });
      }
    },
    data_received: function(payload) {
      if (payload.actionType === action.DATA_RECEIVED && payload.data) {
        switch (payload.type) {
        case type.user:
          console.warn("unknown functionality");
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
  var setup_ws = function() {
    if (websocket_setup) { return false; }
    var ws = new ReconnectingWebSocket(ws_url);
    ws.onopen = function() {
      console.log("connected");
    };
    ws.onclose = function() {
      console.log("disconnected");
    };
    ws.onmessage = possel.events.handle_websocket_push;
    websocket_setup = true;
  };

  return {
    flux: dispatcher,
    action: action,
    initial_state: function(payload) {
      possel.ajaxify('/session').then(function() {
        possel.store.state(undefined, undefined, true);
        dispatcher.dispatch({actionType: action.GET_SERVER, data: {id: "all"}});
        dispatcher.dispatch({actionType: action.GET_BUFFER, data: {id: "all"}});
        setup_ws();
      }, function() {
        // dispatcher.dispatch({actionType: action.AUTH});
      })
    },
    handle_websocket_push: function(payload) {
      var msg = JSON.parse(event.data);

      switch(msg.type){
      case "line":
        dispatcher.dispatch({actionType: action.GET_LINE_BY_ID, data: {id: msg.line}});
        break;
      case "buffer":
        dispatcher.dispatch({actionType: action.GET_BUFFER, data: {id: msg.buffer}});
        break;
      case "user":
        dispatcher.dispatch({actionType: action.GET_USER, data: {id: msg.user}});
      case "last_line":
        dispatcher.dispatch({actionType: action.FETCH_LINES, data: {id: msg.line - 1}});
      default:
        console.warn("unknown message format received from websocket");
        console.warn(msg);
      }
    }
  };

})();

/* console commands */
var p = {
  set m (str) {
    possel.events.flux.dispatch({actionType: possel.events.action.SEND_EVENT, data: { message: str, buffer: possel.store.state().buffer } });
    return "--- end ---";
  },
  set b (input) {
    possel.store.state(undefined, input);
    return "--- end ---";
  },
  get b () {
    var s = possel.store.state().server;
    if (!s) {
      console.warn('Server not selected');
      return undefined;
    }

    possel.store.getServerList()[s].buffers.map(function(buffer) {
      console.log('(' + buffer.id + ') ' + buffer.name);
    });
    return '--- end ---';
  },
  set s (input) {
    possel.store.state(input, undefined);
  },
  get s () {
    possel.store.getServerList().map(function(server) {
      console.log('(' + server.id + ') ' + server.host);
    })
    return '--- end ---';
  },
  set hist (no) {
    possel.events.flux.dispatch({actionType: possel.events.action.FETCH_LINES, data: { id: null, no: (no || 30) }});
    return "--- end ---";
  }
}

